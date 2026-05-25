import { REDIS_CLIENT } from '@core/cache/redis.module';
import { PrismaService } from '@core/database/prisma.service';
import { Injectable, NestMiddleware, Inject } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';

@Injectable()
export class TenantAwareMiddleware implements NestMiddleware {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const tenantId = req.headers['x-tenant-id'] ? String(req.headers['x-tenant-id']) : undefined;
    const tenantCode = req.headers['x-tenant-code']
      ? String(req.headers['x-tenant-code'])
      : undefined;

    if (!tenantId && !tenantCode) {
      return next();
    }

    try {
      const idCacheKey = tenantId ? `tenant:status:id:${tenantId}` : null;
      const codeCacheKey = tenantCode ? `tenant:status:code:${tenantCode}` : null;

      let status: string | null = null;
      let resolvedId = tenantId;
      let resolvedCode = tenantCode;

      if (idCacheKey) {
        status = await this.redis.get(idCacheKey);
        if (status) {
          const mappedCodeKey = `tenant:map:id-to-code:${tenantId}`;
          const mappedCode = await this.redis.get(mappedCodeKey);
          if (mappedCode) resolvedCode = mappedCode;
        }
      } else if (codeCacheKey) {
        status = await this.redis.get(codeCacheKey);
        if (status) {
          const mappedIdKey = `tenant:map:code-to-id:${tenantCode}`;
          const mappedId = await this.redis.get(mappedIdKey);
          if (mappedId) resolvedId = mappedId;
        }
      }

      if (!status) {
        const tenant = await this.prisma.tenant.findFirst({
          where: tenantId ? { id: tenantId } : { code: tenantCode },
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
