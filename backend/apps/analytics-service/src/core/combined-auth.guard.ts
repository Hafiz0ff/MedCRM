import { createHash } from 'node:crypto';
import { PrismaService } from '@core/database/prisma.service';
import { TenantContextService } from '@core/tenancy/tenant-context.service';
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';

@Injectable()
export class CombinedAuthGuard implements CanActivate {
  private readonly logger = new Logger(CombinedAuthGuard.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    // Resolve tenant from header if present
    const tenantIdHeader = request.headers['x-tenant-id'];
    if (tenantIdHeader) {
      this.tenantContext.setTenantId(String(tenantIdHeader));
    }

    if (!authHeader) {
      const path = request.url;
      if (path.includes('/health') || path.includes('/metadata')) {
        return true;
      }
      throw new UnauthorizedException('Missing Authorization header');
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (token.startsWith('mck_live_')) {
      const fingerprint = createHash('sha256').update(token).digest('hex').slice(0, 32);

      const providers = await this.prisma.integrationProvider.findMany({
        where: { isActive: true },
      });

      for (const provider of providers) {
        const configJson = provider.configurationJson as any;
        if (configJson && configJson.apiKeyFingerprint === fingerprint && configJson.apiKeyHash) {
          const ok = await argon2.verify(configJson.apiKeyHash, token);
          if (ok) {
            this.tenantContext.setTenantId(provider.tenantId);
            request.user = {
              tenantId: provider.tenantId,
              providerId: provider.id,
              providerCode: provider.providerCode,
              providerType: provider.providerType,
              isB2B: true,
              permissions: [
                'integration.gateway.manage',
                'integration.lab.manage',
                'integration.storage.manage',
                'integration.telephony.manage',
              ],
            };
            return true;
          }
        }
      }
      throw new UnauthorizedException('Invalid API Key');
    } else {
      try {
        const secret = this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
        const payload = await this.jwtService.verifyAsync(token, { secret });

        const session = await this.prisma.userSession.findUnique({
          where: { id: payload.session_id },
          select: { revokedAt: true, expiresAt: true },
        });

        if (!session || session.revokedAt || session.expiresAt <= new Date()) {
          throw new UnauthorizedException('Session is not active');
        }

        this.tenantContext.setTenantId(payload.tenant_id);
        this.tenantContext.setUserId(payload.sub);

        request.user = {
          userId: payload.sub,
          tenantId: payload.tenant_id,
          branchIds: payload.branch_ids,
          roleIds: payload.role_ids,
          permissions: payload.permissions,
          sessionId: payload.session_id,
          isB2B: false,
        };
        return true;
      } catch (err: any) {
        throw new UnauthorizedException(err.message || 'Invalid JWT token');
      }
    }
  }
}
