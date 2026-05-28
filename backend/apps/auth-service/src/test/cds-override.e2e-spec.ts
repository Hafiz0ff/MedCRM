import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import { setupE2eTest, teardownE2eTest, TestContext } from './e2e-helper';

describe('E2E Clinical Decision Support & Override Flow', () => {
  let context: TestContext;
  let patientId: string;
  let encounterId: string;

  before(async () => {
    context = await setupE2eTest();

    // 1. Find seeded test patient
    const patient = await context.prisma.patient.findFirstOrThrow({
      where: { tenantId: context.tenantId },
    });
    patientId = patient.id;

    // 2. Clean up any existing allergies to avoid test contamination
    await context.prisma.patientAllergy.deleteMany({
      where: { patientId },
    });

    // 3. Create a severe penicillin allergy for the patient
    await context.prisma.patientAllergy.create({
      data: {
        tenantId: context.tenantId,
        patientId,
        allergenCode: 'ALL001', // Penicillins
        severity: 'severe',
        clinicalStatus: 'active',
        verificationStatus: 'confirmed',
      },
    });

    // 4. Find an active employee dynamically
    const doctor = await context.prisma.employee.findFirstOrThrow({
      where: { tenantId: context.tenantId },
    });

    // 5. Create a draft encounter for testing
    const encounter = await context.prisma.encounter.create({
      data: {
        tenantId: context.tenantId,
        patientId,
        encounterType: 'CONSULTATION',
        status: 'DRAFT',
        doctorEmployeeId: doctor.id,
        startedAt: new Date(),
      },
    });
    encounterId = encounter.id;
  });

  after(async () => {
    // Cleanup created data
    if (encounterId) {
      await context.prisma.prescription.deleteMany({ where: { encounterId } });
      await context.prisma.encounter.delete({ where: { id: encounterId } });
    }
    if (patientId) {
      await context.prisma.patientAllergy.deleteMany({ where: { patientId } });
    }
    await teardownE2eTest(context);
  });

  it('1. CDS check endpoint (/emr/cds/check) flags Amoxicillin as block-level allergy alert', async () => {
    const res = await fetch(`${context.baseUrl}/emr/cds/check`, {
      method: 'POST',
      headers: context.authHeaders,
      body: JSON.stringify({
        patientId,
        items: [
          {
            innCode: 'INN005', // Amoxicillin (matches ALL001 Penicillins)
            itemName: 'Амоксициллин капсулы 500мг',
            dose: 500,
            doseUnit: 'mg',
            frequencyPerDay: 3,
          },
        ],
      }),
    });

    assert.equal(res.status, 201); // NestJS @Post defaults to 201
    const alerts = await res.json();

    const allergyAlert = alerts.find((a: any) => a.ruleId === 'ALLERGY_ALERT');
    assert.ok(allergyAlert, 'Should find an allergy alert');
    assert.equal(allergyAlert.severity, 'block', 'Allergy alert severity should be block');
    assert.match(
      allergyAlert.title,
      /Аллергия на препарат/,
      'Title should indicate allergy warning',
    );
  });

  it('2. Saving a prescription with block alerts is blocked without override comment', async () => {
    const res = await fetch(`${context.baseUrl}/emr/encounters/${encounterId}/prescriptions`, {
      method: 'POST',
      headers: context.authHeaders,
      body: JSON.stringify({
        prescriptionType: 'MEDICATION',
        notes: 'Test notes',
        items: [
          {
            itemCode: 'INN005',
            itemName: 'Амоксициллин 500мг',
            innCode: 'INN005',
            dose: 500,
            doseUnit: 'mg',
            frequencyPerDay: 3,
            durationDays: 7,
            cdsOverridden: false,
            cdsOverrideReason: null,
          },
        ],
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(
      body.message,
      /заблокирован клиническим решением/,
      'Error message should explain CDS block',
    );
  });

  it('3. Saving a prescription with block alerts succeeds when override comment is supplied', async () => {
    const res = await fetch(`${context.baseUrl}/emr/encounters/${encounterId}/prescriptions`, {
      method: 'POST',
      headers: context.authHeaders,
      body: JSON.stringify({
        prescriptionType: 'MEDICATION',
        notes: 'Override test',
        items: [
          {
            itemCode: 'INN005',
            itemName: 'Амоксициллин 500мг',
            innCode: 'INN005',
            dose: 500,
            doseUnit: 'mg',
            frequencyPerDay: 3,
            durationDays: 7,
            cdsOverridden: true,
            cdsOverrideReason: 'Жизненная необходимость, пациент настаивает',
          },
        ],
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.id, 'Should return the created prescription');
    assert.equal(body.items[0].cdsOverridden, true);
    assert.equal(body.items[0].cdsOverrideReason, 'Жизненная необходимость, пациент настаивает');
  });

  it('4. Digital signature flow locks the encounter and logs to audit', async () => {
    // Pre-count audits
    const auditCountBefore = await context.prisma.auditLog.count({
      where: {
        tenantId: context.tenantId,
        action: 'encounter.signed',
        entityId: encounterId,
      },
    });

    const res = await fetch(`${context.baseUrl}/emr/encounters/${encounterId}/sign`, {
      method: 'POST',
      headers: context.authHeaders,
      body: JSON.stringify({
        signatureProvider: 'CryptoPro CSP',
        certificateSerial: '7B00192CA18EF12A09',
        signatureHash: 'SHA256:d57fe15f449b4048a7449b5b3282c4a8',
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.status, 'SIGNED');
    assert.equal(body.isLocked, true);

    // Verify encounter is locked in database
    const encInDb = await context.prisma.encounter.findUniqueOrThrow({
      where: { id: encounterId },
    });
    assert.equal(encInDb.status, 'SIGNED');
    assert.equal(encInDb.isLocked, true);

    // Verify audit log entry
    const auditCountAfter = await context.prisma.auditLog.count({
      where: {
        tenantId: context.tenantId,
        action: 'encounter.signed',
        entityId: encounterId,
      },
    });
    assert.equal(
      auditCountAfter - auditCountBefore,
      1,
      'Should have logged 1 new encounter.signed audit entry',
    );
  });
});
