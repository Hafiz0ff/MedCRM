import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FactEtlProcessor } from './fact-etl.processor';
import { MlClient } from './ml.client';

describe('FactEtlProcessor aggregates calculations', () => {
  it('correctly compiles appointments and payments facts', async () => {
    let dwFactApptsDeleted = false;
    let dwFactApptsCreated: any[] = [];
    let dwFactPaymentsDeleted = false;
    let dwFactPaymentsCreated: any[] = [];

    // Mock PrismaService
    const mockPrisma = {
      appointment: {
        findMany: async () => [
          {
            tenantId: 'tenant-123',
            branchId: 'branch-1',
            patientId: 'patient-1',
            employeeId: 'doc-1',
            serviceId: 'srv-1',
            status: 'COMPLETED',
            bookingSource: 'PORTAL',
            durationMinutes: 30,
            createdAt: new Date(),
            startAt: new Date(),
          },
          {
            tenantId: 'tenant-123',
            branchId: 'branch-1',
            patientId: 'patient-2',
            employeeId: 'doc-1',
            serviceId: 'srv-1',
            status: 'MISSED',
            bookingSource: 'OFFLINE',
            durationMinutes: 30,
            createdAt: new Date(),
            startAt: new Date(),
          },
        ],
      },
      dwFactAppointment: {
        deleteMany: async () => {
          dwFactApptsDeleted = true;
          return { count: 2 };
        },
        createMany: async ({ data }: any) => {
          dwFactApptsCreated = data;
          return { count: data.length };
        },
      },
      payment: {
        findMany: async () => [
          {
            tenantId: 'tenant-123',
            branchId: 'branch-1',
            invoiceId: 'inv-1',
            patientId: 'patient-1',
            paymentMethod: 'CASH',
            amount: 1500,
            status: 'COMPLETED',
            paidAt: new Date(),
          },
        ],
      },
      dwFactPayment: {
        deleteMany: async () => {
          dwFactPaymentsDeleted = true;
          return { count: 1 };
        },
        createMany: async ({ data }: any) => {
          dwFactPaymentsCreated = data;
          return { count: data.length };
        },
      },
      patient: {
        findMany: async () => [],
      },
      dwFactMarketing: {
        deleteMany: async () => {},
      },
      financialDailyAggregate: {
        deleteMany: async () => {},
        createMany: async () => {},
      },
      doctorKpiMetric: {
        deleteMany: async () => {},
        createMany: async () => {},
      },
      employee: {
        findMany: async () => [],
      },
      realtimeMetricCache: {
        deleteMany: async () => {},
        createMany: async () => {},
      },
      visitQueue: {
        count: async () => 0,
      },
    } as any;

    const mockClickHouse = {
      isEnabled: () => false,
    } as any;

    const etl = new FactEtlProcessor(mockPrisma, mockClickHouse);
    await etl.runEtl('tenant-123');

    assert.equal(dwFactApptsDeleted, true);
    assert.equal(dwFactApptsCreated.length, 2);
    assert.equal(dwFactApptsCreated[0].completedFlag, true);
    assert.equal(dwFactApptsCreated[1].noShowFlag, true);

    assert.equal(dwFactPaymentsDeleted, true);
    assert.equal(dwFactPaymentsCreated.length, 1);
    assert.equal(Number(dwFactPaymentsCreated[0].amount), 1500);
  });
});

describe('MlClient risk classification model', () => {
  it('correctly maps show show rates and booking source risks', async () => {
    // Mock PrismaService for patient show show metrics
    const mockPrisma = {
      appointment: {
        findUnique: async () => ({
          tenantId: 'tenant-123',
          patientId: 'patient-1',
          priority: 'NORMAL',
          bookingSource: 'MARKETPLACE',
          startAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // в будущем
          createdAt: new Date(),
        }),
      },
      patientCrmMetric: {
        findUnique: async () => ({
          missedAppointments: 3,
        }),
      },
    } as any;

    const client = new MlClient({ get: () => '' } as any, mockPrisma);
    const result = await client.predictNoShow('tenant-123', 'appt-1');

    assert.equal(result.riskCategory, 'HIGH');
    assert.ok(result.riskScore > 0.5);
    assert.ok(result.reasons.some((r) => r.includes('более 2 приёмов')));
  });
});
