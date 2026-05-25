import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import { AuditLoggerService } from '@core/audit/audit-logger.service';
import { AuditChainService } from '@core/security/audit-chain.service';
import { setupE2eTest, teardownE2eTest, TestContext } from './e2e-helper';

describe('Security & Compliance Baseline E2E Verification', () => {
  let context: TestContext;
  let auditLogger: AuditLoggerService;
  let auditChain: AuditChainService;

  before(async () => {
    context = await setupE2eTest();
    auditLogger = context.app.get(AuditLoggerService);
    auditChain = context.app.get(AuditChainService);
  });

  after(async () => {
    await teardownE2eTest(context);
  });

  describe('Symmetric PHI Cryptography & Exact Match Searching', () => {
    it('should transparently encrypt PHI fields on write and decrypt on read', async () => {
      // 1. Create a patient through prisma client (triggers transparent encryption hooks)
      const patient = await context.prisma.patient.create({
        data: {
          tenantId: context.tenantId,
          patientCode: 'P-T' + String(Math.random()).slice(2, 8),
          firstName: 'Иван',
          lastName: 'Тестовый',
          middleName: 'Петрович',
          fullName: 'Тестовый Иван Петрович',
          status: 'ACTIVE',
          registrationBranchId: context.branchId,
        },
      });

      assert.equal(patient.firstName, 'Иван');
      assert.equal(patient.lastName, 'Тестовый');
      assert.equal(patient.fullName, 'Тестовый Иван Петрович');

      // 2. Query the raw database bypassing transparent decryption hooks
      const rawRows = await context.prisma.$queryRawUnsafe<any[]>(
        `SELECT first_name, first_name_enc, first_name_bi, last_name, last_name_enc, last_name_bi FROM patients WHERE id = $1::uuid`,
        patient.id,
      );

      assert.ok(rawRows.length > 0);
      assert.equal(rawRows[0].first_name, '[ENCRYPTED]');
      assert.equal(rawRows[0].last_name, '[ENCRYPTED]');
      assert.ok(rawRows[0].first_name_enc.startsWith('{'));
      assert.ok(rawRows[0].last_name_enc.startsWith('{'));
      assert.equal(rawRows[0].first_name_bi.length, 64); // SHA-256 hex length
      assert.equal(rawRows[0].last_name_bi.length, 64);
    });

    it('should successfully search patient exact-match name using blind indexes', async () => {
      // Create a specific target patient
      const patient = await context.prisma.patient.create({
        data: {
          tenantId: context.tenantId,
          patientCode: 'P-T' + String(Math.random()).slice(2, 8),
          firstName: 'Мария',
          lastName: 'Криптографическая',
          fullName: 'Криптографическая Мария',
          status: 'ACTIVE',
          registrationBranchId: context.branchId,
        },
      });

      // Call the API endpoint search for this patient by exact name
      const res = await fetch(`${context.baseUrl}/patients?q=Мария`, {
        method: 'GET',
        headers: context.authHeaders,
      });

      assert.equal(res.status, 200);
      const result = await res.json();
      assert.ok(result.items.length > 0);
      const found = result.items.find((item: any) => item.id === patient.id);
      assert.ok(found);
      assert.equal(found.firstName, 'Мария');
      assert.equal(found.lastName, 'Криптографическая');
    });
  });

  describe('Cryptographic Audit Trail Chain & Tampering Checks', () => {
    it('should sequentially compute SHA-256 chain links and detect tampering', async () => {
      // 1. Create a series of chained audit logs
      await auditLogger.log({
        tenantId: context.tenantId,
        action: 'test.verification.event1',
        userId: context.adminId,
        ipAddress: '127.0.0.1',
      });

      await auditLogger.log({
        tenantId: context.tenantId,
        action: 'test.verification.event2',
        userId: context.adminId,
        ipAddress: '127.0.0.1',
      });

      // 2. Verify audit chain is completely intact
      const initialReport = await auditChain.verifyChain(context.tenantId);
      assert.ok(initialReport.success);
      assert.ok(initialReport.totalChecked >= 2);

      // Get the last log ID
      const latestLogs = await context.prisma.auditLog.findMany({
        where: { tenantId: context.tenantId, action: 'test.verification.event2' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      });
      assert.ok(latestLogs.length > 0);
      const targetLogId = latestLogs[0].id;

      // 3. Tamper with the action column of the target log directly in Postgres (bypassing application rules)
      await context.prisma.$queryRawUnsafe(`ALTER TABLE audit_logs DISABLE TRIGGER ALL`);
      await context.prisma.$queryRawUnsafe(
        `UPDATE audit_logs SET action = 'test.tampered.event' WHERE id = $1::uuid`,
        targetLogId,
      );
      await context.prisma.$queryRawUnsafe(`ALTER TABLE audit_logs ENABLE TRIGGER ALL`);

      // 4. Run chain integrity scanner and verify it successfully catches the broken chain link
      const tamperedReport = await auditChain.verifyChain(context.tenantId);
      assert.equal(tamperedReport.success, false);
      assert.ok(tamperedReport.message.includes('Tampering detected'));
    });
  });

  describe('Device Session Auditing and Revocation', () => {
    it('should list all active sessions and allow remote revocation', async () => {
      // 1. List active user sessions
      const listRes = await fetch(`${context.baseUrl}/auth/sessions`, {
        method: 'GET',
        headers: context.authHeaders,
      });

      assert.equal(listRes.status, 200);
      const sessions = await listRes.json();
      assert.ok(Array.isArray(sessions));
      assert.ok(sessions.length > 0);

      const targetSession = sessions[0];
      assert.ok(targetSession.id);

      // 2. Perform remote revocation of this session
      const revokeRes = await fetch(`${context.baseUrl}/auth/sessions/${targetSession.id}`, {
        method: 'DELETE',
        headers: context.authHeaders,
      });

      assert.equal(revokeRes.status, 200);
      const revokeBody = await revokeRes.json();
      assert.equal(revokeBody.success, true);

      // 3. Verify session state in database is marked as revoked
      const dbSession = await context.prisma.userSession.findUnique({
        where: { id: targetSession.id },
      });
      assert.ok(dbSession?.revokedAt);
    });
  });
});
