import { NextFunction, Request, Response } from 'express';
import { GatewayRateLimitPolicy } from './gateway-route.config';

type RateLimitOptions = {
  windowMs: number;
  maxByPolicy: Partial<Record<GatewayRateLimitPolicy, number>>;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const defaultMaxByPolicy: Record<GatewayRateLimitPolicy, number> = {
  auth: 20,
  public: 300,
  internal: 1000,
  websocket: 120,
};

function policyForPath(path: string): GatewayRateLimitPolicy {
  if (
    path.startsWith('/api/v1/auth') ||
    path.startsWith('/auth') ||
    path.startsWith('/portal/v1/auth')
  ) {
    return 'auth';
  }
  if (path.startsWith('/internal/v1')) return 'internal';
  if (path.startsWith('/socket.io') || path.startsWith('/realtime')) return 'websocket';
  return 'public';
}

function clientKey(req: Request, policy: GatewayRateLimitPolicy): string {
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
