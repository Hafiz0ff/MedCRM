import { REDIS_CLIENT } from '@core/cache/redis.module';
import { PrismaService } from '@core/database/prisma.service';
import { Injectable, NestMiddleware, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import * as jose from 'jose';
import { gatewayRoutes } from './gateway-route.config';

@Injectable()
export class TenantAwareMiddleware implements NestMiddleware {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const matchedRoute = [...gatewayRoutes]
      .sort((a, b) => b.gatewayPrefix.length - a.gatewayPrefix.length)
      .find((r) => req.path.startsWith(r.gatewayPrefix));

    const requirement = matchedRoute?.tenantRequirement ?? 'none';

    // 1. Bypass tenant context parsing and validation if route has no requirement
    if (requirement === 'none') {
      return next();
    }

    const headerTenantId = req.headers['x-tenant-id']
      ? String(req.headers['x-tenant-id'])
      : undefined;
    const headerTenantCode = req.headers['x-tenant-code']
      ? String(req.headers['x-tenant-code'])
      : undefined;
    const queryTenantId = req.query?.['tenantId'] ? String(req.query['tenantId']) : undefined;

    let resolvedId = headerTenantId || queryTenantId;
    let resolvedCode = headerTenantCode;

    // 2. JWT verification and Tenant Extraction
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
        }
      }
    }

    // 3. Tenant validation & source of truth
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
      if (requirement === 'required') {
        res.status(400).json({
          success: false,
          error: {
            code: 'TENANT_CONTEXT_REQUIRED',
            message:
              'Tenant identification (X-Tenant-Id or X-Tenant-Code) is required for this route',
            requestId: req.headers['x-request-id'] || 'unknown',
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }
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

      if (status === 'not_found' || !status) {
        if (requirement === 'required') {
          res.status(400).json({
            success: false,
            error: {
              code: 'TENANT_CONTEXT_INVALID',
              message: 'The resolved tenant context is invalid or does not exist',
              requestId: req.headers['x-request-id'] || 'unknown',
              timestamp: new Date().toISOString(),
            },
          });
          return;
        }
      } else {
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
      if (requirement === 'required') {
        res.status(503).json({
          success: false,
          error: {
            code: 'TENANT_VALIDATION_UNAVAILABLE',
            message: 'Tenant validation service is temporarily unavailable',
            requestId: req.headers['x-request-id'] || 'unknown',
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }
    }

    next();
  }
}
