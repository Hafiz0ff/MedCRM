import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import { setupE2eTest, teardownE2eTest, TestContext } from './e2e-helper';

describe('E2E Appointments & Smart Scheduling', () => {
  let context: TestContext;
  let patientId: string;
  let employeeId: string;
  let serviceId: string;
  let appointmentId: string;

  // Generate a completely unique days offset for this test run to avoid time-slot conflicts
  const testDaysOffset = 100 + Math.floor(Math.random() * 500);

  before(async () => {
    context = await setupE2eTest();

    // Retrieve seeded patient, employee, and service
    const patient = await context.prisma.patient.findFirstOrThrow({
      where: { tenantId: context.tenantId },
    });
    patientId = patient.id;

    const employee = await context.prisma.employee.findFirstOrThrow({
      where: { tenantId: context.tenantId },
    });
    employeeId = employee.id;

    const service = await context.prisma.service.findFirstOrThrow({
      where: { tenantId: context.tenantId, code: 'consultation' },
    });
    serviceId = service.id;
  });

  after(async () => {
    await teardownE2eTest(context);
  });

  it('should create an appointment successfully', async () => {
    const startAt = new Date();
    startAt.setDate(startAt.getDate() + testDaysOffset);
    startAt.setHours(10, 0, 0, 0);

    const endAt = new Date(startAt);
    endAt.setMinutes(endAt.getMinutes() + 30); // 30 mins later

    const res = await fetch(`${context.baseUrl}/appointments`, {
      method: 'POST',
      headers: context.authHeaders,
      body: JSON.stringify({
        branchId: context.branchId,
        patientId,
        employeeId,
        serviceId,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        bookingSource: 'ADMIN_PANEL',
        appointmentType: 'CONSULTATION',
        notes: 'E2E Test Booking',
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.id);
    assert.equal(body.status, 'SCHEDULED');
    appointmentId = body.id;
  });

  it('should transition appointment status to IN_PROGRESS', async () => {
    const res = await fetch(`${context.baseUrl}/appointments/${appointmentId}/start`, {
      method: 'POST',
      headers: context.authHeaders,
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.status, 'IN_PROGRESS');
  });

  it('should transition appointment status to COMPLETED', async () => {
    const res = await fetch(`${context.baseUrl}/appointments/${appointmentId}/complete`, {
      method: 'POST',
      headers: context.authHeaders,
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.status, 'COMPLETED');
  });

  it('should create a recurring appointment series successfully', async () => {
    const startAt = new Date();
    startAt.setDate(startAt.getDate() + testDaysOffset + 10);
    startAt.setHours(14, 0, 0, 0);

    const endAt = new Date(startAt);
    endAt.setMinutes(endAt.getMinutes() + 30);

    const endDate = new Date(startAt);
    endDate.setDate(endDate.getDate() + 15);

    const res = await fetch(`${context.baseUrl}/appointments/recurring`, {
      method: 'POST',
      headers: context.authHeaders,
      body: JSON.stringify({
        branchId: context.branchId,
        patientId,
        employeeId,
        serviceId,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        bookingSource: 'ADMIN_PANEL',
        appointmentType: 'CONSULTATION',
        recurrence: {
          recurrenceType: 'WEEKLY',
          interval: 1,
          endDate: endDate.toISOString().slice(0, 10),
        },
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.total >= 1);
    assert.ok(Array.isArray(body.appointments));
  });

  it('should register a patient to the waiting list successfully', async () => {
    const preferredDateFrom = new Date().toISOString().slice(0, 10);
    const preferredDateTo = new Date();
    preferredDateTo.setDate(preferredDateTo.getDate() + 7);

    const res = await fetch(`${context.baseUrl}/waiting-list`, {
      method: 'POST',
      headers: context.authHeaders,
      body: JSON.stringify({
        patientId,
        branchId: context.branchId,
        preferredDateFrom,
        preferredDateTo: preferredDateTo.toISOString().slice(0, 10),
        preferredTimeFrom: '09:00',
        preferredTimeTo: '18:00',
        serviceId,
        priority: 'NORMAL',
        notes: 'Want morning slot',
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.id);
    assert.equal(body.status, 'ACTIVE');
  });
});
