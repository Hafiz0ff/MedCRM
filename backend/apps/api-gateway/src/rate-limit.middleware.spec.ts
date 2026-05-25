import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRateLimitMiddleware } from './rate-limit.middleware';

function makeReq(ip: string, path: string) {
  return { ip, path, originalUrl: path, headers: {}, method: 'GET' } as any;
}

function makeRes() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  } as any;
}

describe('createRateLimitMiddleware', () => {
  it('allows requests below policy limit', () => {
    const middleware = createRateLimitMiddleware({ windowMs: 60_000, maxByPolicy: { public: 2 } });
    const res = makeRes();
    let nextCount = 0;

    middleware(makeReq('127.0.0.1', '/api/v1/patients'), res, () => nextCount++);
    middleware(makeReq('127.0.0.1', '/api/v1/patients'), res, () => nextCount++);

    assert.equal(nextCount, 2);
    assert.equal(res.statusCode, 200);
  });

  it('blocks requests above policy limit', () => {
    const middleware = createRateLimitMiddleware({ windowMs: 60_000, maxByPolicy: { auth: 1 } });
    const first = makeRes();
    const second = makeRes();
    let nextCount = 0;

    middleware(makeReq('127.0.0.1', '/api/v1/auth/login'), first, () => nextCount++);
    middleware(makeReq('127.0.0.1', '/api/v1/auth/login'), second, () => nextCount++);

    assert.equal(nextCount, 1);
    assert.equal(second.statusCode, 429);
    const body = second.body as any;
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'RATE_LIMITED');
    assert.equal(body.error.message, 'Too many requests');
    assert.equal(body.error.details.policy, 'auth');
    assert.equal(body.error.details.limit, 1);
  });

  it('uses forwarded IP when gateway is behind a proxy', () => {
    const middleware = createRateLimitMiddleware({ windowMs: 60_000, maxByPolicy: { public: 1 } });
    const firstReq = makeReq('10.0.0.1', '/api/v1/patients');
    const secondReq = makeReq('10.0.0.2', '/api/v1/patients');
    firstReq.headers['x-forwarded-for'] = '203.0.113.10, 10.0.0.1';
    secondReq.headers['x-forwarded-for'] = '203.0.113.11, 10.0.0.2';
    let nextCount = 0;

    middleware(firstReq, makeRes(), () => nextCount++);
    middleware(secondReq, makeRes(), () => nextCount++);

    assert.equal(nextCount, 2);
  });
});
