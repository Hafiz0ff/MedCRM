import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import { setupE2eTest, teardownE2eTest, TestContext } from './e2e-helper';

describe('E2E Communications & Notifications Studio', () => {
  let context: TestContext;
  let patientId: string;
  let employeeId: string;
  let serviceId: string;
  let templateId: string;
  let ruleId: string;
  let appointmentId: string;
  const uniqueCode = `tmpl-${Date.now()}`;
  const phoneVal = `+99293${Math.floor(1000000 + Math.random() * 9000000)}`;
  const testDaysOffset = 200 + Math.floor(Math.random() * 500);

  before(async () => {
    context = await setupE2eTest();

    // Create isolated test patient for this run
    const newPat = await context.prisma.patient.create({
      data: {
        tenantId: context.tenantId,
        patientCode: `P-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        firstName: 'E2E',
        lastName: 'Patient',
        fullName: 'E2E Patient',
        status: 'ACTIVE',
      },
    });
    patientId = newPat.id;

    // Connect phone contact for chatbot tests
    const crypto = await import('crypto');
    const normalized = phoneVal.replace(/[\s()+-]/g, '').toLowerCase();
    const hash = crypto.createHash('sha256').update(normalized).digest('hex');

    await context.prisma.patientContact.create({
      data: {
        tenantId: context.tenantId,
        patientId,
        type: 'PHONE',
        value: phoneVal,
        normalizedValueHash: hash,
        isPrimary: true,
      },
    });

    const employee = await context.prisma.employee.findFirstOrThrow({
      where: { tenantId: context.tenantId },
    });
    employeeId = employee.id;

    const service = await context.prisma.service.findFirstOrThrow({
      where: { tenantId: context.tenantId },
    });
    serviceId = service.id;
  });

  after(async () => {
    await teardownE2eTest(context);
  });

  it('should create a message template successfully', async () => {
    const res = await fetch(`${context.baseUrl}/communications/templates`, {
      method: 'POST',
      headers: context.authHeaders,
      body: JSON.stringify({
        templateCode: uniqueCode,
        templateName: 'E2E Test Template',
        channelType: 'TELEGRAM',
        languageCode: 'ru',
        templateBody:
          'Здравствуйте, {{patient.fullName}}! Подтвердите визит к {{doctor.firstName}}.',
        variablesJson: {},
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.id);
    assert.equal(body.templateCode, uniqueCode);
    templateId = body.id;
  });

  it('should update message template', async () => {
    const res = await fetch(`${context.baseUrl}/communications/templates/${templateId}`, {
      method: 'PUT',
      headers: context.authHeaders,
      body: JSON.stringify({
        templateName: 'Updated E2E Test Template',
        templateBody:
          'Здравствуйте, {{patient.fullName}}! Напоминаем о записи к {{doctor.firstName}}.',
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.templateName, 'Updated E2E Test Template');
  });

  it('should get message templates list', async () => {
    const res = await fetch(`${context.baseUrl}/communications/templates`, {
      method: 'GET',
      headers: context.authHeaders,
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body));
    const found = body.find((t: any) => t.id === templateId);
    assert.ok(found);
  });

  it('should create notification rule successfully', async () => {
    const res = await fetch(`${context.baseUrl}/communications/rules`, {
      method: 'POST',
      headers: context.authHeaders,
      body: JSON.stringify({
        ruleName: 'E2E Reminder Rule',
        triggerEvent: 'appointment.scheduled_scan',
        channelType: 'TELEGRAM',
        templateId,
        delayMinutes: 0,
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.id);
    ruleId = body.id;
  });

  it('should update notification rule', async () => {
    const res = await fetch(`${context.baseUrl}/communications/rules/${ruleId}`, {
      method: 'PUT',
      headers: context.authHeaders,
      body: JSON.stringify({
        ruleName: 'Updated E2E Reminder Rule',
        isActive: false,
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ruleName, 'Updated E2E Reminder Rule');
    assert.equal(body.isActive, false);
  });

  it('should get rules list', async () => {
    const res = await fetch(`${context.baseUrl}/communications/rules`, {
      method: 'GET',
      headers: context.authHeaders,
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body));
    const found = body.find((r: any) => r.id === ruleId);
    assert.ok(found);
  });

  it('should configure communication channels and SMS providers', async () => {
    const resChan = await fetch(`${context.baseUrl}/communications/channels`, {
      method: 'POST',
      headers: context.authHeaders,
      body: JSON.stringify({
        channelType: 'TELEGRAM',
        providerCode: 'TELEGRAM_BOT',
        configurationJson: { token: 'mock_token', username: 'mock_username' },
        isActive: true,
      }),
    });
    assert.equal(resChan.status, 201);
    const chanBody = await resChan.json();
    assert.equal(chanBody.providerCode, 'TELEGRAM_BOT');

    const resSms = await fetch(`${context.baseUrl}/communications/sms-providers`, {
      method: 'POST',
      headers: context.authHeaders,
      body: JSON.stringify({
        providerCode: 'OSON_SMS',
        providerName: 'Oson SMS Test',
        senderName: 'SHIFO',
        apiCredentialsJson: { apiKey: 'key_abc', secret: 'secret_123' },
        dailyLimit: 500,
        isActive: true,
      }),
    });
    assert.equal(resSms.status, 201);
    const smsBody = await resSms.json();
    assert.equal(smsBody.providerCode, 'OSON_SMS');
    assert.equal(smsBody.dailyLimit, 500);
  });

  it('should transition appointment status via Chatbot response', async () => {
    // 1. Create a scheduled appointment
    const startAt = new Date();
    startAt.setDate(startAt.getDate() + testDaysOffset);
    startAt.setHours(10, 0, 0, 0);
    const endAt = new Date(startAt);
    endAt.setMinutes(endAt.getMinutes() + 30);

    const appRes = await fetch(`${context.baseUrl}/appointments`, {
      method: 'POST',
      headers: context.authHeaders,
      body: JSON.stringify({
        branchId: context.branchId,
        patientId,
        employeeId,
        serviceId,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        bookingSource: 'ONLINE_WIDGET',
        appointmentType: 'CONSULTATION',
      }),
    });

    if (appRes.status !== 201) {
      const errText = await appRes.text();
      console.log('Failing Appointment creation response:', appRes.status, errText);
    }
    assert.equal(appRes.status, 201);
    const appBody = await appRes.json();
    appointmentId = appBody.id;

    // 2. Trigger SMS webhook with patient response "1" (meaning YES/Confirm)
    const webhookRes = await fetch(`${context.baseUrl}/communications/webhooks/sms/oson_sms`, {
      method: 'POST',
      headers: context.authHeaders,
      body: JSON.stringify({
        phone: phoneVal,
        text: '1',
      }),
    });

    assert.equal(webhookRes.status, 201);

    // 3. Verify in DB that the appointment is upgraded to CONFIRMED
    const dbApp = await context.schedulingPrisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    assert.equal(dbApp?.status, 'CONFIRMED');
    assert.ok(dbApp?.confirmedAt);

    // 4. Trigger Telegram webhook with patient response "2" (meaning NO/Cancel)
    const tgWebhookRes = await fetch(`${context.baseUrl}/communications/webhooks/telegram`, {
      method: 'POST',
      headers: context.authHeaders,
      body: JSON.stringify({
        chatId: phoneVal,
        text: '2',
      }),
    });

    assert.equal(tgWebhookRes.status, 201);

    // 5. Verify in DB that the appointment is transitioned to CANCELLED
    const dbAppCancel = await context.schedulingPrisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    assert.equal(dbAppCancel?.status, 'CANCELLED');
    assert.ok(dbAppCancel?.cancelledAt);
  });
});
