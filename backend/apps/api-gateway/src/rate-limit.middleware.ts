import * as crypto from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import Redis from 'ioredis';
import { GatewayRouteConfig, gatewayRoutes } from './gateway-route.config';
import { getClientIp } from './rate-limit/client-ip';
import { RateLimitPolicy, RateLimitOptions } from './rate-limit/rate-limit.types';

const defaultMaxByPolicy: Record<RateLimitPolicy, number> = {
  auth: 20,
  public: 300,
  internal: 1000,
  websocket: 120,
};

/**
 * Creates a production-grade fail-closed rate limiting middleware.
 * @param options RateLimitOptions configuration.
 * @param redis Optional Redis connection client.
 */
export function createRateLimitMiddleware(options?: Partial<RateLimitOptions>, redis?: Redis) {
  const windowMs = options?.windowMs ?? 60_000;
  const maxByPolicy = {
    auth: options?.maxByPolicy?.auth ?? defaultMaxByPolicy.auth,
    public: options?.maxByPolicy?.public ?? defaultMaxByPolicy.public,
    internal: options?.maxByPolicy?.internal ?? defaultMaxByPolicy.internal,
    websocket: options?.maxByPolicy?.websocket ?? defaultMaxByPolicy.websocket,
  };
  const failOpenPolicies = options?.failOpenPolicies ?? ['public'];
  const trustedProxyCidrs = options?.trustedProxyCidrs ?? [];

  // Memory fallback bucket storage (local/development only)
  const memoryBuckets = new Map<string, { count: number; resetAt: number }>();

  return async function rateLimitMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const now = Date.now();

    // 1. Resolve matched route and policy
    const matchedRoute = [...gatewayRoutes]
      .sort((a, b) => b.gatewayPrefix.length - a.gatewayPrefix.length)
      .find((r) => req.path.startsWith(r.gatewayPrefix));
    const policy = (matchedRoute?.rateLimitPolicy ?? 'public') as RateLimitPolicy;
    const max = maxByPolicy[policy];

    // 2. Resolve client IP address
    const clientIp = getClientIp(req, trustedProxyCidrs);

    // 3. Resolve tenant context from headers
    const tenantId = req.headers['x-tenant-id'] || (req.query && req.query['tenantId']) || 'public';

    // 4. Construct rate limiting key
    let key = `gateway:rate-limit:${policy}:${tenantId}:${clientIp}`;

    // 5. Append auth payload hashes if present
    if (policy === 'auth' && req.body && typeof req.body === 'object') {
      if (req.body.email) {
        const emailHash = crypto
          .createHash('sha256')
          .update(String(req.body.email))
          .digest('hex')
          .slice(0, 16);
        key += `:email:${emailHash}`;
      }
      if (req.body.tenantCode) {
        const codeHash = crypto
          .createHash('sha256')
          .update(String(req.body.tenantCode))
          .digest('hex')
          .slice(0, 16);
        key += `:tenant:${codeHash}`;
      }
    }

    const envNode = process.env.NODE_ENV;
    const envApp = process.env.APP_ENV;
    const isLocalEnv = envNode === 'development' || envApp === 'local' || envNode === 'test';

    // 6. Redis Rate Limiter (with Fail-Closed enforcement)
    if (redis) {
      const minute = Math.floor(now / 60000);
      const redisKey = `${key}:${minute}`;

      try {
        const results = await redis
          .multi()
          .incr(redisKey)
          .expire(redisKey, Math.ceil(windowMs / 1000))
          .exec();

        if (!results || !results[0]) {
          throw new Error('Redis transaction returned empty result');
        }

        const incrResult = results[0];
        if (incrResult[0]) {
          throw incrResult[0]; // Throw the connection/command execution error
        }

        const count = Number(incrResult[1]);

        res.setHeader('X-RateLimit-Policy', policy);
        res.setHeader('X-RateLimit-Limit', String(max));
        res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - count)));
        res.setHeader('X-RateLimit-Reset', String((minute + 1) * 60000));

        if (count > max) {
          res.status(429).json({
            success: false,
            error: {
              code: 'RATE_LIMITED',
              message: 'Too many requests',
              details: {
                policy,
                limit: max,
                resetAt: new Date((minute + 1) * 60000).toISOString(),
              },
              requestId: req.headers['x-request-id'] || 'unknown',
              timestamp: new Date().toISOString(),
            },
          });
          return;
        }

        return next();
      } catch (err: any) {
        console.error(`Rate limit Redis failure for policy ${policy}:`, err.message || err);

        // If Redis failed, verify if the policy is configured to fail open
        if (failOpenPolicies.includes(policy)) {
          return next();
        }

        res.status(503).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_UNAVAILABLE',
            message: 'Rate limiting service is temporarily unavailable',
            requestId: req.headers['x-request-id'] || 'unknown',
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }
    }

    // 7. Memory fallback (strict check: local/development only)
    if (!isLocalEnv) {
      // If we are in production but Redis is not configured, we must fail closed for security
      if (failOpenPolicies.includes(policy)) {
        return next();
      }

      res.status(503).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_UNAVAILABLE',
          message: 'Distributed rate limiting service is required in production',
          requestId: req.headers['x-request-id'] || 'unknown',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // In-memory bucket counting for local environments
    const existing = memoryBuckets.get(key);
    const bucket =
      existing && existing.resetAt > now ? existing : { count: 0, resetAt: now + windowMs };

    bucket.count += 1;
    memoryBuckets.set(key, bucket);

    res.setHeader('X-RateLimit-Policy', policy);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
    res.setHeader('X-RateLimit-Reset', String(bucket.resetAt));

    if (bucket.count > max) {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests',
          details: {
            policy,
            limit: max,
            resetAt: new Date(bucket.resetAt).toISOString(),
          },
          requestId: req.headers['x-request-id'] || 'unknown',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    next();
  };
}
