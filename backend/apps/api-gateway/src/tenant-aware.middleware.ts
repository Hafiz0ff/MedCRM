import { REDIS_CLIENT } from '@core/cache/redis.module';
import { PrismaService } from '@core/database/prisma.service';
import { Injectable, NestMiddleware, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import * as jose from 'jose';

@Injectable()
export class TenantAwareMiddleware implements NestMiddleware {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const headerTenantId = req.headers['x-tenant-id']
      ? String(req.headers['x-tenant-id'])
      : undefined;
    const headerTenantCode = req.headers['x-tenant-code']
      ? String(req.headers['x-tenant-code'])
      : undefined;

    let resolvedId = headerTenantId;
    let resolvedCode = headerTenantCode;

    // 1. JWT verification and Tenant Extraction
    const authHeader = req.headers['authorization'];
    let jwtTenantId: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const isPortalPath =
        req.path.startsWith('/portal/') || req.path.startsWith('/api/v1/portal/');

      if (!isPortalPath) {
        try {
          const secretStr = this.config.get<string>('JWT_ACCESS_SECRET');
          if (secretStr) {
            const secret = new TextEncoder().encode(secretStr);
            const { payload } = await jose.jwtVerify(token, secret);
            if (payload && typeof payload.tenant_id === 'string') {
              jwtTenantId = payload.tenant_id;
            }
          }
        } catch {
          // Token signature validation failed or expired.
          // Downstream will throw 401, but we do not validate tenant mismatch for invalid tokens.
        }
      }
    }

    // 2. Tenant validation & source of truth
    if (jwtTenantId) {
      if (headerTenantId && headerTenantId !== jwtTenantId) {
        res.status(403).json({
          success: false,
          error: {
            code: 'TENANT_MISMATCH',
            message: 'Tenant ID in request headers does not match authenticated session',
            requestId: req.headers['x-request-id'] || 'unknown',
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }
      resolvedId = jwtTenantId;
    }

    if (!resolvedId && !resolvedCode) {
      return next();
    }

    try {
      const idCacheKey = resolvedId ? `tenant:status:id:${resolvedId}` : null;
      const codeCacheKey = resolvedCode ? `tenant:status:code:${resolvedCode}` : null;

      let status: string | null = null;

      if (idCacheKey) {
        status = await this.redis.get(idCacheKey);
        if (status) {
          const mappedCodeKey = `tenant:map:id-to-code:${resolvedId}`;
          const mappedCode = await this.redis.get(mappedCodeKey);
          if (mappedCode) resolvedCode = mappedCode;
        }
      } else if (codeCacheKey) {
        status = await this.redis.get(codeCacheKey);
        if (status) {
          const mappedIdKey = `tenant:map:code-to-id:${resolvedCode}`;
          const mappedId = await this.redis.get(mappedIdKey);
          if (mappedId) resolvedId = mappedId;
        }
      }

      if (!status) {
        const tenant = await this.prisma.tenant.findFirst({
          where: resolvedId ? { id: resolvedId } : { code: resolvedCode },
        });

        if (tenant) {
          status = tenant.status;
          resolvedId = tenant.id;
          resolvedCode = tenant.code;

          // Cache status and mappings for 60 seconds
          await this.redis.setex(`tenant:status:id:${tenant.id}`, 60, status);
          await this.redis.setex(`tenant:status:code:${tenant.code}`, 60, status);
          await this.redis.setex(`tenant:map:id-to-code:${tenant.id}`, 60, tenant.code);
          await this.redis.setex(`tenant:map:code-to-id:${tenant.code}`, 60, tenant.id);
        } else {
          status = 'not_found';
        }
      }

      if (status !== 'not_found' && status) {
        // Enforce both headers on the request so proxy propagates them
        req.headers['x-tenant-id'] = resolvedId;
        req.headers['x-tenant-code'] = resolvedCode;

        const upperStatus = status.toUpperCase();
        if ((upperStatus === 'SUSPENDED' || upperStatus === 'PAST_DUE') && req.method !== 'GET') {
          res.status(403).json({
            success: false,
            error: {
              code: 'TENANT_SUSPENDED',
              message: `Tenant subscription status is ${upperStatus}. Write operations are blocked.`,
              details: {
                status: upperStatus,
                tenantId: resolvedId,
                tenantCode: resolvedCode,
              },
              requestId: req.headers['x-request-id'] || 'unknown',
              timestamp: new Date().toISOString(),
            },
          });
          return;
        }
      }
    } catch (err: any) {
      console.error('Error in TenantAwareMiddleware:', err);
    }

    next();
  }
}
