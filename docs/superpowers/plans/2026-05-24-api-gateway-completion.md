# API Gateway Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete MedCRM API Gateway so every backend domain is routed through one versioned public/internal boundary with correlation IDs, policy hooks, websocket proxy hardening, and OpenAPI discovery.

**Architecture:** Keep the current NestJS `api-gateway` app as the edge runtime and move proxy configuration out of `main.ts` into small, testable units. The gateway will expose `/api/v1/*` as the public versioned API, keep compatibility aliases for existing frontend paths, reserve `/internal/v1/*` for internal contracts, and proxy Socket.IO with token-preserving websocket settings. Cross-cutting gateway policies are middleware-first: request correlation, security headers, route table metadata, and rate limiting.

**Tech Stack:** NestJS 11, TypeScript strict mode, `http-proxy-middleware`, Node `crypto.randomUUID`, in-memory rate limiting for the first production hardening pass, existing Swagger setup.

---

## Current Context

Current gateway files:

- `backend/apps/api-gateway/src/main.ts` contains all CORS, Helmet, REST proxy, websocket proxy, and Swagger bootstrapping inline.
- `backend/apps/api-gateway/src/app.module.ts` only imports `ConfigModule` and registers `HealthController`.
- `backend/apps/api-gateway/src/health.controller.ts` exposes `GET /health`.

Current gateway routes only cover:

- `/auth`
- `/patients`
- `/appointments`
- `/availability`
- `/slots`
- `/services`
- `/doctors`
- `/reception`
- `/socket.io`

Backend domains not fully proxied through gateway:

- organization: `/branches`, `/departments`, `/employees`, `/rooms`, `/equipment`, `/directories`, `/schedules`
- EMR: `/emr`
- finance: `/finance`
- communications: `/communications`
- integrations: `/integration`
- analytics: `/analytics`
- inventory: `/inventory`
- additional scheduling paths: `/waiting-list`, `/resource-buffers`, `/online-booking`, `/rooms/utilization`

Important working-tree warning: before this plan was created, the repo already had unrelated uncommitted changes in backend/frontend files. Implementation workers must inspect `git status --short` first and avoid reverting unrelated work.

## File Structure

Create:

- `backend/apps/api-gateway/src/gateway-route.config.ts`  
  Static route table for public, internal, compatibility, and websocket routes.

- `backend/apps/api-gateway/src/request-correlation.middleware.ts`  
  Assigns or preserves `X-Request-Id`; mirrors it into response headers; sets `X-Gateway-Service`.

- `backend/apps/api-gateway/src/rate-limit.middleware.ts`  
  Small in-memory rate limiter with path policy support. This is not the final distributed limiter; it creates a policy boundary now and can later move to Redis.

- `backend/apps/api-gateway/src/proxy.factory.ts`  
  Builds `http-proxy-middleware` instances from route config and centralizes proxy headers, tracing, websocket options, and error handling.

- `backend/apps/api-gateway/src/openapi.controller.ts`  
  Exposes gateway-level discovery endpoints for route metadata and upstream OpenAPI references.

- `backend/apps/api-gateway/src/gateway-route.config.spec.ts`  
  Fast Node-based tests for route coverage and versioning policy.

- `backend/apps/api-gateway/src/request-correlation.middleware.spec.ts`  
  Fast Node-based tests for request ID preservation/generation.

- `backend/apps/api-gateway/src/rate-limit.middleware.spec.ts`  
  Fast Node-based tests for limit allow/deny behavior.

Modify:

- `backend/apps/api-gateway/src/main.ts`  
  Replace inline proxy list with route config registration.

- `backend/apps/api-gateway/src/app.module.ts`  
  Register `OpenApiController`.

- `backend/package.json`  
  Add a gateway test script using `tsx --test`.

- `.env.example`, `backend/.env.example`, and `docker-compose.yml`  
  Add gateway rate-limit env values and optional `AUTH_SERVICE_INTERNAL_URL` if internal routing needs a separate upstream.

Do not modify in this TЗ:

- Auth-service business controllers.
- Frontend API clients, except in a separate compatibility cleanup after gateway routes are verified.
- Production Redis rate limiting. That belongs to TЗ31 unless explicitly pulled forward.

---

### Task 1: Add Gateway Route Table

**Files:**

- Create: `backend/apps/api-gateway/src/gateway-route.config.ts`
- Test: `backend/apps/api-gateway/src/gateway-route.config.spec.ts`

- [ ] **Step 1: Write the failing route coverage test**

Create `backend/apps/api-gateway/src/gateway-route.config.spec.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
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
      '/api/v1/waiting-list',
    ]);
  });

  it('keeps existing unversioned frontend paths as compatibility aliases', () => {
    assert.ok(compatibilityRoutes.some((route) => route.gatewayPrefix === '/patients'));
    assert.ok(compatibilityRoutes.some((route) => route.gatewayPrefix === '/reception'));
    assert.ok(compatibilityRoutes.some((route) => route.gatewayPrefix === '/appointments'));
  });

  it('separates internal routes from public routes', () => {
    assert.ok(internalRoutes.every((route) => route.gatewayPrefix.startsWith('/internal/v1/')));
    assert.ok(publicRoutes.every((route) => route.gatewayPrefix.startsWith('/api/v1/')));
  });

  it('declares websocket proxy routes explicitly', () => {
    assert.deepEqual(
      websocketRoutes.map((route) => route.gatewayPrefix),
      ['/socket.io'],
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm --workspace backend run test:gateway
```

Expected before implementation:

```text
Missing script: "test:gateway"
```

- [ ] **Step 3: Add test script**

Modify `backend/package.json` scripts:

```json
{
  "test:gateway": "tsx --test apps/api-gateway/src/*.spec.ts"
}
```

Keep all existing scripts.

- [ ] **Step 4: Run test to verify missing module failure**

Run:

```bash
npm --workspace backend run test:gateway
```

Expected:

```text
Cannot find module './gateway-route.config'
```

- [ ] **Step 5: Implement route config**

Create `backend/apps/api-gateway/src/gateway-route.config.ts`:

```ts
export type GatewayRouteKind = 'public' | 'internal' | 'compatibility' | 'websocket';

export type GatewayRouteConfig = {
  kind: GatewayRouteKind;
  gatewayPrefix: string;
  upstreamPrefix: string;
  targetEnv: 'AUTH_SERVICE_URL' | 'AUTH_SERVICE_INTERNAL_URL';
  rateLimitPolicy: 'auth' | 'public' | 'internal' | 'websocket';
  requiresAuth: boolean;
  description: string;
};

const authTarget = 'AUTH_SERVICE_URL' as const;
const internalTarget = 'AUTH_SERVICE_INTERNAL_URL' as const;

const publicDomainPrefixes = [
  ['analytics', '/analytics', true],
  ['appointments', '/appointments', true],
  ['auth', '/auth', false],
  ['availability', '/availability', true],
  ['branches', '/branches', true],
  ['communications', '/communications', true],
  ['departments', '/departments', true],
  ['directories', '/directories', true],
  ['doctors', '/doctors', true],
  ['employees', '/employees', true],
  ['emr', '/emr', true],
  ['equipment', '/equipment', true],
  ['finance', '/finance', true],
  ['integration', '/integration', true],
  ['inventory', '/inventory', true],
  ['online-booking', '/online-booking', true],
  ['patients', '/patients', true],
  ['reception', '/reception', true],
  ['resource-buffers', '/resource-buffers', true],
  ['rooms', '/rooms', true],
  ['schedules', '/schedules', true],
  ['services', '/services', true],
  ['slots', '/slots', true],
  ['waiting-list', '/waiting-list', true],
] satisfies Array<[string, string, boolean]>;

export const publicRoutes: GatewayRouteConfig[] = publicDomainPrefixes.map(
  ([name, upstreamPrefix, requiresAuth]) => ({
    kind: 'public',
    gatewayPrefix: `/api/v1/${name}`,
    upstreamPrefix,
    targetEnv: authTarget,
    rateLimitPolicy: name === 'auth' ? 'auth' : 'public',
    requiresAuth,
    description: `Public v1 proxy for ${upstreamPrefix}`,
  }),
);

const compatibilityPrefixes = [
  '/auth',
  '/patients',
  '/appointments',
  '/availability',
  '/slots',
  '/services',
  '/doctors',
  '/reception',
  '/waiting-list',
  '/resource-buffers',
  '/online-booking',
  '/rooms',
];

export const compatibilityRoutes: GatewayRouteConfig[] = compatibilityPrefixes.map((prefix) => ({
  kind: 'compatibility',
  gatewayPrefix: prefix,
  upstreamPrefix: prefix,
  targetEnv: authTarget,
  rateLimitPolicy: prefix === '/auth' ? 'auth' : 'public',
  requiresAuth: prefix !== '/auth',
  description: `Backward-compatible unversioned proxy for ${prefix}`,
}));

export const internalRoutes: GatewayRouteConfig[] = [
  {
    kind: 'internal',
    gatewayPrefix: '/internal/v1/auth',
    upstreamPrefix: '/auth',
    targetEnv: internalTarget,
    rateLimitPolicy: 'internal',
    requiresAuth: true,
    description: 'Internal auth service contract',
  },
  {
    kind: 'internal',
    gatewayPrefix: '/internal/v1/health/auth-service',
    upstreamPrefix: '/health',
    targetEnv: internalTarget,
    rateLimitPolicy: 'internal',
    requiresAuth: false,
    description: 'Internal auth-service health proxy',
  },
];

export const websocketRoutes: GatewayRouteConfig[] = [
  {
    kind: 'websocket',
    gatewayPrefix: '/socket.io',
    upstreamPrefix: '/socket.io',
    targetEnv: authTarget,
    rateLimitPolicy: 'websocket',
    requiresAuth: true,
    description: 'Socket.IO realtime gateway proxy',
  },
];

export const gatewayRoutes = [
  ...publicRoutes,
  ...compatibilityRoutes,
  ...internalRoutes,
  ...websocketRoutes,
];
```

- [ ] **Step 6: Run route config test**

Run:

```bash
npm --workspace backend run test:gateway
```

Expected:

```text
pass
```

- [ ] **Step 7: Commit**

```bash
git add backend/package.json backend/apps/api-gateway/src/gateway-route.config.ts backend/apps/api-gateway/src/gateway-route.config.spec.ts
git commit -m "Add gateway route registry"
```

---

### Task 2: Add Request Correlation Middleware

**Files:**

- Create: `backend/apps/api-gateway/src/request-correlation.middleware.ts`
- Test: `backend/apps/api-gateway/src/request-correlation.middleware.spec.ts`
- Modify: `backend/apps/api-gateway/src/main.ts`

- [ ] **Step 1: Write failing middleware test**

Create `backend/apps/api-gateway/src/request-correlation.middleware.spec.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm --workspace backend run test:gateway
```

Expected:

```text
Cannot find module './request-correlation.middleware'
```

- [ ] **Step 3: Implement middleware**

Create `backend/apps/api-gateway/src/request-correlation.middleware.ts`:

```ts
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

export function requestCorrelationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const incoming = req.headers['x-request-id'];
  const requestId = typeof incoming === 'string' && incoming.length > 0 ? incoming : randomUUID();

  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Gateway-Service', 'medcrm-api-gateway');

  next();
}
```

- [ ] **Step 4: Register middleware before CORS/proxies**

Modify `backend/apps/api-gateway/src/main.ts`:

```ts
import { requestCorrelationMiddleware } from './request-correlation.middleware';
```

Then inside `bootstrap`, immediately after `const authTarget = ...`:

```ts
app.use(requestCorrelationMiddleware);
```

- [ ] **Step 5: Run gateway tests and typecheck**

Run:

```bash
npm --workspace backend run test:gateway
npm --workspace backend run typecheck
```

Expected:

```text
pass
```

and typecheck exits 0.

- [ ] **Step 6: Commit**

```bash
git add backend/apps/api-gateway/src/request-correlation.middleware.ts backend/apps/api-gateway/src/request-correlation.middleware.spec.ts backend/apps/api-gateway/src/main.ts
git commit -m "Add gateway request correlation"
```

---

### Task 3: Add Gateway Rate Limit Boundary

**Files:**

- Create: `backend/apps/api-gateway/src/rate-limit.middleware.ts`
- Test: `backend/apps/api-gateway/src/rate-limit.middleware.spec.ts`
- Modify: `backend/apps/api-gateway/src/main.ts`
- Modify: `.env.example`
- Modify: `backend/.env.example`

- [ ] **Step 1: Write failing rate-limit test**

Create `backend/apps/api-gateway/src/rate-limit.middleware.spec.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
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
    assert.deepEqual(second.body, {
      error: 'rate_limited',
      message: 'Too many requests',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm --workspace backend run test:gateway
```

Expected:

```text
Cannot find module './rate-limit.middleware'
```

- [ ] **Step 3: Implement in-memory limiter**

Create `backend/apps/api-gateway/src/rate-limit.middleware.ts`:

```ts
import { NextFunction, Request, Response } from 'express';

type RateLimitPolicy = 'auth' | 'public' | 'internal' | 'websocket';

type RateLimitOptions = {
  windowMs: number;
  maxByPolicy: Partial<Record<RateLimitPolicy, number>>;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const defaultMaxByPolicy: Record<RateLimitPolicy, number> = {
  auth: 20,
  public: 300,
  internal: 1000,
  websocket: 120,
};

function policyForPath(path: string): RateLimitPolicy {
  if (path.startsWith('/api/v1/auth') || path.startsWith('/auth')) return 'auth';
  if (path.startsWith('/internal/v1')) return 'internal';
  if (path.startsWith('/socket.io')) return 'websocket';
  return 'public';
}

function clientKey(req: Request, policy: RateLimitPolicy): string {
  const forwarded = req.headers['x-forwarded-for'];
  const forwardedIp = typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : undefined;
  return `${policy}:${forwardedIp || req.ip || 'unknown'}`;
}

export function createRateLimitMiddleware(options?: Partial<RateLimitOptions>) {
  const windowMs = options?.windowMs ?? 60_000;
  const maxByPolicy = { ...defaultMaxByPolicy, ...options?.maxByPolicy };
  const buckets = new Map<string, Bucket>();

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
    const now = Date.now();
    const policy = policyForPath(req.path || req.originalUrl || '');
    const max = maxByPolicy[policy];
    const key = clientKey(req, policy);
    const existing = buckets.get(key);
    const bucket =
      existing && existing.resetAt > now ? existing : { count: 0, resetAt: now + windowMs };

    bucket.count += 1;
    buckets.set(key, bucket);

    res.setHeader('X-RateLimit-Policy', policy);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
    res.setHeader('X-RateLimit-Reset', String(bucket.resetAt));

    if (bucket.count > max) {
      res.status(429).json({
        error: 'rate_limited',
        message: 'Too many requests',
      });
      return;
    }

    next();
  };
}
```

- [ ] **Step 4: Register limiter in gateway main**

Modify `backend/apps/api-gateway/src/main.ts`:

```ts
import { createRateLimitMiddleware } from './rate-limit.middleware';
```

Then after request correlation:

```ts
app.use(
  createRateLimitMiddleware({
    windowMs: Number(config.get<string>('GATEWAY_RATE_LIMIT_WINDOW_MS', '60000')),
    maxByPolicy: {
      auth: Number(config.get<string>('GATEWAY_RATE_LIMIT_AUTH_MAX', '20')),
      public: Number(config.get<string>('GATEWAY_RATE_LIMIT_PUBLIC_MAX', '300')),
      internal: Number(config.get<string>('GATEWAY_RATE_LIMIT_INTERNAL_MAX', '1000')),
      websocket: Number(config.get<string>('GATEWAY_RATE_LIMIT_WEBSOCKET_MAX', '120')),
    },
  }),
);
```

- [ ] **Step 5: Add env defaults**

Add to `.env.example` and `backend/.env.example`:

```dotenv
GATEWAY_RATE_LIMIT_WINDOW_MS=60000
GATEWAY_RATE_LIMIT_AUTH_MAX=20
GATEWAY_RATE_LIMIT_PUBLIC_MAX=300
GATEWAY_RATE_LIMIT_INTERNAL_MAX=1000
GATEWAY_RATE_LIMIT_WEBSOCKET_MAX=120
```

- [ ] **Step 6: Run tests and typecheck**

Run:

```bash
npm --workspace backend run test:gateway
npm --workspace backend run typecheck
```

Expected: tests pass and typecheck exits 0.

- [ ] **Step 7: Commit**

```bash
git add backend/apps/api-gateway/src/rate-limit.middleware.ts backend/apps/api-gateway/src/rate-limit.middleware.spec.ts backend/apps/api-gateway/src/main.ts .env.example backend/.env.example
git commit -m "Add gateway rate limit policy boundary"
```

---

### Task 4: Centralize Proxy Creation and Register All Routes

**Files:**

- Create: `backend/apps/api-gateway/src/proxy.factory.ts`
- Modify: `backend/apps/api-gateway/src/main.ts`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Create proxy factory**

Create `backend/apps/api-gateway/src/proxy.factory.ts`:

```ts
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import { GatewayRouteConfig } from './gateway-route.config';

const logger = new Logger('GatewayProxy');

function resolveTarget(config: ConfigService, route: GatewayRouteConfig): string {
  if (route.targetEnv === 'AUTH_SERVICE_INTERNAL_URL') {
    return (
      config.get<string>('AUTH_SERVICE_INTERNAL_URL') ??
      config.get<string>('AUTH_SERVICE_URL', 'http://localhost:3001')
    );
  }
  return config.get<string>('AUTH_SERVICE_URL', 'http://localhost:3001');
}

export function createGatewayProxy(config: ConfigService, route: GatewayRouteConfig) {
  const target = resolveTarget(config, route);
  const options: Options = {
    target,
    changeOrigin: true,
    xfwd: true,
    ws: route.kind === 'websocket',
    pathRewrite: (path) => `${route.upstreamPrefix}${path.slice(route.gatewayPrefix.length)}`,
    on: {
      proxyReq: (proxyReq, req) => {
        const requestId = req.headers['x-request-id'];
        if (typeof requestId === 'string') {
          proxyReq.setHeader('X-Request-Id', requestId);
        }
        proxyReq.setHeader('X-Gateway-Route', route.gatewayPrefix);
        proxyReq.setHeader('X-Gateway-Kind', route.kind);
      },
      error: (error, req, res) => {
        logger.error(`Proxy error route=${route.gatewayPrefix} target=${target}: ${error.message}`);
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
        }
        res.end(
          JSON.stringify({
            error: 'bad_gateway',
            route: route.gatewayPrefix,
            requestId: req.headers['x-request-id'],
          }),
        );
      },
    },
  };

  return createProxyMiddleware(options);
}
```

- [ ] **Step 2: Replace inline routes in main**

Modify `backend/apps/api-gateway/src/main.ts` imports:

```ts
import { gatewayRoutes } from './gateway-route.config';
import { createGatewayProxy } from './proxy.factory';
```

Remove the current inline `app.use('/auth', ...)`, loop over `proxiedPrefixes`, and explicit `/socket.io` proxy. Replace with:

```ts
for (const route of gatewayRoutes) {
  app.use(route.gatewayPrefix, createGatewayProxy(config, route));
}
```

- [ ] **Step 3: Add internal URL env for containers**

Modify `docker-compose.yml` `api-gateway.environment`:

```yaml
AUTH_SERVICE_INTERNAL_URL: ${AUTH_SERVICE_INTERNAL_URL:-http://auth-service:3001}
```

Add to `.env.example`:

```dotenv
AUTH_SERVICE_INTERNAL_URL=http://auth-service:3001
```

- [ ] **Step 4: Run typecheck**

Run:

```bash
npm --workspace backend run typecheck
```

Expected: exits 0.

- [ ] **Step 5: Smoke test proxy route locally**

Start services if not already running:

```bash
docker compose up --build
```

In another shell:

```bash
curl -i http://localhost:3000/health
curl -i http://localhost:3000/api/v1/auth/bootstrap
curl -i http://localhost:3000/api/v1/patients
```

Expected:

- `/health` returns gateway `{ "status": "ok", "service": "api-gateway" }`.
- unauthenticated protected routes return `401` or `403`, not `404`.
- response includes `X-Request-Id` and `X-Gateway-Service`.

- [ ] **Step 6: Commit**

```bash
git add backend/apps/api-gateway/src/proxy.factory.ts backend/apps/api-gateway/src/main.ts docker-compose.yml .env.example
git commit -m "Route all domains through gateway"
```

---

### Task 5: Add OpenAPI Route Discovery

**Files:**

- Create: `backend/apps/api-gateway/src/openapi.controller.ts`
- Modify: `backend/apps/api-gateway/src/app.module.ts`

- [ ] **Step 1: Create controller**

Create `backend/apps/api-gateway/src/openapi.controller.ts`:

```ts
import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { gatewayRoutes } from './gateway-route.config';

@ApiTags('gateway')
@Controller('gateway')
export class OpenApiController {
  @Get('routes')
  routes() {
    return {
      version: 'v1',
      routes: gatewayRoutes.map((route) => ({
        kind: route.kind,
        gatewayPrefix: route.gatewayPrefix,
        upstreamPrefix: route.upstreamPrefix,
        rateLimitPolicy: route.rateLimitPolicy,
        requiresAuth: route.requiresAuth,
        description: route.description,
      })),
    };
  }

  @Get('openapi/upstreams')
  upstreams() {
    return {
      gateway: '/docs-json',
      upstreams: [
        {
          service: 'auth-service',
          openApiJson: '/internal/v1/auth-service/docs-json',
          swaggerUi: '/internal/v1/auth-service/docs',
        },
      ],
    };
  }
}
```

- [ ] **Step 2: Register controller**

Modify `backend/apps/api-gateway/src/app.module.ts`:

```ts
import { OpenApiController } from './openapi.controller';
```

Then:

```ts
controllers: [HealthController, OpenApiController];
```

- [ ] **Step 3: Expose Swagger JSON**

Modify `backend/apps/api-gateway/src/main.ts` Swagger setup:

```ts
SwaggerModule.setup('docs', app, document, {
  jsonDocumentUrl: 'docs-json',
});
```

- [ ] **Step 4: Run typecheck**

Run:

```bash
npm --workspace backend run typecheck
```

Expected: exits 0.

- [ ] **Step 5: Smoke test discovery**

Run with gateway started:

```bash
curl -s http://localhost:3000/gateway/routes | node -e "process.stdin.on('data', d => { const x=JSON.parse(d); console.log(x.routes.length); })"
curl -I http://localhost:3000/docs-json
```

Expected:

- route count is greater than 30.
- `/docs-json` returns HTTP 200.

- [ ] **Step 6: Commit**

```bash
git add backend/apps/api-gateway/src/openapi.controller.ts backend/apps/api-gateway/src/app.module.ts backend/apps/api-gateway/src/main.ts
git commit -m "Expose gateway route discovery"
```

---

### Task 6: Harden Websocket Gateway Proxy

**Files:**

- Modify: `backend/apps/api-gateway/src/proxy.factory.ts`
- Modify: `backend/apps/api-gateway/src/gateway-route.config.ts`

- [ ] **Step 1: Ensure websocket route keeps auth headers and protocol upgrades**

Modify `createGatewayProxy` in `backend/apps/api-gateway/src/proxy.factory.ts` so `proxyReqWs` copies correlation headers:

```ts
      proxyReqWs: (proxyReq, req) => {
        const requestId = req.headers['x-request-id'];
        if (typeof requestId === 'string') {
          proxyReq.setHeader('X-Request-Id', requestId);
        }
        const authorization = req.headers.authorization;
        if (typeof authorization === 'string') {
          proxyReq.setHeader('Authorization', authorization);
        }
        proxyReq.setHeader('X-Gateway-Route', route.gatewayPrefix);
        proxyReq.setHeader('X-Gateway-Kind', route.kind);
      },
```

- [ ] **Step 2: Add realtime alias route if needed by clients**

If frontend or future clients use `/realtime` directly, add a second websocket route:

```ts
{
  kind: 'websocket',
  gatewayPrefix: '/realtime',
  upstreamPrefix: '/realtime',
  targetEnv: authTarget,
  rateLimitPolicy: 'websocket',
  requiresAuth: true,
  description: 'Direct realtime namespace proxy'
}
```

Keep `/socket.io` because Socket.IO client transport handshakes still use that path by default.

- [ ] **Step 3: Run tests and typecheck**

Run:

```bash
npm --workspace backend run test:gateway
npm --workspace backend run typecheck
```

Expected: tests pass and typecheck exits 0.

- [ ] **Step 4: Commit**

```bash
git add backend/apps/api-gateway/src/proxy.factory.ts backend/apps/api-gateway/src/gateway-route.config.ts backend/apps/api-gateway/src/gateway-route.config.spec.ts
git commit -m "Harden gateway websocket proxy"
```

---

### Task 7: Final Verification

**Files:**

- Modify only if previous verification finds a concrete failure.

- [ ] **Step 1: Check worktree before verification**

Run:

```bash
git status --short
```

Expected: either clean or only intentional uncommitted changes from this TЗ. If unrelated files appear, do not stage them.

- [ ] **Step 2: Run backend checks**

Run:

```bash
npm --workspace backend run test:gateway
npm --workspace backend run typecheck
npm --workspace backend run build
```

Expected: all commands exit 0.

- [ ] **Step 3: Run Docker smoke checks**

Run:

```bash
docker compose up --build
```

Then:

```bash
curl -i http://localhost:3000/health
curl -i http://localhost:3000/gateway/routes
curl -i http://localhost:3000/docs-json
curl -i http://localhost:3000/api/v1/auth/bootstrap
curl -i http://localhost:3000/api/v1/emr/templates
curl -i http://localhost:3000/api/v1/finance/billing/subscription
curl -i http://localhost:3000/api/v1/inventory/warehouses/tree
```

Expected:

- Gateway endpoints return `200`.
- Protected upstream endpoints return `401` or `403` without token, not `404`.
- Every response includes `X-Request-Id`.

- [ ] **Step 4: Verify compatibility routes**

Run:

```bash
curl -i http://localhost:3000/patients
curl -i http://localhost:3000/reception/dashboard
curl -i http://localhost:3000/appointments
```

Expected:

- Protected compatibility routes return `401` or `403` without token, not `404`.

- [ ] **Step 5: Commit final fixes if needed**

If verification required small fixes:

```bash
git add backend/apps/api-gateway .env.example backend/.env.example docker-compose.yml backend/package.json
git commit -m "Verify gateway production boundary"
```

If no fixes were needed, do not create an empty commit.

---

## Coverage Review

Spec requirement mapping:

- unified API routing: Tasks 1 and 4.
- internal service contracts: Tasks 1, 4, and 5.
- gateway policies: Tasks 2 and 3.
- API versioning: Task 1.
- websocket auth middleware/hardening: Tasks 4 and 6.
- centralized request correlation: Task 2.
- proxy all backend domains: Tasks 1 and 4.
- public/internal endpoints: Tasks 1 and 5.
- OpenAPI aggregation/discovery: Task 5.

Known non-goals for this TЗ:

- Distributed Redis-backed rate limiting. This belongs to TЗ31 unless production load requires pulling it forward.
- Full OpenAPI document merging from every upstream controller. Task 5 creates discovery references first; true schema aggregation can follow once gateway route boundaries are stable.
- Frontend migration from unversioned paths to `/api/v1`. Compatibility aliases keep existing UI working; cleanup can be a separate small task.
