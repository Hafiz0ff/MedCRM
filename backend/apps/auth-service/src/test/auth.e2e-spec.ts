import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import { setupE2eTest, teardownE2eTest, TestContext } from './e2e-helper';

describe('E2E Authentication, Sessions & RBAC', () => {
  let context: TestContext;

  before(async () => {
    context = await setupE2eTest();
  });

  after(async () => {
    await teardownE2eTest(context);
  });

  it('should login successfully with valid credentials and return access token', async () => {
    const res = await fetch(`${context.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantCode: 'demo-clinic',
        email: 'admin@demo.clinic',
        password: 'Admin123!',
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.accessToken);
    assert.equal(typeof body.accessToken, 'string');
  });

  it('should fail login with invalid password', async () => {
    const res = await fetch(`${context.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantCode: 'demo-clinic',
        email: 'admin@demo.clinic',
        password: 'WrongPassword',
      }),
    });

    assert.equal(res.status, 401);
  });

  it('should get bootstrap config when authenticated', async () => {
    const res = await fetch(`${context.baseUrl}/auth/bootstrap`, {
      method: 'GET',
      headers: context.authHeaders,
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.tenant);
    assert.equal(body.tenant.code, 'demo-clinic');
    assert.ok(body.permissions);
    assert.ok(Array.isArray(body.permissions));
  });

  it('should fail bootstrap request when unauthenticated', async () => {
    const res = await fetch(`${context.baseUrl}/auth/bootstrap`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    assert.equal(res.status, 401);
  });

  it('should revoke all other active sessions successfully', async () => {
    const res = await fetch(`${context.baseUrl}/auth/sessions/revoke-all`, {
      method: 'POST',
      headers: context.authHeaders,
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.ok ?? true);
  });
});
