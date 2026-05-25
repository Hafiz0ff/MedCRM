import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import { setupE2eTest, teardownE2eTest, TestContext } from './e2e-helper';

describe('E2E Patients & CRM CRUD Subsystem', () => {
  let context: TestContext;
  let patientId: string;
  let tagId: string;
  let contactId: string;

  before(async () => {
    context = await setupE2eTest();
    // Retrieve seeded tag
    const tag = await context.prisma.crmTag.findFirst({
      where: { tenantId: context.tenantId },
    });
    if (tag) {
      tagId = tag.id;
    } else {
      const createdTag = await context.prisma.crmTag.create({
        data: {
          tenantId: context.tenantId,
          name: 'E2E Test Tag',
          code: 'E2E_TEST',
          color: '#FF0000',
        },
      });
      tagId = createdTag.id;
    }
  });

  after(async () => {
    await teardownE2eTest(context);
  });

  it('should create a new patient successfully', async () => {
    const res = await fetch(`${context.baseUrl}/patients`, {
      method: 'POST',
      headers: context.authHeaders,
      body: JSON.stringify({
        firstName: 'Иван',
        lastName: 'Тестов',
        birthDate: '1990-05-15',
        gender: 'MALE',
        phone: '+79998887766',
        email: 'ivan.test@example.com',
        registrationBranchId: context.branchId,
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.id);
    assert.equal(body.firstName, 'Иван');
    assert.equal(body.lastName, 'Тестов');
    patientId = body.id;
  });

  it('should fetch patient details successfully', async () => {
    const res = await fetch(`${context.baseUrl}/patients/${patientId}`, {
      method: 'GET',
      headers: context.authHeaders,
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.id, patientId);
    assert.equal(body.firstName, 'Иван');
  });

  it('should manage patient contacts (CRUD)', async () => {
    // 1. Add contact
    const addRes = await fetch(`${context.baseUrl}/patients/${patientId}/contacts`, {
      method: 'POST',
      headers: context.authHeaders,
      body: JSON.stringify({
        type: 'EMAIL',
        value: 'test-alt@example.com',
        isPrimary: false,
      }),
    });

    if (addRes.status !== 201) {
      console.log('ADD CONTACT FAILED Status:', addRes.status, 'Body:', await addRes.text());
    }

    assert.equal(addRes.status, 201);
    const addBody = await addRes.json();
    assert.ok(addBody.id);
    contactId = addBody.id;

    // 2. Update contact
    const updateRes = await fetch(
      `${context.baseUrl}/patients/${patientId}/contacts/${contactId}`,
      {
        method: 'PATCH',
        headers: context.authHeaders,
        body: JSON.stringify({
          value: 'test-updated@example.com',
        }),
      },
    );

    assert.equal(updateRes.status, 200);
    const updateBody = await updateRes.json();
    assert.equal(updateBody.value, 'test-updated@example.com');

    // 3. Delete contact
    const deleteRes = await fetch(
      `${context.baseUrl}/patients/${patientId}/contacts/${contactId}`,
      {
        method: 'DELETE',
        headers: context.authHeaders,
      },
    );

    assert.equal(deleteRes.status, 200);
  });

  it('should assign and remove CRM tags', async () => {
    // 1. Assign Tag
    const assignRes = await fetch(`${context.baseUrl}/patients/${patientId}/tags/${tagId}`, {
      method: 'POST',
      headers: context.authHeaders,
    });

    assert.equal(assignRes.status, 201);

    // 2. Remove Tag
    const removeRes = await fetch(`${context.baseUrl}/patients/${patientId}/tags/${tagId}`, {
      method: 'DELETE',
      headers: context.authHeaders,
    });

    assert.equal(removeRes.status, 200);
  });

  it('should update patient status successfully', async () => {
    const res = await fetch(`${context.baseUrl}/patients/${patientId}/status`, {
      method: 'PATCH',
      headers: context.authHeaders,
      body: JSON.stringify({
        status: 'ACTIVE',
      }),
    });

    if (res.status !== 200) {
      console.log('UPDATE STATUS FAILED Status:', res.status, 'Body:', await res.text());
    }

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ACTIVE');
  });

  it('should fetch chronological timeline history successfully', async () => {
    const res = await fetch(`${context.baseUrl}/patients/${patientId}/timeline`, {
      method: 'GET',
      headers: context.authHeaders,
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body));
  });

  it('should merge secondary duplicate patient into primary patient', async () => {
    // 1. Create a secondary patient
    const createSecRes = await fetch(`${context.baseUrl}/patients`, {
      method: 'POST',
      headers: context.authHeaders,
      body: JSON.stringify({
        firstName: 'Иван',
        lastName: 'Тестов (Дубликат)',
        birthDate: '1990-05-15',
        gender: 'MALE',
        registrationBranchId: context.branchId,
      }),
    });

    assert.equal(createSecRes.status, 201);
    const secondary = await createSecRes.json();
    const secondaryId = secondary.id;

    // 2. Merge them
    const mergeRes = await fetch(`${context.baseUrl}/patients/merge`, {
      method: 'POST',
      headers: context.authHeaders,
      body: JSON.stringify({
        primaryPatientId: patientId,
        secondaryPatientId: secondaryId,
      }),
    });

    assert.equal(mergeRes.status, 201);

    // 3. Verify secondary patient is marked as ARCHIVED
    const fetchSecRes = await fetch(`${context.baseUrl}/patients/${secondaryId}`, {
      method: 'GET',
      headers: context.authHeaders,
    });

    assert.equal(fetchSecRes.status, 200);
    const secBody = await fetchSecRes.json();
    assert.equal(secBody.status, 'ARCHIVED');
  });
});
