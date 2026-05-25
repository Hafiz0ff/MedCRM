import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it, before, after } from 'node:test';
import { setupE2eTest, teardownE2eTest, TestContext } from './e2e-helper';

describe('E2E Patient Portal Auth & Clinic Grants', () => {
  let context: TestContext;
  const testPhone = `+99293${Math.floor(1000000 + Math.random() * 9000000)}`;
  let patientId: string;
  let accessToken: string;
  let sessionId: string;

  before(async () => {
    context = await setupE2eTest();

    // 1. Create a patient to match the phone number
    const patient = await context.prisma.patient.create({
      data: {
        tenantId: context.tenantId,
        patientCode: `PORTAL-PAT-${Date.now()}`,
        firstName: 'Portal',
        lastName: 'Patient',
        fullName: 'Portal Patient',
        status: 'ACTIVE',
      },
    });
    patientId = patient.id;

    // 2. Add phone contact record.
    // PrismaService will intercept this and automatically compute valueBi and valueEnc.
    const normalized = testPhone.replace(/[\s()+-]/g, '').toLowerCase();
    const normalizedValueHash = createHash('sha256').update(normalized).digest('hex');

    await context.prisma.patientContact.create({
      data: {
        tenantId: context.tenantId,
        patientId,
        type: 'PHONE',
        value: testPhone,
        normalizedValueHash,
        isPrimary: true,
      },
    });
  });

  after(async () => {
    // Cleanup E2E test database records
    await context.prisma.patientPortalGrant.deleteMany({
      where: { patientId },
    });
    await context.prisma.patientContact.deleteMany({
      where: { patientId },
    });
    await context.prisma.patient.deleteMany({
      where: { id: patientId },
    });
    await context.prisma.patientPortalOtp.deleteMany({
      where: { phoneE164: testPhone },
    });
    await teardownE2eTest(context);
  });

  it('should request OTP successfully', async () => {
    const res = await fetch(`${context.baseUrl}/portal/v1/auth/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: testPhone }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.success);
    assert.ok(body.expiresAt);
  });

  it('should enforce rate limiting on too many OTP requests', async () => {
    // We send multiple OTP requests to trigger the rate limit (> 5 inside 15m)
    for (let i = 0; i < 5; i++) {
      await fetch(`${context.baseUrl}/portal/v1/auth/otp/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone }),
      });
    }

    const res = await fetch(`${context.baseUrl}/portal/v1/auth/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: testPhone }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.message, /Too many OTP requests/);
  });

  it('should fail to verify with invalid/expired OTP code', async () => {
    const res = await fetch(`${context.baseUrl}/portal/v1/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: testPhone,
        code: '999999', // Incorrect code
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.message, /Incorrect OTP code|OTP code has expired/);
  });

  it('should verify OTP and register/login successfully', async () => {
    // 1. Manually request a fresh OTP bypass by updating the database
    // Delete any rate limits for E2E consistency
    await context.prisma.patientPortalOtp.deleteMany({
      where: { phoneE164: testPhone },
    });

    // Request new OTP
    await fetch(`${context.baseUrl}/portal/v1/auth/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: testPhone }),
    });

    // 2. Query database for the latest OTP row and update its codeHash to '123456'
    const latestOtp = await context.prisma.patientPortalOtp.findFirstOrThrow({
      where: { phoneE164: testPhone },
      orderBy: { createdAt: 'desc' },
    });

    const targetCode = '123456';
    const newHash = createHash('sha256').update(targetCode).digest('hex');

    await context.prisma.patientPortalOtp.update({
      where: { id: latestOtp.id },
      data: { codeHash: newHash, attempts: 0 },
    });

    // 3. Verify OTP code '123456'
    const res = await fetch(`${context.baseUrl}/portal/v1/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: testPhone,
        code: targetCode,
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.accessToken);
    assert.ok(body.refreshToken);
    assert.ok(body.account);
    assert.equal(body.account.phoneE164, testPhone);

    accessToken = body.accessToken;
  });

  it('should link patient portal account to a clinic tenant successfully', async () => {
    // Use the portal user accessToken
    const res = await fetch(`${context.baseUrl}/portal/v1/auth/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ tenantCode: 'demo-clinic' }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.success);
    assert.equal(body.clinicName, 'Demo Clinic');
  });

  it('should retrieve list of linked clinics for the account', async () => {
    const res = await fetch(`${context.baseUrl}/portal/v1/auth/clinics`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body));
    assert.equal(body.length, 1);
    assert.equal(body[0].tenantCode, 'demo-clinic');
    assert.equal(body[0].patientId, patientId);
  });

  it('should logout and revoke the active portal session', async () => {
    const res = await fetch(`${context.baseUrl}/portal/v1/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.success);
  });
});
