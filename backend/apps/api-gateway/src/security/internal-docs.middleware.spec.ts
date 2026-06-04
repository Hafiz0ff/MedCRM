import assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import { describe, it } from 'node:test';
import { createInternalDocsMiddleware } from './internal-docs.middleware';

function makeReq(ip: string, headers: Record<string, string> = {}) {
  return {
    ip,
    headers: { ...headers },
    method: 'GET',
    socket: { remoteAddress: ip },
  } as any;
}

function makeRes() {
  return {
    statusCode: 200,
    body: undefined as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: any) {
      this.body = body;
      return this;
    },
  } as any;
}

class MockConfigService {
  constructor(private values: Record<string, string>) {}
  get(key: string, defaultValue?: string) {
    return this.values[key] ?? defaultValue;
  }
}

class MockVerifier {
  public mockResult: any = { ok: false };
  async verify() {
    return this.mockResult;
  }
}

describe('Internal Docs Middleware', () => {
  it('bypasses authentication in local/development environments when auth mode is none', async () => {
    const config = new MockConfigService({
      NODE_ENV: 'development',
      APP_ENV: 'local',
      INTERNAL_DOCS_AUTH_MODE: 'none',
    });
    const middleware = createInternalDocsMiddleware(config as any, {} as any);
    const res = makeRes();
    let nextCount = 0;

    await middleware(makeReq('127.0.0.1'), res, () => nextCount++);
    assert.equal(nextCount, 1);
    assert.equal(res.statusCode, 200);
  });

  it('fails closed in production environment when auth mode is none', async () => {
    const config = new MockConfigService({
      NODE_ENV: 'production',
      APP_ENV: 'production',
      INTERNAL_DOCS_AUTH_MODE: 'none',
    });
    const middleware = createInternalDocsMiddleware(config as any, {} as any);
    const res = makeRes();
    let nextCount = 0;

    await middleware(makeReq('127.0.0.1'), res, () => nextCount++);
    assert.equal(nextCount, 0);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error.code, 'SWAGGER_FORBIDDEN');
  });

  it('allows access with a valid API key', async () => {
    const key = 'secret-key-123';
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    const config = new MockConfigService({
      NODE_ENV: 'production',
      INTERNAL_DOCS_AUTH_MODE: 'api-key',
      INTERNAL_DOCS_API_KEY_HASH: hash,
    });
    const middleware = createInternalDocsMiddleware(config as any, {} as any);
    const res = makeRes();
    let nextCount = 0;

    await middleware(makeReq('127.0.0.1', { 'x-internal-docs-key': key }), res, () => nextCount++);
    assert.equal(nextCount, 1);
  });

  it('rejects access with an invalid API key', async () => {
    const key = 'secret-key-123';
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    const config = new MockConfigService({
      NODE_ENV: 'production',
      INTERNAL_DOCS_AUTH_MODE: 'api-key',
      INTERNAL_DOCS_API_KEY_HASH: hash,
    });
    const middleware = createInternalDocsMiddleware(config as any, {} as any);
    const res = makeRes();
    let nextCount = 0;

    await middleware(
      makeReq('127.0.0.1', { 'x-internal-docs-key': 'wrong-key' }),
      res,
      () => nextCount++,
    );
    assert.equal(nextCount, 0);
    assert.equal(res.statusCode, 401);
  });

  it('allows access for IPs within allowlist', async () => {
    const config = new MockConfigService({
      NODE_ENV: 'production',
      INTERNAL_DOCS_AUTH_MODE: 'ip-allowlist',
      INTERNAL_DOCS_ALLOWED_IPS: '192.168.1.5, 10.0.0.0/24',
    });
    const middleware = createInternalDocsMiddleware(config as any, {} as any);
    const res = makeRes();
    let nextCount = 0;

    await middleware(makeReq('192.168.1.5'), res, () => nextCount++);
    assert.equal(nextCount, 1);

    nextCount = 0;
    await middleware(makeReq('10.0.0.42'), res, () => nextCount++);
    assert.equal(nextCount, 1);
  });

  it('denies access for IPs outside allowlist', async () => {
    const config = new MockConfigService({
      NODE_ENV: 'production',
      INTERNAL_DOCS_AUTH_MODE: 'ip-allowlist',
      INTERNAL_DOCS_ALLOWED_IPS: '192.168.1.5, 10.0.0.0/24',
    });
    const middleware = createInternalDocsMiddleware(config as any, {} as any);
    const res = makeRes();
    let nextCount = 0;

    await middleware(makeReq('192.168.1.6'), res, () => nextCount++);
    assert.equal(nextCount, 0);
    assert.equal(res.statusCode, 403);
  });

  it('allows access for admins in jwt-admin mode', async () => {
    const config = new MockConfigService({
      NODE_ENV: 'production',
      INTERNAL_DOCS_AUTH_MODE: 'jwt-admin',
    });
    const verifier = new MockVerifier();
    verifier.mockResult = {
      ok: true,
      principal: {
        userId: 'user-1',
        tenantId: 'tenant-1',
        branchIds: [],
        roles: ['Admin'],
        permissions: [],
      },
    };
    const middleware = createInternalDocsMiddleware(config as any, verifier as any);
    const res = makeRes();
    let nextCount = 0;

    await middleware(
      makeReq('127.0.0.1', { authorization: 'Bearer some-token' }),
      res,
      () => nextCount++,
    );
    assert.equal(nextCount, 1);
  });

  it('denies access for non-admins in jwt-admin mode', async () => {
    const config = new MockConfigService({
      NODE_ENV: 'production',
      INTERNAL_DOCS_AUTH_MODE: 'jwt-admin',
    });
    const verifier = new MockVerifier();
    verifier.mockResult = {
      ok: true,
      principal: {
        userId: 'user-1',
        tenantId: 'tenant-1',
        branchIds: [],
        roles: ['User'],
        permissions: [],
      },
    };
    const middleware = createInternalDocsMiddleware(config as any, verifier as any);
    const res = makeRes();
    let nextCount = 0;

    await middleware(
      makeReq('127.0.0.1', { authorization: 'Bearer some-token' }),
      res,
      () => nextCount++,
    );
    assert.equal(nextCount, 0);
    assert.equal(res.statusCode, 403);
  });
});
