import { REDIS_CLIENT } from '@core/cache/redis.module';
import { PrismaService } from '@core/database/prisma.service';
import { Injectable, NestMiddleware, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';

@Injectable()
export class BrandingMiddleware implements NestMiddleware {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const host = req.headers.host || req.hostname;
    if (!host) {
      return next();
    }

    try {
      // 1. Check if we already have the domain-to-tenant mapping in Redis cache
      const cacheKey = `tenant:domain-map:${host}`;
      const cachedData = await this.redis.get(cacheKey);
      let tenantId: string | null = null;
      let tenantCode: string | null = null;
      let tenantRegion: string | null = null;

      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        tenantId = parsed.id;
        tenantCode = parsed.code;
        tenantRegion = parsed.region;
      } else {
        // Query database to resolve either customDomain OR code matching subdomain
        // Format: customdomain.com or tenant-code.medcrm.com
        let tenant = await this.prisma.tenant.findFirst({
          where: { customDomain: host },
        });

        // Subdomain fallback check if not matched by full custom domain
        if (
          !tenant &&
          (host.endsWith('.medcrm.com') ||
            host.includes('.localhost') ||
            host.includes('localhost:'))
        ) {
          const parts = host.split('.');
          if (parts.length > 2) {
            const subdomain = parts[0];
            tenant = await this.prisma.tenant.findFirst({
              where: { code: subdomain },
            });
          }
        }

        if (tenant) {
          tenantId = tenant.id;
          tenantCode = tenant.code;
          tenantRegion = tenant.region;

          // Cache lookup for 60 seconds
          await this.redis.setex(
            cacheKey,
            60,
            JSON.stringify({ id: tenant.id, code: tenant.code, region: tenant.region }),
          );
        }
      }

      if (tenantId && tenantCode) {
        // Assign headers for downstream propagation
        req.headers['x-tenant-domain'] = host;
        req.headers['x-tenant-id'] = tenantId;
        req.headers['x-tenant-code'] = tenantCode;

        // 2. Multi-Region redirect / GeoSteering logic
        const currentRegion = this.config.get<string>('GATEWAY_REGION', 'RU').toUpperCase();
        if (tenantRegion && tenantRegion.toUpperCase() !== currentRegion) {
          // Determine steering target host
          const regionPrefix = tenantRegion.toLowerCase();
          const targetUrl = `https://${regionPrefix}.medcrm.com${req.originalUrl}`;

          // Redirect the request to region-specific regional gateway
          res.status(307).redirect(targetUrl);
          return;
        }
      }
    } catch (err) {
      console.error('Error in BrandingMiddleware custom domain lookup:', err);
    }

    next();
  }
}
