import { PrismaService } from '@core/database/prisma.service';
import { AuthenticatedUser, JwtAccessPayload } from '@core/security/jwt-payload';
import { TenantContextService } from '@core/tenancy/tenant-context.service';
import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtAccessPayload): Promise<AuthenticatedUser> {
    const headerTenantId = req.headers['x-tenant-id']
      ? String(req.headers['x-tenant-id'])
      : undefined;
    if (headerTenantId && headerTenantId !== payload.tenant_id) {
      throw new ForbiddenException('TENANT_MISMATCH');
    }

    // Populate request context store for Prisma RLS
    this.tenantContext.setTenantId(payload.tenant_id);
    this.tenantContext.setUserId(payload.sub);

    const session = await this.prisma.userSession.findUnique({
      where: { id: payload.session_id },
      select: { revokedAt: true, expiresAt: true },
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Session is not active');
    }

    return {
      userId: payload.sub,
      tenantId: payload.tenant_id,
      branchIds: payload.branch_ids,
      roleIds: payload.role_ids,
      permissions: payload.permissions,
      sessionId: payload.session_id,
    };
  }
}
