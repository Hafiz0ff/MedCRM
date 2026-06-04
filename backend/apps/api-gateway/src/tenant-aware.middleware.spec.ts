import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TenantAwareMiddleware } from './tenant-aware.middleware';

function makeReq(path: string, headers: Record<string, string> = {}, method = 'GET') {
  return {
    path,
    headers: { ...headers },
    method,
    query: {},
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

class MockPrisma {
  public mockTenant: any = null;
  public throwError = false;

  tenant = {
    findFirst: async () => {
      if (this.throwError) {
        throw new Error('Database outage');
      }
      return this.mockTenant;
    },
  };
}

class MockRedis {
  public store = new Map<string, string>();
  public throwError = false;

  async get(key: string) {
    if (this.throwError) {
      throw new Error('Redis outage');
    }
    return this.store.get(key) || null;
  }

  async setex(key: string, secs: number, val: string) {
    this.store.set(key, val);
  }
}

class MockConfigService {
  constructor(private values: Record<string, string>) {}
  get(key: string, defaultValue?: string) {
    return this.values[key] ?? defaultValue;
  }
}

describe('TenantAwareMiddleware', () => {
  it('bypasses parsing if matched route has no tenant requirement', async () => {
    // '/internal/v1/auth' has tenantRequirement: 'none'
    const prisma = new MockPrisma();
    const redis = new MockRedis();
    const config = new MockConfigService({});
    const middleware = new TenantAwareMiddleware(prisma as any, redis as any, config as any);

    const req = makeReq('/internal/v1/auth');
    const res = makeRes();
    let nextCalled = 0;

    await middleware.use(req, res, () => nextCalled++);
    assert.equal(nextCalled, 1);
    assert.equal(res.statusCode, 200);
  });

  it('fails with 400 if tenant context is required but missing', async () => {
    // '/api/v1/patients' has tenantRequirement: 'required'
    const prisma = new MockPrisma();
    const redis = new MockRedis();
    const config = new MockConfigService({});
    const middleware = new TenantAwareMiddleware(prisma as any, redis as any, config as any);

    const req = makeReq('/api/v1/patients');
    const res = makeRes();
    let nextCalled = 0;

    await middleware.use(req, res, () => nextCalled++);
    assert.equal(nextCalled, 0);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error.code, 'TENANT_CONTEXT_REQUIRED');
  });

  it('fails with 400 if tenant context is required but resolved tenant is not found', async () => {
    const prisma = new MockPrisma();
    prisma.mockTenant = null; // not found
    const redis = new MockRedis();
    const config = new MockConfigService({});
    const middleware = new TenantAwareMiddleware(prisma as any, redis as any, config as any);

    const req = makeReq('/api/v1/patients', { 'x-tenant-id': 'non-existent' });
    const res = makeRes();
    let nextCalled = 0;

    await middleware.use(req, res, () => nextCalled++);
    assert.equal(nextCalled, 0);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error.code, 'TENANT_CONTEXT_INVALID');
  });

  it('fails closed with 503 if database lookup throws error and route is required', async () => {
    const prisma = new MockPrisma();
    prisma.throwError = true;
    const redis = new MockRedis();
    const config = new MockConfigService({});
    const middleware = new TenantAwareMiddleware(prisma as any, redis as any, config as any);

    const req = makeReq('/api/v1/patients', { 'x-tenant-id': 'tenant-id' });
    const res = makeRes();
    let nextCalled = 0;

    await middleware.use(req, res, () => nextCalled++);
    assert.equal(nextCalled, 0);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.error.code, 'TENANT_VALIDATION_UNAVAILABLE');
  });

  it('allows access and propagates headers if tenant is active', async () => {
    const prisma = new MockPrisma();
    prisma.mockTenant = { id: 'tenant-123', code: 'tenant-code', status: 'ACTIVE' };
    const redis = new MockRedis();
    const config = new MockConfigService({});
    const middleware = new TenantAwareMiddleware(prisma as any, redis as any, config as any);

    const req = makeReq('/api/v1/patients', { 'x-tenant-id': 'tenant-123' });
    const res = makeRes();
    let nextCalled = 0;

    await middleware.use(req, res, () => nextCalled++);
    assert.equal(nextCalled, 1);
    assert.equal(res.statusCode, 200);
    assert.equal(req.headers['x-tenant-id'], 'tenant-123');
    assert.equal(req.headers['x-tenant-code'], 'tenant-code');
  });

  it('blocks non-GET write operations for suspended/past_due tenants', async () => {
    const prisma = new MockPrisma();
    prisma.mockTenant = { id: 'tenant-123', code: 'tenant-code', status: 'SUSPENDED' };
    const redis = new MockRedis();
    const config = new MockConfigService({});
    const middleware = new TenantAwareMiddleware(prisma as any, redis as any, config as any);

    // POST request should block
    const reqPost = makeReq('/api/v1/patients', { 'x-tenant-id': 'tenant-123' }, 'POST');
    const resPost = makeRes();
    let nextCalled = 0;

    await middleware.use(reqPost, resPost, () => nextCalled++);
    assert.equal(nextCalled, 0);
    assert.equal(resPost.statusCode, 403);
    assert.equal(resPost.body.error.code, 'TENANT_SUSPENDED');

    // GET request should pass
    const reqGet = makeReq('/api/v1/patients', { 'x-tenant-id': 'tenant-123' }, 'GET');
    const resGet = makeRes();
    let nextCalledGet = 0;

    await middleware.use(reqGet, resGet, () => nextCalledGet++);
    assert.equal(nextCalledGet, 1);
    assert.equal(resGet.statusCode, 200);
  });
});
