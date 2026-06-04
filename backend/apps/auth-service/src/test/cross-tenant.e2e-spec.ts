import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import { setupE2eTest, teardownE2eTest, TestContext } from './e2e-helper';

describe('Cross-Tenant Access Security E2E Tests', () => {
  let context: TestContext;
  let tenantBId: string;

  before(async () => {
    context = await setupE2eTest();

    // Create a second tenant B for cross-tenant isolation testing
    const tenantB = await context.prisma.tenant.create({
      data: {
        code: 'tenant-b-' + String(Math.random()).slice(2, 8),
        name: 'Tenant B Clinic',
        status: 'active',
        subscriptionPlan: 'ENTERPRISE',
      },
    });
    tenantBId = tenantB.id;
  });

  after(async () => {
    // Cleanup Tenant B
    if (tenantBId) {
      await context.prisma.tenant.delete({ where: { id: tenantBId } }).catch(() => {});
    }
    await teardownE2eTest(context);
  });

  it('should return 403 Forbidden (TENANT_MISMATCH) if x-tenant-id header does not match JWT tenant_id', async () => {
    const res = await fetch(`${context.baseUrl}/patients`, {
      method: 'GET',
      headers: {
        ...context.authHeaders,
        'x-tenant-id': tenantBId, // Mismatch: Tenant B header with Tenant A JWT
      },
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.message, 'TENANT_MISMATCH');
  });

  it('should naturally isolate queries to JWT tenant and prevent cross-tenant queries', async () => {
    // Create a patient under Tenant B (simulate some other tenant's data)
    // Run this inside a direct tenant session or bypass RLS via admin connection if needed,
    // or run with RLS set to Tenant B
    const patientB = await context.prisma.runWithTenant(tenantBId, async () => {
      return context.prisma.patient.create({
        data: {
          tenantId: tenantBId,
          patientCode: 'P-B-' + String(Math.random()).slice(2, 8),
          firstName: 'B-Patient',
          lastName: 'Test',
          fullName: 'Test B-Patient',
          status: 'ACTIVE',
          registrationBranchId: context.branchId, // Just reuse branch or generate if needed
        },
      });
    });

    // Make an authenticated request as Tenant A
    const res = await fetch(`${context.baseUrl}/patients`, {
      method: 'GET',
      headers: {
        ...context.authHeaders,
        'x-tenant-id': context.tenantId, // Matches JWT
      },
    });

    assert.equal(res.status, 200);
    const result = await res.json();

    // Verify Tenant B's patient is NOT visible to Tenant A
    const foundPatientB = result.items?.find((p: any) => p.id === patientB.id);
    assert.equal(foundPatientB, undefined, 'Tenant A should not see Tenant B patient');

    // Cleanup Tenant B patient
    await context.prisma.runWithTenant(tenantBId, async () => {
      await context.prisma.patient.delete({ where: { id: patientB.id } });
    });
  });
});
