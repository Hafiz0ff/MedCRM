import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  compatibilityRoutes,
  internalRoutes,
  publicRoutes,
  websocketRoutes,
} from './gateway-route.config';

describe('gateway route config', () => {
  it('proxies every implemented backend domain through the public v1 API', () => {
    const publicPrefixes = publicRoutes.map((route) => route.gatewayPrefix).sort();

    assert.deepEqual(publicPrefixes, [
      '/api/v1/analytics',
      '/api/v1/appointments',
      '/api/v1/auth',
      '/api/v1/availability',
      '/api/v1/branches',
      '/api/v1/communications',
      '/api/v1/departments',
      '/api/v1/directories',
      '/api/v1/doctors',
      '/api/v1/employees',
      '/api/v1/emr',
      '/api/v1/equipment',
      '/api/v1/finance',
      '/api/v1/integration',
      '/api/v1/inventory',
      '/api/v1/online-booking',
      '/api/v1/patients',
      '/api/v1/reception',
      '/api/v1/resource-buffers',
      '/api/v1/rooms',
      '/api/v1/schedules',
      '/api/v1/services',
      '/api/v1/slots',
      '/api/v1/system',
      '/api/v1/waiting-list',
    ]);
  });

  it('keeps existing unversioned frontend paths as compatibility aliases', () => {
    assert.ok(compatibilityRoutes.some((route) => route.gatewayPrefix === '/patients'));
    assert.ok(compatibilityRoutes.some((route) => route.gatewayPrefix === '/reception'));
    assert.ok(compatibilityRoutes.some((route) => route.gatewayPrefix === '/appointments'));
  });

  it('routes clinic directory endpoints to auth-service until scheduling owns the catalog', () => {
    const doctorRoutes = [...publicRoutes, ...compatibilityRoutes].filter((route) =>
      route.gatewayPrefix.endsWith('/doctors'),
    );
    const serviceRoutes = [...publicRoutes, ...compatibilityRoutes].filter((route) =>
      route.gatewayPrefix.endsWith('/services'),
    );

    assert.ok(doctorRoutes.length > 0);
    assert.ok(serviceRoutes.length > 0);
    assert.ok(doctorRoutes.every((route) => route.targetEnv === 'AUTH_SERVICE_URL'));
    assert.ok(serviceRoutes.every((route) => route.targetEnv === 'AUTH_SERVICE_URL'));
  });

  it('separates internal routes from public routes', () => {
    assert.ok(internalRoutes.every((route) => route.gatewayPrefix.startsWith('/internal/v1/')));
    assert.ok(publicRoutes.every((route) => route.gatewayPrefix.startsWith('/api/v1/')));
  });

  it('declares websocket proxy routes explicitly', () => {
    assert.deepEqual(
      websocketRoutes.map((route) => route.gatewayPrefix),
      ['/socket.io', '/realtime'],
    );
  });
});
