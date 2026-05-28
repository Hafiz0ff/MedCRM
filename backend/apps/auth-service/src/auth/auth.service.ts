import { randomBytes, randomUUID, randomInt } from 'node:crypto';
import { AuditLoggerService } from '@core/audit/audit-logger.service';
import { REDIS_CLIENT } from '@core/cache/redis.module';
import { PrismaService } from '@core/database/prisma.service';
import { AuthenticatedUser, JwtAccessPayload } from '@core/security/jwt-payload';
import { Inject, Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { Response } from 'express';
import Redis from 'ioredis';
import { LoginDto } from './dto/login.dto';
import { MfaConfirmDto, MfaVerifyDto } from './dto/mfa.dto';
import { generateSecret, verifyTOTP } from './utils/totp';

type RequestMetadata = {
  ipAddress?: string;
  userAgent?: string | string[];
};

type TokenResult = {
  accessToken?: string;
  refreshToken?: string;
  bootstrap?: BootstrapPayload;
  mfaRequired?: boolean;
  mfaToken?: string;
};

type BootstrapPayload = {
  tenant: {
    id: string;
    code: string;
    name: string;
    locale: string;
    subscriptionPlan: string;
    customDomain?: string | null;
    brandColor?: string | null;
    accentColor?: string | null;
    logoUrl?: string | null;
    faviconUrl?: string | null;
    region?: string | null;
  };
  enabledModules: string[];
  permissions: string[];
  branches: Array<{ id: string; code: string; name: string }>;
  featureFlags: Record<string, boolean | string | number>;
};

type RefreshPayload = {
  sub: string;
  tenant_id: string;
  session_id: string;
  fingerprint: string;
};

const SESSION_SECONDS = 60 * 60 * 24 * 30;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditLoggerService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async login(dto: LoginDto, metadata: RequestMetadata): Promise<TokenResult> {
    const tenant = await this.prisma.tenant.findUnique({ where: { code: dto.tenantCode } });
    if (!tenant || tenant.status !== 'active') {
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email: dto.email.toLowerCase() } },
      include: {
        branchRoles: {
          where: {
            tenantId: tenant.id,
            activeTo: null,
            ...(dto.branchId ? { branchId: dto.branchId } : {}),
          },
          include: {
            branch: true,
            role: { include: { permissions: { include: { permission: true } } } },
          },
        },
      },
    });

    if (!user || user.status !== 'active') {
      await this.audit.log({
        tenantId: tenant.id,
        action: 'auth.login.failed',
        ipAddress: metadata.ipAddress,
        userAgent: this.userAgent(metadata),
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
        userAgent: this.userAgent(metadata),
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
        userAgent: this.userAgent(metadata),
      });

      return { mfaRequired: true, mfaToken };
    }

    const context = await this.buildAuthContext(user.id, tenant.id, dto.branchId);
    const sessionId = randomUUID();
    const fingerprint = randomBytes(32).toString('hex');
    const refreshToken = await this.signRefreshToken({
      sub: user.id,
      tenant_id: tenant.id,
      session_id: sessionId,
      fingerprint,
    });
    const accessToken = await this.signAccessToken({
      sub: user.id,
      tenant_id: tenant.id,
      branch_ids: context.branchIds,
      role_ids: context.roleIds,
      permissions: context.permissions,
      session_id: sessionId,
    });

    await this.prisma.userSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        tenantId: tenant.id,
        refreshTokenHash: await argon2.hash(refreshToken),
        ipAddress: metadata.ipAddress,
        userAgent: this.userAgent(metadata),
        deviceName: dto.deviceName,
        tokenFingerprint: fingerprint,
        expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000),
      },
    });

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.cacheSession(sessionId, tenant.id, user.id, fingerprint);
    await this.audit.log({
      tenantId: tenant.id,
      userId: user.id,
      action: 'auth.login.success',
      ipAddress: metadata.ipAddress,
      userAgent: this.userAgent(metadata),
    });

    return {
      accessToken,
      refreshToken,
      bootstrap: await this.bootstrapFromIds(user.id, tenant.id, context),
    };
  }

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
      await this.revokeSession(payload.session_id);
      throw new UnauthorizedException('Refresh token was rotated');
    }

    const context = await this.buildAuthContext(session.userId, session.tenantId);
    const nextFingerprint = randomBytes(32).toString('hex');
    const nextRefreshToken = await this.signRefreshToken({
      sub: session.userId,
      tenant_id: session.tenantId,
      session_id: session.id,
      fingerprint: nextFingerprint,
    });
    const nextAccessToken = await this.signAccessToken({
      sub: session.userId,
      tenant_id: session.tenantId,
      branch_ids: context.branchIds,
      role_ids: context.roleIds,
      permissions: context.permissions,
      session_id: session.id,
    });

    await this.prisma.userSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: await argon2.hash(nextRefreshToken),
        tokenFingerprint: nextFingerprint,
        ipAddress: metadata.ipAddress,
        userAgent: this.userAgent(metadata),
        lastActivityAt: new Date(),
      },
    });
    await this.cacheSession(session.id, session.tenantId, session.userId, nextFingerprint);

    return {
      accessToken: nextAccessToken,
      refreshToken: nextRefreshToken,
      bootstrap: await this.bootstrapFromIds(session.userId, session.tenantId, context),
    };
  }

  async logout(user: AuthenticatedUser): Promise<void> {
    await this.revokeSession(user.sessionId);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'auth.logout',
    });
  }

  async revokeAllOtherSessions(user: AuthenticatedUser): Promise<{ count: number }> {
    const sessions = await this.prisma.userSession.findMany({
      where: {
        userId: user.userId,
        tenantId: user.tenantId,
        id: { not: user.sessionId },
        revokedAt: null,
      },
    });

    for (const session of sessions) {
      await this.revokeSession(session.id);
    }

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'auth.revoke_all_other_sessions',
      newValuesJson: { count: sessions.length },
    });

    return { count: sessions.length };
  }
  async getActiveSessions(user: AuthenticatedUser): Promise<any[]> {
    return this.prisma.userSession.findMany({
      where: {
        userId: user.userId,
        tenantId: user.tenantId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        deviceName: true,
        ipAddress: true,
        userAgent: true,
        lastActivityAt: true,
        createdAt: true,
      },
      orderBy: { lastActivityAt: 'desc' },
    });
  }

  async revokeSessionById(
    user: AuthenticatedUser,
    sessionId: string,
  ): Promise<{ success: boolean }> {
    const session = await this.prisma.userSession.findFirst({
      where: {
        id: sessionId,
        userId: user.userId,
        tenantId: user.tenantId,
        revokedAt: null,
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found or already revoked');
    }

    await this.revokeSession(sessionId);

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'auth.session_revoked',
      entityType: 'session',
      entityId: sessionId,
    });

    return { success: true };
  }
  async bootstrap(user: AuthenticatedUser, branchId?: string): Promise<BootstrapPayload> {
    const context = await this.buildAuthContext(user.userId, user.tenantId, branchId);
    return this.bootstrapFromIds(user.userId, user.tenantId, context);
  }

  attachRefreshCookie(response: Response, refreshToken: string): void {
    response.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get<string>('NODE_ENV') === 'production',
      maxAge: SESSION_SECONDS * 1000,
      path: '/auth/refresh',
    });
  }

  private async buildAuthContext(userId: string, tenantId: string, branchId?: string) {
    const branchRoles = await this.prisma.userBranchRole.findMany({
      where: {
        userId,
        tenantId,
        activeTo: null,
        ...(branchId ? { branchId } : {}),
      },
      include: {
        branch: true,
        role: { include: { permissions: { include: { permission: true } } } },
      },
    });

    if (branchRoles.length === 0) {
      throw new UnauthorizedException('User has no active branch access');
    }

    const activeTenantModules = await this.prisma.tenantModule.findMany({
      where: { tenantId, enabled: true },
      include: { module: true },
    });

    const coreModules = await this.prisma.systemModule.findMany({
      where: { isCore: true },
    });

    const enabledModuleCodes = new Set([
      ...activeTenantModules.map((tm) => tm.module.code),
      ...coreModules.map((m) => m.code),
    ]);

    const branchIds = [...new Set(branchRoles.map((item) => item.branchId))];
    const roleIds = [...new Set(branchRoles.map((item) => item.roleId))];
    const permissions = [
      ...new Set(
        branchRoles.flatMap((item) =>
          item.role.permissions
            .filter((rp) => enabledModuleCodes.has(rp.permission.moduleCode))
            .map((rolePermission) => rolePermission.permission.code),
        ),
      ),
    ].sort();
    const branches = branchRoles.map((item) => ({
      id: item.branch.id,
      code: item.branch.code,
      name: item.branch.name,
    }));

    return { branchIds, roleIds, permissions, branches };
  }

  private async bootstrapFromIds(
    _userId: string,
    tenantId: string,
    context: Awaited<ReturnType<AuthService['buildAuthContext']>>,
  ): Promise<BootstrapPayload> {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const tenantModules = await this.prisma.tenantModule.findMany({
      where: { tenantId, enabled: true },
      include: { module: true },
    });

    return {
      tenant: {
        id: tenant.id,
        code: tenant.code,
        name: tenant.name,
        locale: tenant.defaultLocale,
        subscriptionPlan: tenant.subscriptionPlan,
        customDomain: tenant.customDomain,
        brandColor: tenant.brandColor,
        accentColor: tenant.accentColor,
        logoUrl: tenant.logoUrl,
        faviconUrl: tenant.faviconUrl,
        region: tenant.region,
      },
      enabledModules: tenantModules.map((item) => item.module.code).sort(),
      permissions: context.permissions,
      branches: context.branches,
      featureFlags: Object.fromEntries(
        tenantModules.map((item) => [`${item.module.code}.enabled`, true]),
      ),
    };
  }

  private async signAccessToken(payload: JwtAccessPayload): Promise<string> {
    return this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_TTL', '15m') as JwtSignOptions['expiresIn'],
    });
  }

  private async signRefreshToken(payload: RefreshPayload): Promise<string> {
    return this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>('JWT_REFRESH_TTL', '30d') as JwtSignOptions['expiresIn'],
    });
  }

  private async cacheSession(
    sessionId: string,
    tenantId: string,
    userId: string,
    fingerprint: string,
  ): Promise<void> {
    await this.redis
      .multi()
      .hset(`session:${sessionId}:metadata`, { tenantId, userId })
      .set(`session:${sessionId}:fingerprint`, fingerprint, 'EX', SESSION_SECONDS)
      .del(`session:${sessionId}:revoked`)
      .expire(`session:${sessionId}:metadata`, SESSION_SECONDS)
      .exec();
  }

  private async revokeSession(sessionId: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.redis.set(`session:${sessionId}:revoked`, '1', 'EX', SESSION_SECONDS);
  }

  async verifyMfa(dto: MfaVerifyDto, metadata: RequestMetadata): Promise<TokenResult> {
    let payload: { sub: string; tenant_id: string; branch_id?: string; is_mfa_pending?: boolean };
    try {
      payload = await this.jwt.verifyAsync(dto.mfaToken, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('MFA token is invalid or expired');
    }

    if (!payload.is_mfa_pending) {
      throw new UnauthorizedException('Invalid token purpose');
    }

    const mfaSettings = await this.prisma.user2faSettings.findUnique({
      where: { userId: payload.sub },
    });

    if (!mfaSettings || !mfaSettings.isEnabled) {
      throw new UnauthorizedException('2FA is not enabled for this user');
    }

    let isValid = false;
    let isBackupCodeUsed = false;
    let updatedBackupCodes: any = null;

    if (dto.code.length === 8) {
      const hashedCodes = mfaSettings.backupCodes ? (mfaSettings.backupCodes as string[]) : [];
      for (let i = 0; i < hashedCodes.length; i++) {
        const match = await argon2.verify(hashedCodes[i], dto.code);
        if (match) {
          isValid = true;
          isBackupCodeUsed = true;
          hashedCodes.splice(i, 1);
          updatedBackupCodes = hashedCodes;
          break;
        }
      }
    } else {
      isValid = verifyTOTP(dto.code, mfaSettings.secretHash);
    }

    if (!isValid) {
      await this.audit.log({
        tenantId: payload.tenant_id,
        userId: payload.sub,
        action: isBackupCodeUsed ? 'auth.backup_code.failed' : 'auth.2fa.failed',
        ipAddress: metadata.ipAddress,
        userAgent: this.userAgent(metadata),
      });
      throw new UnauthorizedException(
        isBackupCodeUsed ? 'Invalid backup code' : 'Invalid 2FA code',
      );
    }

    if (isBackupCodeUsed) {
      await this.prisma.user2faSettings.update({
        where: { userId: payload.sub },
        data: { backupCodes: updatedBackupCodes },
      });
      await this.audit.log({
        tenantId: payload.tenant_id,
        userId: payload.sub,
        action: 'auth.backup_code.used',
      });
    }

    const context = await this.buildAuthContext(payload.sub, payload.tenant_id, payload.branch_id);
    const sessionId = randomUUID();
    const fingerprint = randomBytes(32).toString('hex');
    const refreshToken = await this.signRefreshToken({
      sub: payload.sub,
      tenant_id: payload.tenant_id,
      session_id: sessionId,
      fingerprint,
    });
    const accessToken = await this.signAccessToken({
      sub: payload.sub,
      tenant_id: payload.tenant_id,
      branch_ids: context.branchIds,
      role_ids: context.roleIds,
      permissions: context.permissions,
      session_id: sessionId,
    });

    await this.prisma.userSession.create({
      data: {
        id: sessionId,
        userId: payload.sub,
        tenantId: payload.tenant_id,
        refreshTokenHash: await argon2.hash(refreshToken),
        ipAddress: metadata.ipAddress,
        userAgent: this.userAgent(metadata),
        deviceName: dto.deviceName,
        tokenFingerprint: fingerprint,
        expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000),
      },
    });

    await this.prisma.user.update({
      where: { id: payload.sub },
      data: { lastLoginAt: new Date() },
    });
    await this.cacheSession(sessionId, payload.tenant_id, payload.sub, fingerprint);
    await this.audit.log({
      tenantId: payload.tenant_id,
      userId: payload.sub,
      action: 'auth.login.success',
      ipAddress: metadata.ipAddress,
      userAgent: this.userAgent(metadata),
    });

    return {
      accessToken,
      refreshToken,
      bootstrap: await this.bootstrapFromIds(payload.sub, payload.tenant_id, context),
    };
  }

  async getMfaStatus(user: AuthenticatedUser): Promise<{ isEnabled: boolean }> {
    const settings = await this.prisma.user2faSettings.findUnique({
      where: { userId: user.userId },
    });
    return { isEnabled: settings?.isEnabled ?? false };
  }

  async enableMfa(user: AuthenticatedUser): Promise<{ secret: string; qrCodeUri: string }> {
    const secret = generateSecret();
    const dbUser = await this.prisma.user.findUniqueOrThrow({ where: { id: user.userId } });
    const qrCodeUri = `otpauth://totp/MedCRM:${dbUser.email}?secret=${secret}&issuer=MedCRM&period=30`;

    await this.prisma.user2faSettings.upsert({
      where: { userId: user.userId },
      update: {
        secretHash: secret,
        isEnabled: false,
      },
      create: {
        userId: user.userId,
        secretHash: secret,
        isEnabled: false,
      },
    });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'auth.2fa.setup_initiated',
    });

    return { secret, qrCodeUri };
  }

  async confirmMfa(
    user: AuthenticatedUser,
    dto: MfaConfirmDto,
  ): Promise<{ success: boolean; backupCodes: string[] }> {
    const mfaSettings = await this.prisma.user2faSettings.findUnique({
      where: { userId: user.userId },
    });

    if (!mfaSettings) {
      throw new UnauthorizedException('MFA setup was not initiated');
    }

    const isValid = verifyTOTP(dto.code, mfaSettings.secretHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid 2FA code');
    }

    const plaintextBackupCodes: string[] = [];
    const hashedBackupCodes: string[] = [];
    for (let i = 0; i < 10; i++) {
      const code = String(randomInt(10000000, 99999999));
      plaintextBackupCodes.push(code);
      hashedBackupCodes.push(await argon2.hash(code));
    }

    await this.prisma.user2faSettings.update({
      where: { userId: user.userId },
      data: {
        isEnabled: true,
        backupCodes: hashedBackupCodes,
      },
    });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'auth.2fa.enabled',
    });

    return { success: true, backupCodes: plaintextBackupCodes };
  }

  async disableMfa(user: AuthenticatedUser, dto: MfaConfirmDto): Promise<{ success: boolean }> {
    const mfaSettings = await this.prisma.user2faSettings.findUnique({
      where: { userId: user.userId },
    });

    if (!mfaSettings || !mfaSettings.isEnabled) {
      throw new UnauthorizedException('MFA is not enabled');
    }

    const isValid = verifyTOTP(dto.code, mfaSettings.secretHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid 2FA code');
    }

    await this.prisma.user2faSettings.delete({
      where: { userId: user.userId },
    });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'auth.2fa.disabled',
    });

    return { success: true };
  }

  private userAgent(metadata: RequestMetadata): string | undefined {
    if (!metadata.userAgent) {
      return undefined;
    }
    return Array.isArray(metadata.userAgent) ? metadata.userAgent.join(', ') : metadata.userAgent;
  }
}
