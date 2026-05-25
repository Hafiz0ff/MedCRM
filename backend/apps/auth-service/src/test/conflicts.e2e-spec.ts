import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupE2eTest, teardownE2eTest, TestContext } from './e2e-helper';

describe('E2E Scheduling Conflict & Prevention Tests', () => {
  let context: TestContext;
  let patientId: string;
  let employeeId: string;
  let serviceId: string;

  // Generate a completely unique days offset for this test run to avoid time-slot conflicts
  const testDaysOffset = 1100 + Math.floor(Math.random() * 500);

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
  });

  after(async () => {
    await teardownE2eTest(context);
  });

  it('should successfully book a valid slot, but block double-booking for the same doctor at the same time', async () => {
    const startAt = new Date();
    startAt.setDate(startAt.getDate() + testDaysOffset);
    // Ensure we are on a weekday (Monday-Friday) for schedule checks
    const day = startAt.getDay();
    if (day === 0) startAt.setDate(startAt.getDate() + 1);
    else if (day === 6) startAt.setDate(startAt.getDate() + 2);
    startAt.setHours(12, 0, 0, 0);

    const endAt = new Date(startAt);
    endAt.setMinutes(endAt.getMinutes() + 30);

    // 1. Create first appointment (should succeed)
    const res1 = await fetch(`${context.baseUrl}/appointments`, {
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
        appointmentType: 'CONSULTATION'
      })
    });

    assert.equal(res1.status, 201);
    const body1 = await res1.json();
    assert.ok(body1.id);

    // 2. Try to create second overlapping appointment for the same doctor (should fail due to conflict)
    const res2 = await fetch(`${context.baseUrl}/appointments`, {
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
        appointmentType: 'CONSULTATION'
      })
    });

    assert.equal(res2.status, 400);
    const body2 = await res2.json();
    assert.ok(
      body2.message.includes('occupied') ||
      body2.message.includes('conflict') ||
      body2.message.includes('overlap') ||
      body2.message.includes('schedule') ||
      body2.message.includes('hours')
    );
  });

  it('should block booking if time is outside of doctor working schedule hours', async () => {
    const startAt = new Date();
    startAt.setDate(startAt.getDate() + testDaysOffset + 1); // Add 1 day to be different
    // Ensure we are on a weekday (Monday-Friday) for schedule checks
    const day = startAt.getDay();
    if (day === 0) startAt.setDate(startAt.getDate() + 1);
    else if (day === 6) startAt.setDate(startAt.getDate() + 2);
    startAt.setHours(3, 0, 0, 0); // 3:00 AM (outside working hours)

    const endAt = new Date(startAt);
    endAt.setMinutes(endAt.getMinutes() + 30);

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
        appointmentType: 'CONSULTATION'
      })
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(
      body.message.includes('schedule') ||
      body.message.includes('hours') ||
      body.message.includes('restricted') ||
      body.message.includes('bookings')
    );
  });
});
