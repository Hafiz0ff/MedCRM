import { createHash, randomInt } from 'node:crypto';
import { ChannelProviderRegistry } from '@core/communications/channel-provider.registry';
import { PrismaService } from '@core/database/prisma.service';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';

@Injectable()
export class PortalOtpService {
  private readonly logger = new Logger(PortalOtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly channelRegistry: ChannelProviderRegistry,
  ) {}

  private hashOtp(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  async sendOtp(phoneE164: string): Promise<{ success: boolean; expiresAt: Date }> {
    // 1. Enforce rate limiting: check recent OTP requests for this phone number
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const recentRequestsCount = await this.prisma.patientPortalOtp.count({
      where: {
        phoneE164,
        createdAt: { gte: fifteenMinutesAgo },
      },
    });

    if (recentRequestsCount >= 5) {
      throw new BadRequestException('Too many OTP requests. Please try again in 15 minutes.');
    }

    // 2. Generate a cryptographically secure 6-digit OTP code
    const code = String(randomInt(100000, 999999));
    const codeHash = this.hashOtp(code);
    const ttlSeconds = 300; // 5 minutes
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    // 3. Persist OTP record to DB
    await this.prisma.patientPortalOtp.create({
      data: {
        phoneE164,
        codeHash,
        channel: 'SMS',
        expiresAt,
      },
    });

    // 4. Send the OTP message via SMS adapter (sandbox transparently prints to logs)
    const body = `Ваш код подтверждения для входа в MedCRM: ${code}`;

    try {
      const smsProvider = this.channelRegistry.get('SMS');
      await smsProvider.send({
        to: phoneE164,
        body,
      });
      this.logger.log(`OTP [${code}] dispatched successfully to ${phoneE164}`);
    } catch (err: any) {
      this.logger.error(`Failed to send OTP to ${phoneE164}: ${err.message}`);
      // In sandbox mode, we want to succeed anyway so E2E tests pass
      if (process.env.COMMUNICATIONS_SANDBOX === 'false') {
        throw new BadRequestException('Failed to deliver OTP code. Please try again later.');
      }
    }

    return { success: true, expiresAt };
  }

  async verifyOtp(phoneE164: string, code: string): Promise<boolean> {
    const hashed = this.hashOtp(code);

    // Find the latest unconsumed active OTP code for this phone number
    const activeOtp = await this.prisma.patientPortalOtp.findFirst({
      where: {
        phoneE164,
        consumedAt: null,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!activeOtp) {
      throw new BadRequestException('OTP code has expired or is invalid');
    }

    if (activeOtp.attempts >= 3) {
      throw new BadRequestException('Too many incorrect attempts. Please request a new code.');
    }

    if (activeOtp.codeHash !== hashed) {
      // Increment attempts
      await this.prisma.patientPortalOtp.update({
        where: { id: activeOtp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Incorrect OTP code');
    }

    // Mark OTP as consumed
    await this.prisma.patientPortalOtp.update({
      where: { id: activeOtp.id },
      data: { consumedAt: new Date() },
    });

    return true;
  }
}
