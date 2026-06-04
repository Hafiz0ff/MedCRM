import { randomBytes } from 'node:crypto';
import { PrismaService } from '@core/database/prisma.service';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { AuthAuditService, RequestMetadata } from './auth-audit.service';
import { BootstrapService } from './bootstrap.service';
import { TokenResult } from './mfa.service';
import { SessionService } from './session.service';

type RefreshPayload = {
  sub: string;
  tenant_id: string;
  session_id: string;
  fingerprint: string;
};

/**
 * Service to manage Refresh Token logic, session verification, and token rotation.
 */
@Injectable()
export class RefreshTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly sessionService: SessionService,
    private readonly bootstrapService: BootstrapService,
    private readonly audit: AuthAuditService,
  ) {}

  /**
   * Performs refresh token verification, validates active session status, and rotates tokens.
   */
  async refresh(refreshToken: string | undefined, metadata: RequestMetadata): Promise<TokenResult> {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is missing');
    }

    let payload: RefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token is invalid');
    }

    const session = await this.prisma.userSession.findUnique({
      where: { id: payload.session_id },
      include: { user: true, tenant: true },
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Session is not active');
    }

    const matches = await argon2.verify(session.refreshTokenHash, refreshToken);
    if (!matches || session.tokenFingerprint !== payload.fingerprint) {
      await this.sessionService.revokeSession(payload.session_id);
      throw new UnauthorizedException('Refresh token was rotated');
    }

    const context = await this.bootstrapService.buildAuthContext(session.userId, session.tenantId);
    const nextFingerprint = randomBytes(32).toString('hex');

    const nextRefreshToken = await this.jwt.signAsync(
      {
        sub: session.userId,
        tenant_id: session.tenantId,
        session_id: session.id,
        fingerprint: nextFingerprint,
      },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_TTL', '30d') as JwtSignOptions['expiresIn'],
      },
    );

    const nextAccessToken = await this.jwt.signAsync(
      {
        sub: session.userId,
        tenant_id: session.tenantId,
        branch_ids: context.branchIds,
        role_ids: context.roleIds,
        permissions: context.permissions,
        session_id: session.id,
      },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_TTL', '15m') as JwtSignOptions['expiresIn'],
      },
    );

    await this.prisma.userSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: await argon2.hash(nextRefreshToken),
        tokenFingerprint: nextFingerprint,
        ipAddress: metadata.ipAddress,
        userAgent: this.audit.userAgent(metadata),
        lastActivityAt: new Date(),
      },
    });

    await this.sessionService.cacheSession(
      session.id,
      session.tenantId,
      session.userId,
      nextFingerprint,
    );

    return {
      accessToken: nextAccessToken,
      refreshToken: nextRefreshToken,
      bootstrap: await this.bootstrapService.bootstrapFromIds(
        session.userId,
        session.tenantId,
        context,
      ),
    };
  }
}
