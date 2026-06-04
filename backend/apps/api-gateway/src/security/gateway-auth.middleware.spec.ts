import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GatewayRouteConfig } from '../gateway-route.config';
import { createGatewayAuthMiddleware } from './gateway-auth.middleware';
import { GatewayAuthResult } from './gateway-auth.types';

// Mock verifier service
class MockJwtVerifier {
  constructor(private readonly mockResult: GatewayAuthResult) {}
  async verify(): Promise<GatewayAuthResult> {
    return this.mockResult;
  }
}

function makeRoute(requiresAuth: boolean): GatewayRouteConfig {
  return {
    kind: 'public',
    gatewayPrefix: '/api/v1/patients',
    upstreamPrefix: '/patients',
    targetEnv: 'AUTH_SERVICE_URL',
    rateLimitPolicy: 'public',
    requiresAuth,
    tenantRequirement: 'required',
    description: 'Test Route',
  };
}

function makeReq(authHeader?: string, headers: Record<string, string> = {}) {
  const reqHeaders: Record<string, string> = { ...headers };
  if (authHeader) {
    reqHeaders['authorization'] = authHeader;
  }
  return {
    headers: reqHeaders,
    path: '/api/v1/patients',
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

describe('createGatewayAuthMiddleware', () => {
  it('public route without token passes', async () => {
    const route = makeRoute(false);
    const verifier = new MockJwtVerifier({
      ok: false,
      code: 'AUTH_TOKEN_MISSING',
      message: '',
    }) as any;
    const middleware = createGatewayAuthMiddleware(route, verifier);
    const req = makeReq();
    const res = makeRes();
    let nextCount = 0;

    await middleware(req, res, () => nextCount++);

    assert.equal(nextCount, 1);
    assert.equal(res.statusCode, 200);
  });

  it('protected route without token returns 401', async () => {
    const route = makeRoute(true);
    const verifier = new MockJwtVerifier({
      ok: false,
      code: 'AUTH_TOKEN_MISSING',
      message: '',
    }) as any;
    const middleware = createGatewayAuthMiddleware(route, verifier);
    const req = makeReq();
    const res = makeRes();
    let nextCount = 0;

    await middleware(req, res, () => nextCount++);

    assert.equal(nextCount, 0);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'AUTH_TOKEN_MISSING');
  });

  it('protected route with malformed token returns 401', async () => {
    const route = makeRoute(true);
    const verifier = new MockJwtVerifier({
      ok: false,
      code: 'AUTH_TOKEN_INVALID',
      message: 'Invalid signature',
    }) as any;
    const middleware = createGatewayAuthMiddleware(route, verifier);
    const req = makeReq('Bearer malformed_token');
    const res = makeRes();
    let nextCount = 0;

    await middleware(req, res, () => nextCount++);

    assert.equal(nextCount, 0);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error.code, 'AUTH_TOKEN_INVALID');
  });

  it('protected route with expired token returns 401', async () => {
    const route = makeRoute(true);
    const verifier = new MockJwtVerifier({
      ok: false,
      code: 'AUTH_TOKEN_EXPIRED',
      message: 'Token has expired',
    }) as any;
    const middleware = createGatewayAuthMiddleware(route, verifier);
    const req = makeReq('Bearer expired_token');
    const res = makeRes();
    let nextCount = 0;

    await middleware(req, res, () => nextCount++);

    assert.equal(nextCount, 0);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error.code, 'AUTH_TOKEN_EXPIRED');
  });

  it('protected route with valid token sets trusted identity headers', async () => {
    const route = makeRoute(true);
    const verifier = new MockJwtVerifier({
      ok: true,
      principal: {
        userId: 'user-123',
        tenantId: 'tenant-456',
        branchIds: ['branch-789'],
        roles: ['staff'],
        permissions: ['patients.read'],
      },
    }) as any;
    const middleware = createGatewayAuthMiddleware(route, verifier);
    const req = makeReq('Bearer valid_token');
    const res = makeRes();
    let nextCount = 0;

    await middleware(req, res, () => nextCount++);

    assert.equal(nextCount, 1);
    assert.equal(req.headers['x-user-id'], 'user-123');
    assert.equal(req.headers['x-tenant-id'], 'tenant-456');
    assert.equal(req.headers['x-branch-id'], 'branch-789');
    assert.equal(req.headers['x-roles'], 'staff');
    assert.equal(req.headers['x-permissions'], 'patients.read');
  });

  it('client-provided identity headers are overwritten/stripped', async () => {
    const route = makeRoute(true);
    const verifier = new MockJwtVerifier({
      ok: true,
      principal: {
        userId: 'user-123',
        tenantId: 'tenant-456',
        branchIds: ['branch-789'],
        roles: ['staff'],
        permissions: ['patients.read'],
      },
    }) as any;
    const middleware = createGatewayAuthMiddleware(route, verifier);
    const req = makeReq('Bearer valid_token', {
      'x-user-id': 'hacker-user',
      'x-tenant-id': 'tenant-456',
      'x-roles': 'admin',
    });
    const res = makeRes();

    await middleware(req, res, () => {});

    assert.equal(req.headers['x-user-id'], 'user-123');
    assert.equal(req.headers['x-tenant-id'], 'tenant-456');
    assert.equal(req.headers['x-roles'], 'staff');
  });

  it('missing tenantId in JWT returns 403', async () => {
    const route = makeRoute(true);
    const verifier = new MockJwtVerifier({
      ok: false,
      code: 'TENANT_CONTEXT_MISSING',
      message: 'Tenant context missing in token payload',
    }) as any;
    const middleware = createGatewayAuthMiddleware(route, verifier);
    const req = makeReq('Bearer token_without_tenant');
    const res = makeRes();

    await middleware(req, res, () => {});

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error.code, 'TENANT_CONTEXT_MISSING');
  });

  it('tenant mismatch between client header and JWT returns 403', async () => {
    const route = makeRoute(true);
    const verifier = new MockJwtVerifier({
      ok: true,
      principal: {
        userId: 'user-123',
        tenantId: 'tenant-456',
        branchIds: ['branch-789'],
        roles: ['staff'],
        permissions: ['patients.read'],
      },
    }) as any;
    const middleware = createGatewayAuthMiddleware(route, verifier);
    const req = makeReq('Bearer valid_token', {
      'x-tenant-id': 'different-tenant-777',
    });
    const res = makeRes();

    await middleware(req, res, () => {});

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error.code, 'TENANT_MISMATCH');
  });
});
