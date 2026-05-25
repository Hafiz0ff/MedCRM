import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { requestCorrelationMiddleware } from './request-correlation.middleware';

function runMiddleware(inputHeader?: string) {
  const headers: Record<string, string | undefined> = {};
  const req = {
    headers: inputHeader ? { 'x-request-id': inputHeader } : {},
    url: '/api/v1/patients',
    method: 'GET',
  } as any;
  const res = {
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
    },
  } as any;
  let nextCalled = false;

  requestCorrelationMiddleware(req, res, () => {
    nextCalled = true;
  });

  return { req, headers, nextCalled };
}

describe('requestCorrelationMiddleware', () => {
  it('preserves incoming request id', () => {
    const result = runMiddleware('req-123');

    assert.equal(result.req.headers['x-request-id'], 'req-123');
    assert.equal(result.headers['x-request-id'], 'req-123');
    assert.equal(result.headers['x-gateway-service'], 'medcrm-api-gateway');
    assert.equal(result.nextCalled, true);
  });

  it('generates request id when missing', () => {
    const result = runMiddleware();

    assert.match(result.req.headers['x-request-id'], /^[0-9a-f-]{36}$/);
    assert.equal(result.headers['x-request-id'], result.req.headers['x-request-id']);
    assert.equal(result.nextCalled, true);
  });
});
