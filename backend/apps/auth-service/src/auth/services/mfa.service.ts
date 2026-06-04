import { randomBytes, randomUUID, randomInt } from 'node:crypto';
import { PrismaService } from '@core/database/prisma.service';
import { AuthenticatedUser } from '@core/security/jwt-payload';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { MfaConfirmDto, MfaVerifyDto } from '../dto/mfa.dto';
import { generateSecret, verifyTOTP } from '../utils/totp';
import { AuthAuditService, RequestMetadata } from './auth-audit.service';
import { BootstrapService, BootstrapPayload } from './bootstrap.service';
import { SessionService } from './session.service';

const SESSION_SECONDS = 60 * 60 * 24 * 30;

export type TokenResult = {
  accessToken?: string;
  refreshToken?: string;
  bootstrap?: BootstrapPayload;
  mfaRequired?: boolean;
  mfaToken?: string;
};

/**
 * Service to manage Multi-Factor Authentication logic.
 */
@Injectable()
export class MfaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly sessionService: SessionService,
    private readonly bootstrapService: BootstrapService,
    private readonly audit: AuthAuditService,
  ) {}

  /**
   * Checks if MFA is enabled for the specified user.
   */
  async getMfaStatus(user: AuthenticatedUser): Promise<{ isEnabled: boolean }> {
    const settings = await this.prisma.user2faSettings.findUnique({
      where: { userId: user.userId },
    });
    return { isEnabled: settings?.isEnabled ?? false };
  }

  /**
   * Initiates MFA setup by generating a shared TOTP secret and QR code URI.
   */
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

  /**
   * Confirms and activates MFA setup after validating the first code.
   * Generates and returns backup codes.
   */
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

  /**
   * Disables MFA for the user after validating a final code.
   */
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

  /**
   * Verifies the MFA challenge code and returns active session tokens.
   */
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
    let updatedBackupCodes: string[] | null = null;

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
        userAgent: this.audit.userAgent(metadata),
      });
      throw new UnauthorizedException(
        isBackupCodeUsed ? 'Invalid backup code' : 'Invalid 2FA code',
      );
    }

    if (isBackupCodeUsed) {
      await this.prisma.user2faSettings.update({
        where: { userId: payload.sub },
        data: { backupCodes: updatedBackupCodes as Prisma.InputJsonValue },
      });
      await this.audit.log({
        tenantId: payload.tenant_id,
        userId: payload.sub,
        action: 'auth.backup_code.used',
      });
    }

    const context = await this.bootstrapService.buildAuthContext(
      payload.sub,
      payload.tenant_id,
      payload.branch_id,
    );
    const sessionId = randomUUID();
    const fingerprint = randomBytes(32).toString('hex');

    const refreshToken = await this.jwt.signAsync(
      {
        sub: payload.sub,
        tenant_id: payload.tenant_id,
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
        sub: payload.sub,
        tenant_id: payload.tenant_id,
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
        userId: payload.sub,
        tenantId: payload.tenant_id,
        refreshTokenHash: await argon2.hash(refreshToken),
        ipAddress: metadata.ipAddress,
        userAgent: this.audit.userAgent(metadata),
        deviceName: dto.deviceName,
        tokenFingerprint: fingerprint,
        expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000),
      },
    });

    await this.prisma.user.update({
      where: { id: payload.sub },
      data: { lastLoginAt: new Date() },
    });
    await this.sessionService.cacheSession(sessionId, payload.tenant_id, payload.sub, fingerprint);
    await this.audit.log({
      tenantId: payload.tenant_id,
      userId: payload.sub,
      action: 'auth.login.success',
      ipAddress: metadata.ipAddress,
      userAgent: this.audit.userAgent(metadata),
    });

    return {
      accessToken,
      refreshToken,
      bootstrap: await this.bootstrapService.bootstrapFromIds(
        payload.sub,
        payload.tenant_id,
        context,
      ),
    };
  }
}
