import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRateLimitMiddleware } from './rate-limit.middleware';

function makeReq(ip: string, path: string, headers: Record<string, string> = {}, body?: any) {
  return {
    ip,
    path,
    originalUrl: path,
    headers: { ...headers },
    method: 'GET',
    body,
    socket: { remoteAddress: ip },
  } as any;
}

function makeRes() {
  return {
    statusCode: 200,
    body: undefined as any,
    headers: {} as Record<string, string>,
    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
    },
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

// Mock Redis client for testing rate limit behavior
class MockRedis {
  public triggerError = false;
  private store = new Map<string, number>();

  multi() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    return {
      incr(key: string) {
        if (self.triggerError) return this;
        const current = self.store.get(key) || 0;
        self.store.set(key, current + 1);
        return this;
      },
      expire() {
        return this;
      },
      async exec() {
        if (self.triggerError) {
          throw new Error('Redis connection lost');
        }
        // Return incremental counts
        const keys = Array.from(self.store.keys());
        const lastKey = keys[keys.length - 1] || 'default';
        const val = self.store.get(lastKey) || 1;
        return [[null, val]];
      },
    } as any;
  }
}

describe('Rate Limit Middleware Hardening', () => {
  it('allows requests below policy limit using local memory fallback in development', async () => {
    process.env.NODE_ENV = 'development';
    const middleware = createRateLimitMiddleware({ windowMs: 60_000, maxByPolicy: { public: 2 } });
    const res = makeRes();
    let nextCount = 0;

    await middleware(makeReq('127.0.0.1', '/api/v1/patients'), res, () => nextCount++);
    await middleware(makeReq('127.0.0.1', '/api/v1/patients'), res, () => nextCount++);

    assert.equal(nextCount, 2);
    assert.equal(res.statusCode, 200);
  });

  it('blocks requests above policy limit using local memory fallback in development', async () => {
    process.env.NODE_ENV = 'development';
    const middleware = createRateLimitMiddleware({ windowMs: 60_000, maxByPolicy: { public: 1 } });
    const first = makeRes();
    const second = makeRes();
    let nextCount = 0;

    await middleware(makeReq('127.0.0.1', '/api/v1/patients'), first, () => nextCount++);
    await middleware(makeReq('127.0.0.1', '/api/v1/patients'), second, () => nextCount++);

    assert.equal(nextCount, 1);
    assert.equal(second.statusCode, 429);
    assert.equal(second.body.error.code, 'RATE_LIMITED');
  });

  it('fails closed in production if Redis is missing and policy is not in failOpenPolicies', async () => {
    process.env.NODE_ENV = 'production';
    const middleware = createRateLimitMiddleware({
      maxByPolicy: { auth: 5 },
      failOpenPolicies: ['public'],
    }); // No redis client passed
    const res = makeRes();
    let nextCount = 0;

    await middleware(makeReq('127.0.0.1', '/api/v1/auth/login'), res, () => nextCount++);

    assert.equal(nextCount, 0);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.error.code, 'RATE_LIMIT_UNAVAILABLE');
  });

  it('fails open in production if Redis is missing but policy is in failOpenPolicies', async () => {
    process.env.NODE_ENV = 'production';
    const middleware = createRateLimitMiddleware({
      maxByPolicy: { public: 5 },
      failOpenPolicies: ['public'],
    }); // No redis client passed
    const res = makeRes();
    let nextCount = 0;

    await middleware(makeReq('127.0.0.1', '/api/v1/patients'), res, () => nextCount++);

    assert.equal(nextCount, 1);
    assert.equal(res.statusCode, 200);
  });

  it('fails closed if Redis client throws an error for protected policies', async () => {
    process.env.NODE_ENV = 'production';
    const redis = new MockRedis();
    redis.triggerError = true;

    const middleware = createRateLimitMiddleware(
      { maxByPolicy: { auth: 5 }, failOpenPolicies: ['public'] },
      redis as any,
    );
    const res = makeRes();
    let nextCount = 0;

    await middleware(makeReq('127.0.0.1', '/api/v1/auth/login'), res, () => nextCount++);

    assert.equal(nextCount, 0);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.error.code, 'RATE_LIMIT_UNAVAILABLE');
  });

  it('ignores spoofed x-forwarded-for header when request comes from untrusted source', async () => {
    process.env.NODE_ENV = 'development';
    const middleware = createRateLimitMiddleware({
      maxByPolicy: { public: 1 },
      trustedProxyCidrs: ['192.168.1.1'],
    });
    const req = makeReq('203.0.113.1', '/api/v1/patients', {
      'x-forwarded-for': '1.1.1.1',
    });
    const res = makeRes();
    let nextCount = 0;

    // First request from 203.0.113.1 should pass
    await middleware(req, res, () => nextCount++);
    assert.equal(nextCount, 1);

    // Second request from same untrusted remote IP but different x-forwarded-for should block
    const req2 = makeReq('203.0.113.1', '/api/v1/patients', {
      'x-forwarded-for': '2.2.2.2',
    });
    const res2 = makeRes();
    await middleware(req2, res2, () => {});
    assert.equal(res2.statusCode, 429); // Untrusted proxy X-Forwarded-For was ignored, so it rate-limits by remote IP
  });

  it('respects x-forwarded-for header when request comes from a trusted proxy CIDR', async () => {
    process.env.NODE_ENV = 'development';
    const middleware = createRateLimitMiddleware({
      maxByPolicy: { public: 1 },
      trustedProxyCidrs: ['192.168.1.0/24'],
    });

    const req = makeReq('192.168.1.15', '/api/v1/patients', {
      'x-forwarded-for': '1.1.1.1',
    });
    const res = makeRes();
    let nextCount = 0;
    await middleware(req, res, () => nextCount++);
    assert.equal(nextCount, 1);

    // Second request comes from different client IP behind the same trusted proxy
    const req2 = makeReq('192.168.1.20', '/api/v1/patients', {
      'x-forwarded-for': '2.2.2.2',
    });
    const res2 = makeRes();
    let nextCount2 = 0;
    await middleware(req2, res2, () => nextCount2++);
    assert.equal(nextCount2, 1); // Passes because client IPs are resolved differently
  });
});
