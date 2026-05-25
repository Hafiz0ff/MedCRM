import { PrismaService } from '@core/database/prisma.service';
import { AuthenticatedUser, JwtAccessPayload } from '@core/security/jwt-payload';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtAccessPayload): Promise<AuthenticatedUser> {
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
