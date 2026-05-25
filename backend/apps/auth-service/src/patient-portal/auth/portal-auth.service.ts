import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '@core/database/prisma.service';
import { normalizePhone } from '@core/security/blind-index';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PortalOtpService } from './portal-otp.service';

@Injectable()
export class PortalAuthService {
  private readonly logger = new Logger(PortalAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly otpService: PortalOtpService,
  ) {}

  private computePortalPhoneBi(phone: string): string {
    return createHash('sha256').update(normalizePhone(phone)).digest('hex');
  }

  async requestOtp(phone: string): Promise<{ success: boolean; expiresAt: Date }> {
    const normalized = normalizePhone(phone);
    if (!normalized || normalized.length < 9) {
      throw new BadRequestException('Invalid phone number format');
    }
    const phoneE164 = `+${normalized}`;
    return this.otpService.sendOtp(phoneE164);
  }

  async verifyOtpAndLogin(
    phone: string,
    code: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<{ accessToken: string; refreshToken: string; account: any }> {
    const normalized = normalizePhone(phone);
    const phoneE164 = `+${normalized}`;

    // 1. Verify OTP code
    await this.otpService.verifyOtp(phoneE164, code);

    // 2. Fetch or create PatientPortalAccount
    let account = await this.prisma.patientPortalAccount.findUnique({
      where: { phoneE164 },
    });

    if (!account) {
      this.logger.log(`Registering new patient portal account for phone ${phoneE164}...`);
      account = await this.prisma.patientPortalAccount.create({
        data: {
          phoneE164,
          phoneBi: this.computePortalPhoneBi(phoneE164),
        },
      });
    }

    // 3. Create portal device session
    const refreshHash = createHash('sha256').update(randomBytes(32).toString('hex')).digest('hex');

    const session = await this.prisma.patientPortalSession.create({
      data: {
        accountId: account.id,
        refreshHash,
        userAgent,
        ipAddress,
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
      },
    });

    // 4. Issue JWT access and refresh tokens
    const payload = {
      sub: account.id,
      phone_e164: account.phoneE164,
      session_id: session.id,
    };

    const accessToken = this.jwt.sign(payload);

    // We reuse refreshHash directly as the refresh token token value
    const refreshToken = session.refreshHash;

    return {
      accessToken,
      refreshToken,
      account: {
        id: account.id,
        phoneE164: account.phoneE164,
        firstName: account.firstName,
        lastName: account.lastName,
        birthDate: account.birthDate,
      },
    };
  }

  async logout(sessionId: string): Promise<{ success: boolean }> {
    await this.prisma.patientPortalSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }
}
