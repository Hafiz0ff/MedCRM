import * as crypto from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import Redis from 'ioredis';
import { gatewayRoutes } from './gateway-route.config';
import { getClientIp } from './rate-limit/client-ip';
import { RateLimitPolicy, RateLimitOptions } from './rate-limit/rate-limit.types';

const defaultMaxByPolicy: Record<RateLimitPolicy, number> = {
  auth: 20,
  public: 300,
  internal: 1000,
  websocket: 120,
};

/**
 * Extracts userId and tenantId from Bearer token payload without checking signature.
 * Useful for rate limiting before auth middleware has run.
 */
function getPrincipalFromToken(authHeader: string | undefined): {
  userId?: string;
  tenantId?: string;
} {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {};
  }
  try {
    const token = authHeader.substring(7).trim();
    const parts = token.split('.');
    if (parts.length === 3) {
      const payloadStr = Buffer.from(parts[1], 'base64').toString('utf8');
      const payload = JSON.parse(payloadStr);
      return {
        userId: typeof payload.sub === 'string' ? payload.sub : undefined,
        tenantId: typeof payload.tenant_id === 'string' ? payload.tenant_id : undefined,
      };
    }
  } catch {
    // Ignore decoding errors
  }
  return {};
}

/**
 * Creates a production-grade strict Redis-only rate limiting middleware.
 * @param options RateLimitOptions configuration.
 * @param redis Redis connection client.
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

    // 3. Resolve identity info (userId, tenantId)
    const tokenInfo = getPrincipalFromToken(req.headers['authorization']);
    const userId = tokenInfo.userId;
    const tenantId =
      tokenInfo.tenantId ||
      req.headers['x-tenant-id'] ||
      req.headers['X-Tenant-Id'] ||
      (req.query && typeof req.query['tenantId'] === 'string' ? req.query['tenantId'] : '') ||
      'public';

    // 4. Construct clientId
    const clientIdParts = [
      userId ? `user_${userId}` : '',
      tenantId ? `tenant_${tenantId}` : '',
      `ip_${clientIp}`,
    ].filter(Boolean);
    const clientId = clientIdParts.join(':');

    // 5. Append auth payload hashes if present
    let hashSuffix = '';
    if (policy === 'auth' && req.body && typeof req.body === 'object') {
      if (req.body.email) {
        const emailHash = crypto
          .createHash('sha256')
          .update(String(req.body.email))
          .digest('hex')
          .slice(0, 16);
        hashSuffix += `:email:${emailHash}`;
      }
      if (req.body.tenantCode) {
        const codeHash = crypto
          .createHash('sha256')
          .update(String(req.body.tenantCode))
          .digest('hex')
          .slice(0, 16);
        hashSuffix += `:tenant:${codeHash}`;
      }
    }

    const envNode = process.env.NODE_ENV;
    const isProd = envNode === 'production';
    const failOpenEnv = process.env.GATEWAY_RATE_LIMIT_FAIL_OPEN;

    // Determine fail-open behavior: production defaults to fail-closed, development defaults to fail-open
    const shouldFailOpen = isProd ? failOpenEnv === 'true' : failOpenEnv !== 'false';

    const minute = Math.floor(now / 60000);
    const redisKey = `gateway:rate_limit:${policy}:${clientId}${hashSuffix}:${minute}`;

    // 6. Redis Rate Limiter
    if (redis) {
      try {
        const results = await redis
          .multi()
          .incr(redisKey)
          .expire(redisKey, Math.ceil(windowMs / 1000))
          .exec();

        if (!results) {
          throw new Error('Redis transaction returned empty result');
        }

        const incrResult = results[0];
        if (!incrResult) {
          throw new Error('Redis transaction returned no results');
        }

        const incrError = incrResult[0];
        if (incrError) {
          throw incrError;
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
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`Rate limit Redis failure for policy ${policy}:`, errMsg);

        if (shouldFailOpen || failOpenPolicies.includes(policy)) {
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

    // 7. Enforce fail-closed when Redis is completely missing
    if (shouldFailOpen || failOpenPolicies.includes(policy)) {
      return next();
    }

    res.status(503).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_UNAVAILABLE',
        message: 'Distributed rate limiting service is required',
        requestId: req.headers['x-request-id'] || 'unknown',
        timestamp: new Date().toISOString(),
      },
    });
  };
}
