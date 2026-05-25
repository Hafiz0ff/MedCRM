import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupE2eTest, teardownE2eTest, TestContext } from './e2e-helper';

describe('E2E FHIR R4 Export Subsystem', () => {
  let context: TestContext;
  let patientId: string;
  let otherTenantPatientId: string | undefined;

  before(async () => {
    context = await setupE2eTest();

    // Use a patient seeded for the demo tenant. The seed script creates a
    // primary patient (p1) with an encounter, diagnosis (I10), prescription
    // (perindopril/MEDICATION) and a clinical observation — covering all
    // FHIR resource types this export emits.
    const patient = await context.prisma.patient.findFirstOrThrow({
      where: {
        tenantId: context.tenantId,
        encounters: { some: {} }
      }
    });
    patientId = patient.id;

    const otherTenant = await context.prisma.tenant.findFirst({
      where: { code: { not: 'demo-clinic' } }
    });
    if (otherTenant) {
      const cross = await context.prisma.patient.findFirst({
        where: { tenantId: otherTenant.id }
      });
      otherTenantPatientId = cross?.id;
    }
  });

  after(async () => {
    await teardownE2eTest(context);
  });

  it('returns a FHIR Bundle (collection) when no resourceType is provided', async () => {
    const res = await fetch(
      `${context.baseUrl}/emr/fhir/Bundle/Patient/${patientId}`,
      { method: 'GET', headers: context.authHeaders }
    );

    assert.equal(res.status, 200);
    assert.equal(
      res.headers.get('content-type')?.startsWith('application/fhir+json'),
      true,
      'Content-Type must be application/fhir+json'
    );

    const body = await res.json();
    assert.equal(body.resourceType, 'Bundle');
    assert.equal(body.type, 'collection');
    assert.equal(typeof body.id, 'string');
    assert.equal(typeof body.timestamp, 'string');
    assert.equal(typeof body.total, 'number');
    assert.ok(Array.isArray(body.entry));
    assert.equal(body.total, body.entry.length);

    const types = new Set<string>(
      body.entry.map((e: any) => e.resource?.resourceType)
    );
    assert.ok(types.has('Patient'), 'Bundle must include a Patient resource');

    const patient = body.entry.find(
      (e: any) => e.resource?.resourceType === 'Patient'
    )?.resource;
    assert.equal(patient.id, patientId);
    assert.ok(Array.isArray(patient.identifier));
    assert.ok(Array.isArray(patient.name));
  });

  it('returns a searchset Bundle with only Patient when resourceType=Patient', async () => {
    const res = await fetch(
      `${context.baseUrl}/emr/fhir/Bundle/Patient/${patientId}?resourceType=Patient`,
      { method: 'GET', headers: context.authHeaders }
    );

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.type, 'searchset');
    assert.equal(body.total, 1);
    assert.equal(body.entry[0].resource.resourceType, 'Patient');
    assert.equal(body.entry[0].search?.mode, 'match');
  });

  it('filters Encounter resources by dateFrom / dateTo', async () => {
    const longAgoFrom = '1900-01-01T00:00:00.000Z';
    const longAgoTo = '1900-12-31T23:59:59.000Z';

    const empty = await fetch(
      `${context.baseUrl}/emr/fhir/Bundle/Patient/${patientId}?resourceType=Encounter&dateFrom=${longAgoFrom}&dateTo=${longAgoTo}`,
      { method: 'GET', headers: context.authHeaders }
    );
    assert.equal(empty.status, 200);
    const emptyBody = await empty.json();
    assert.equal(emptyBody.type, 'searchset');
    assert.equal(emptyBody.total, 0);
    assert.deepEqual(emptyBody.entry, []);
  });

  it('rejects _format=xml with 406 Not Acceptable', async () => {
    const res = await fetch(
      `${context.baseUrl}/emr/fhir/Bundle/Patient/${patientId}?_format=xml`,
      { method: 'GET', headers: context.authHeaders }
    );
    assert.equal(res.status, 406);
  });

  it('rejects malformed date parameters with 400 Bad Request', async () => {
    const res = await fetch(
      `${context.baseUrl}/emr/fhir/Bundle/Patient/${patientId}?dateFrom=not-a-date`,
      { method: 'GET', headers: context.authHeaders }
    );
    assert.equal(res.status, 400);
  });

  it('returns 404 for non-existent patient', async () => {
    const res = await fetch(
      `${context.baseUrl}/emr/fhir/Bundle/Patient/00000000-0000-0000-0000-000000000000`,
      { method: 'GET', headers: context.authHeaders }
    );
    assert.equal(res.status, 404);
  });

  it('rejects cross-tenant patient access with 403/404', async () => {
    if (!otherTenantPatientId) {
      return;
    }
    const res = await fetch(
      `${context.baseUrl}/emr/fhir/Bundle/Patient/${otherTenantPatientId}`,
      { method: 'GET', headers: context.authHeaders }
    );
    assert.ok(
      res.status === 403 || res.status === 404,
      `Cross-tenant access should be denied (got ${res.status})`
    );
  });

  it('records an audit log entry for the export', async () => {
    const before = await context.prisma.auditLog.count({
      where: {
        tenantId: context.tenantId,
        action: 'emr.fhir.export',
        entityId: patientId
      }
    });

    const res = await fetch(
      `${context.baseUrl}/emr/fhir/Bundle/Patient/${patientId}?resourceType=Patient`,
      { method: 'GET', headers: context.authHeaders }
    );
    assert.equal(res.status, 200);

    const after = await context.prisma.auditLog.count({
      where: {
        tenantId: context.tenantId,
        action: 'emr.fhir.export',
        entityId: patientId
      }
    });

    assert.equal(
      after,
      before + 1,
      'A single audit log entry must be recorded per export'
    );

    const latest = await context.prisma.auditLog.findFirst({
      where: {
        tenantId: context.tenantId,
        action: 'emr.fhir.export',
        entityId: patientId
      },
      orderBy: { createdAt: 'desc' }
    });
    assert.ok(latest);
    assert.equal(latest!.entityType, 'patient');
    const payload = latest!.newValuesJson as Record<string, unknown> | null;
    assert.ok(payload);
    assert.equal(payload!.resourceType, 'Patient');
    assert.equal(payload!.format, 'json');
    assert.equal(payload!.total, 1);
  });
});
