import { randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '@core/database/prisma.service';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { LoginDto } from '../dto/login.dto';
import { AuthAuditService, RequestMetadata } from './auth-audit.service';
import { BootstrapService } from './bootstrap.service';
import { TokenResult } from './mfa.service';
import { SessionService } from './session.service';

const SESSION_SECONDS = 60 * 60 * 24 * 30;

/**
 * Service to manage authentication login flows and password validation.
 */
@Injectable()
export class LoginService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly sessionService: SessionService,
    private readonly bootstrapService: BootstrapService,
    private readonly audit: AuthAuditService,
  ) {}

  /**
   * authenticates credentials and launches MFA flow or registers active session.
   */
  async login(dto: LoginDto, metadata: RequestMetadata): Promise<TokenResult> {
    const tenant = await this.prisma.tenant.findUnique({ where: { code: dto.tenantCode } });
    if (!tenant || tenant.status !== 'active') {
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email: dto.email.toLowerCase() } },
    });

    if (!user || user.status !== 'active') {
      await this.audit.log({
        tenantId: tenant.id,
        action: 'auth.login.failed',
        ipAddress: metadata.ipAddress,
        userAgent: this.audit.userAgent(metadata),
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordValid) {
      await this.audit.log({
        tenantId: tenant.id,
        userId: user.id,
        action: 'auth.login.failed',
        ipAddress: metadata.ipAddress,
        userAgent: this.audit.userAgent(metadata),
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const twoFactor = await this.prisma.user2faSettings.findUnique({
      where: { userId: user.id },
    });

    if (twoFactor && twoFactor.isEnabled) {
      const mfaToken = await this.jwt.signAsync(
        {
          sub: user.id,
          tenant_id: tenant.id,
          branch_id: dto.branchId,
          is_mfa_pending: true,
        },
        {
          secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
          expiresIn: '5m',
        },
      );

      await this.audit.log({
        tenantId: tenant.id,
        userId: user.id,
        action: 'auth.2fa.required',
        ipAddress: metadata.ipAddress,
        userAgent: this.audit.userAgent(metadata),
      });

      return { mfaRequired: true, mfaToken };
    }

    const context = await this.bootstrapService.buildAuthContext(user.id, tenant.id, dto.branchId);
    const sessionId = randomUUID();
    const fingerprint = randomBytes(32).toString('hex');

    const refreshToken = await this.jwt.signAsync(
      {
        sub: user.id,
        tenant_id: tenant.id,
        session_id: sessionId,
        fingerprint,
      },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_TTL', '30d') as JwtSignOptions['expiresIn'],
      },
    );

    const accessToken = await this.jwt.signAsync(
      {
        sub: user.id,
        tenant_id: tenant.id,
        branch_ids: context.branchIds,
        role_ids: context.roleIds,
        permissions: context.permissions,
        session_id: sessionId,
      },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_TTL', '15m') as JwtSignOptions['expiresIn'],
      },
    );

    await this.prisma.userSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        tenantId: tenant.id,
        refreshTokenHash: await argon2.hash(refreshToken),
        ipAddress: metadata.ipAddress,
        userAgent: this.audit.userAgent(metadata),
        deviceName: dto.deviceName,
        tokenFingerprint: fingerprint,
        expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000),
      },
    });

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.sessionService.cacheSession(sessionId, tenant.id, user.id, fingerprint);
    await this.audit.log({
      tenantId: tenant.id,
      userId: user.id,
      action: 'auth.login.success',
      ipAddress: metadata.ipAddress,
      userAgent: this.audit.userAgent(metadata),
    });

    return {
      accessToken,
      refreshToken,
      bootstrap: await this.bootstrapService.bootstrapFromIds(user.id, tenant.id, context),
    };
  }
}
