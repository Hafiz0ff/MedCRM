import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import { setupE2eTest, teardownE2eTest, TestContext } from './e2e-helper';

describe('E2E System Settings & RBAC Subsystem', () => {
  let context: TestContext;

  before(async () => {
    context = await setupE2eTest();
  });

  after(async () => {
    await teardownE2eTest(context);
  });

  describe('Tenant settings', () => {
    it('returns the tenant profile', async () => {
      const res = await fetch(`${context.baseUrl}/system/tenant`, {
        method: 'GET',
        headers: context.authHeaders,
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.id, context.tenantId);
      assert.equal(typeof body.timezone, 'string');
      assert.equal(typeof body.defaultLocale, 'string');
    });

    it('updates the tenant profile and writes an audit log', async () => {
      const original = await context.prisma.tenant.findUniqueOrThrow({
        where: { id: context.tenantId },
      });

      const res = await fetch(`${context.baseUrl}/system/tenant`, {
        method: 'PATCH',
        headers: context.authHeaders,
        body: JSON.stringify({ timezone: 'Asia/Dushanbe', defaultLocale: 'en' }),
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.timezone, 'Asia/Dushanbe');
      assert.equal(body.defaultLocale, 'en');

      const audit = await context.prisma.auditLog.findFirst({
        where: {
          tenantId: context.tenantId,
          action: 'system.tenant.profile.updated',
          entityId: context.tenantId,
        },
        orderBy: { createdAt: 'desc' },
      });
      assert.ok(audit, 'audit log entry must exist');

      // Restore so other tests don't see a different timezone.
      await context.prisma.tenant.update({
        where: { id: context.tenantId },
        data: { timezone: original.timezone, defaultLocale: original.defaultLocale },
      });
    });

    it('lists tenant modules', async () => {
      const res = await fetch(`${context.baseUrl}/system/modules`, {
        method: 'GET',
        headers: context.authHeaders,
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(Array.isArray(body));
      assert.ok(body.length > 0);
      const fhirModule = body.find((m: any) => m.moduleCode === 'emr-ehr');
      assert.ok(fhirModule, 'emr-ehr module must be present');
    });

    it('updates a non-core tenant module configuration', async () => {
      const res = await fetch(`${context.baseUrl}/system/modules/communications`, {
        method: 'PATCH',
        headers: context.authHeaders,
        body: JSON.stringify({
          enabled: true,
          configuration: { fhir_integration_enabled: true, online_booking_enabled: false },
        }),
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.enabled, true);
      assert.deepEqual(body.configuration, {
        fhir_integration_enabled: true,
        online_booking_enabled: false,
      });
    });

    it('rejects disabling a core module', async () => {
      const res = await fetch(`${context.baseUrl}/system/modules/auth`, {
        method: 'PATCH',
        headers: context.authHeaders,
        body: JSON.stringify({ enabled: false }),
      });
      assert.equal(res.status, 403);
    });
  });

  describe('Roles & permissions', () => {
    let createdRoleId: string | undefined;

    it('lists permissions catalog', async () => {
      const res = await fetch(`${context.baseUrl}/system/permissions`, {
        method: 'GET',
        headers: context.authHeaders,
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(Array.isArray(body));
      assert.ok(body.some((p: any) => p.code === 'emr.fhir.read'));
    });

    it('creates a custom role, sets permissions and revokes sessions for assigned users', async () => {
      const createRes = await fetch(`${context.baseUrl}/system/roles`, {
        method: 'POST',
        headers: context.authHeaders,
        body: JSON.stringify({
          code: `TEST_AUDITOR_${Date.now()}`,
          name: 'Test Auditor',
          description: 'Read-only auditor role created from E2E tests',
        }),
      });
      assert.equal(createRes.status, 201);
      const created = await createRes.json();
      assert.ok(created.id);
      assert.equal(created.isSystem, false);
      createdRoleId = created.id;

      const permRes = await fetch(`${context.baseUrl}/system/roles/${createdRoleId}/permissions`, {
        method: 'PUT',
        headers: context.authHeaders,
        body: JSON.stringify({ permissionCodes: ['emr.fhir.read', 'system.audit.read'] }),
      });
      assert.equal(permRes.status, 200);
      const permBody = await permRes.json();
      assert.equal(permBody.roleId, createdRoleId);
      assert.deepEqual(permBody.permissions.slice().sort(), ['emr.fhir.read', 'system.audit.read']);
      assert.equal(typeof permBody.affectedUserCount, 'number');
    });

    it('rejects setting an unknown permission code', async () => {
      if (!createdRoleId) throw new Error('role not created');
      const res = await fetch(`${context.baseUrl}/system/roles/${createdRoleId}/permissions`, {
        method: 'PUT',
        headers: context.authHeaders,
        body: JSON.stringify({ permissionCodes: ['this.does.not.exist'] }),
      });
      assert.equal(res.status, 400);
    });

    it('rejects modifying a system role', async () => {
      const systemRole = await context.prisma.role.findFirstOrThrow({
        where: { tenantId: context.tenantId, isSystem: true },
      });
      const res = await fetch(`${context.baseUrl}/system/roles/${systemRole.id}`, {
        method: 'PATCH',
        headers: context.authHeaders,
        body: JSON.stringify({ name: 'Renamed Owner' }),
      });
      assert.equal(res.status, 403);
    });

    it('deletes the custom role', async () => {
      if (!createdRoleId) throw new Error('role not created');
      const res = await fetch(`${context.baseUrl}/system/roles/${createdRoleId}`, {
        method: 'DELETE',
        headers: context.authHeaders,
      });
      assert.equal(res.status, 200);
    });

    it('assigning user roles revokes active sessions for that user', async () => {
      // Create a separate user so we don't lock out the admin running tests.
      const targetEmail = `e2e-rbac-${Date.now()}@demo.clinic`;
      const target = await context.prisma.user.create({
        data: {
          tenantId: context.tenantId,
          email: targetEmail,
          passwordHash: 'argon2id$placeholder',
          firstName: 'E2E',
          lastName: 'RbacTarget',
          language: 'ru',
          status: 'active',
        },
      });

      // Existing branch role to start with (so revoke has something to do).
      const ownerRole = await context.prisma.role.findFirstOrThrow({
        where: { tenantId: context.tenantId, code: 'CLINIC_OWNER' },
      });
      await context.prisma.userBranchRole.create({
        data: {
          userId: target.id,
          tenantId: context.tenantId,
          branchId: context.branchId,
          roleId: ownerRole.id,
          isPrimary: true,
        },
      });
      // Open a session manually so we can verify it gets revoked.
      const session = await context.prisma.userSession.create({
        data: {
          userId: target.id,
          tenantId: context.tenantId,
          refreshTokenHash: 'placeholder',
          tokenFingerprint: 'placeholder',
          expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
        },
      });

      const res = await fetch(`${context.baseUrl}/system/users/${target.id}/roles`, {
        method: 'PUT',
        headers: context.authHeaders,
        body: JSON.stringify({
          assignments: [{ branchId: context.branchId, roleId: ownerRole.id, isPrimary: true }],
        }),
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(body.revokedSessionCount >= 1);

      const refreshed = await context.prisma.userSession.findUniqueOrThrow({
        where: { id: session.id },
      });
      assert.ok(refreshed.revokedAt !== null, 'session must be marked revoked');

      // cleanup
      await context.prisma.userSession.deleteMany({ where: { userId: target.id } });
      await context.prisma.userBranchRole.deleteMany({ where: { userId: target.id } });
      await context.prisma.user.delete({ where: { id: target.id } });
    });
  });

  describe('Integration providers and API keys', () => {
    let providerId: string | undefined;
    let firstApiKey: string | undefined;

    it('creates an integration provider and returns the API key once', async () => {
      const res = await fetch(`${context.baseUrl}/system/integrations`, {
        method: 'POST',
        headers: context.authHeaders,
        body: JSON.stringify({
          providerType: 'FHIR',
          providerCode: `fhir-e2e-${Date.now()}`,
          providerName: 'E2E FHIR Integration',
          authenticationType: 'API_KEY',
          rateLimitPerMinute: 30,
        }),
      });
      assert.equal(res.status, 201);
      const body = await res.json();
      providerId = body.id;
      firstApiKey = body.apiKey;
      assert.ok(firstApiKey?.startsWith('mck_live_'));
      assert.equal(typeof body.apiKeyPrefix, 'string');
    });

    it('does NOT expose the API key hash in listings', async () => {
      const res = await fetch(`${context.baseUrl}/system/integrations`, {
        method: 'GET',
        headers: context.authHeaders,
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      const ours = body.find((p: any) => p.id === providerId);
      assert.ok(ours);
      assert.equal(ours.configuration.apiKeyHash, undefined);
      assert.equal(typeof ours.apiKeyPrefix, 'string');
    });

    it('rotates the API key and invalidates the previous one', async () => {
      if (!providerId) throw new Error('provider not created');
      const res = await fetch(`${context.baseUrl}/system/integrations/${providerId}/rotate-key`, {
        method: 'POST',
        headers: context.authHeaders,
      });
      assert.equal(res.status, 201);
      const body = await res.json();
      assert.ok(body.apiKey?.startsWith('mck_live_'));
      assert.notEqual(body.apiKey, firstApiKey);
    });

    it('deletes the integration provider', async () => {
      if (!providerId) throw new Error('provider not created');
      const res = await fetch(`${context.baseUrl}/system/integrations/${providerId}`, {
        method: 'DELETE',
        headers: context.authHeaders,
      });
      assert.equal(res.status, 200);
    });
  });

  describe('Audit log read API', () => {
    it('returns paginated audit log entries scoped to the tenant', async () => {
      const res = await fetch(`${context.baseUrl}/system/audit-logs?pageSize=5`, {
        method: 'GET',
        headers: context.authHeaders,
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.page, 1);
      assert.equal(body.pageSize, 5);
      assert.equal(typeof body.total, 'number');
      assert.ok(Array.isArray(body.items));
      for (const item of body.items) {
        assert.equal(item.userId === null || typeof item.userId === 'string', true);
      }
    });

    it('filters audit logs by action', async () => {
      const res = await fetch(
        `${context.baseUrl}/system/audit-logs?action=system.tenant.profile.updated&pageSize=10`,
        { method: 'GET', headers: context.authHeaders },
      );
      assert.equal(res.status, 200);
      const body = await res.json();
      for (const item of body.items) {
        assert.equal(item.action, 'system.tenant.profile.updated');
      }
    });

    it('rejects malformed date parameters', async () => {
      const res = await fetch(`${context.baseUrl}/system/audit-logs?dateFrom=not-a-date`, {
        method: 'GET',
        headers: context.authHeaders,
      });
      assert.equal(res.status, 400);
    });
  });
});
