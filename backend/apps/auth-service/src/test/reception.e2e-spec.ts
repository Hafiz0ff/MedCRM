import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupE2eTest, teardownE2eTest, TestContext } from './e2e-helper';

describe('E2E Reception Workflow Completion', () => {
  let context: TestContext;
  let patientId: string;
  let employeeId: string;
  let serviceId: string;
  let appointmentId: string;
  let invoiceId: string;

  // Generate a completely unique days offset for this test run to avoid time-slot conflicts
  const testDaysOffset = 600 + Math.floor(Math.random() * 500);

  before(async () => {
    context = await setupE2eTest();

    // Retrieve seeded patient, employee, and service
    const patient = await context.prisma.patient.findFirstOrThrow({
      where: { tenantId: context.tenantId }
    });
    patientId = patient.id;

    const employee = await context.prisma.employee.findFirstOrThrow({
      where: { tenantId: context.tenantId }
    });
    employeeId = employee.id;

    const service = await context.prisma.service.findFirstOrThrow({
      where: { tenantId: context.tenantId, code: 'consultation' }
    });
    serviceId = service.id;

    // Create an appointment for check-in
    const startAt = new Date();
    startAt.setDate(startAt.getDate() + testDaysOffset);
    startAt.setHours(11, 0, 0, 0);
    const endAt = new Date(startAt);
    endAt.setMinutes(endAt.getMinutes() + 30);

    const app = await context.prisma.appointment.create({
      data: {
        tenantId: context.tenantId,
        branchId: context.branchId,
        patientId,
        employeeId,
        serviceId,
        startAt,
        endAt,
        status: 'SCHEDULED',
        bookingSource: 'ADMIN_PANEL',
        appointmentType: 'CONSULTATION',
        durationMinutes: 30,
        appointmentNumber: `A-REC-${Date.now()}`
      }
    });
    appointmentId = app.id;
  });

  after(async () => {
    await teardownE2eTest(context);
  });

  it('should fetch today board dashboard successfully with counters and queue', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch(`${context.baseUrl}/reception/dashboard?branchId=${context.branchId}&date=${today}`, {
      method: 'GET',
      headers: context.authHeaders
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.columns);
    assert.ok(body.counters);
    assert.ok(Array.isArray(body.queue));
  });

  it('should check-in patient successfully and add to waitlist queue', async () => {
    const res = await fetch(`${context.baseUrl}/reception/checkin`, {
      method: 'POST',
      headers: context.authHeaders,
      body: JSON.stringify({
        appointmentId,
        priority: 'NORMAL'
      })
    });

    if (res.status !== 201) {
      console.log('CHECKIN FAILED Status:', res.status, 'Body:', await res.text());
    }

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.queueRecord);
    assert.ok(body.queueRecord.id);
    assert.equal(body.queueRecord.queueStatus, 'WAITING');
    assert.equal(body.queueRecord.priority, 'NORMAL');
  });

  it('should update queue priority successfully', async () => {
    const res = await fetch(`${context.baseUrl}/reception/queue/${appointmentId}/priority`, {
      method: 'PATCH',
      headers: context.authHeaders,
      body: JSON.stringify({
        priority: 'VIP'
      })
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.priority, 'VIP');
  });

  it('should prepare and create invoice successfully', async () => {
    const res = await fetch(`${context.baseUrl}/reception/invoices`, {
      method: 'POST',
      headers: context.authHeaders,
      body: JSON.stringify({
        patientId,
        branchId: context.branchId,
        appointmentId,
        items: [
          {
            serviceId,
            quantity: 1,
            unitPrice: 1500,
            performerEmployeeId: employeeId
          }
        ],
        discountAmount: 0
      })
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.id);
    assert.equal(body.status, 'DRAFT');
    invoiceId = body.id;
  });

  it('should process invoice payment and log details inside cashier ledger successfully', async () => {
    const res = await fetch(`${context.baseUrl}/reception/invoices/${invoiceId}/pay`, {
      method: 'POST',
      headers: context.authHeaders,
      body: JSON.stringify({
        paymentMethod: 'CASH'
      })
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.status, 'PAID');

    // Verify Payment entity exists in DB
    const payment = await context.prisma.payment.findFirst({
      where: { invoiceId, tenantId: context.tenantId }
    });
    assert.ok(payment);
    assert.equal(payment.paymentMethod, 'CASH');
    assert.equal(Number(payment.amount), 1500);
  });

  it('should return a quick patient preview successfully', async () => {
    const res = await fetch(`${context.baseUrl}/reception/patient-preview/${patientId}`, {
      method: 'GET',
      headers: context.authHeaders
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.id, patientId);
    assert.ok(body.fullName);
  });
});
