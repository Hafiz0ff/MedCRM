import { createHash, randomInt } from 'node:crypto';
import { REDIS_CLIENT } from '@core/cache/redis.module';
import { PrismaService } from '@core/database/prisma.service';
import { computeBlindIndex, normalizePhone } from '@core/security/blind-index';
import { EncryptionService } from '@core/security/encryption.service';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class PortalConnectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  private getPortalSecret(): string {
    return this.config.getOrThrow<string>('PORTAL_JWT_ACCESS_SECRET');
  }

  // Generate a cryptographically signed signature for E2E patient connections
  private computeSignature(tenantId: string, patientId: string, expiresAt: number): string {
    const dataToSign = `${tenantId}:${patientId}:${expiresAt}`;
    return createHash('sha256')
      .update(dataToSign + this.getPortalSecret())
      .digest('hex');
  }

  async connectToClinic(
    accountId: string,
    tenantCode: string,
  ): Promise<{ success: boolean; clinicName: string }> {
    // 1. Find the tenant by code
    const tenant = await this.prisma.tenant.findUnique({
      where: { code: tenantCode },
    });

    if (!tenant) {
      throw new NotFoundException('Clinic not found');
    }

    // 2. Fetch the portal account's phone number
    const account = await this.prisma.patientPortalAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException('Portal account not found');
    }

    // 3. Load the tenant's DEK and compute the blind index of the normalized phone number
    const { dek } = await this.encryption.getOrCreateTenantDek(tenant.id);
    const phoneBi = computeBlindIndex(normalizePhone(account.phoneE164), dek);

    // 4. Query the PatientContact model on this tenant for a phone number match
    const matchingContact = await this.prisma.patientContact.findFirst({
      where: {
        tenantId: tenant.id,
        type: 'PHONE',
        valueBi: phoneBi,
      },
      select: { patientId: true },
    });

    if (!matchingContact) {
      throw new BadRequestException(
        'You are not registered as a patient in this clinic. Please contact the clinic receptionist.',
      );
    }

    // 5. Create or activate the PatientPortalGrant record
    await this.prisma.patientPortalGrant.upsert({
      where: {
        accountId_tenantId_patientId: {
          accountId,
          tenantId: tenant.id,
          patientId: matchingContact.patientId,
        },
      },
      update: {
        state: 'ACTIVE',
      },
      create: {
        accountId,
        tenantId: tenant.id,
        patientId: matchingContact.patientId,
        grantedVia: 'DIRECT_CONNECT',
      },
    });

    return {
      success: true,
      clinicName: tenant.name,
    };
  }

  // --- Short PIN Connections ---

  async generateConnectionPin(
    tenantId: string,
    patientId: string,
  ): Promise<{ pin: string; expiresAt: Date }> {
    // 1. Generate 6-digit numeric PIN
    const pin = String(randomInt(100000, 999999));
    const ttlSeconds = 900; // 15 minutes
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    // 2. Store in Redis
    const cacheKey = `portal_connect_pin:${pin}`;
    const payload = JSON.stringify({ tenantId, patientId });
    await this.redis.setex(cacheKey, ttlSeconds, payload);

    return { pin, expiresAt };
  }

  async connectViaPin(
    accountId: string,
    pin: string,
  ): Promise<{ success: boolean; clinicName: string }> {
    const cacheKey = `portal_connect_pin:${pin}`;
    const cached = await this.redis.get(cacheKey);

    if (!cached) {
      throw new BadRequestException('Connection PIN is invalid or has expired');
    }

    const { tenantId, patientId } = JSON.parse(cached);

    // Load tenant name
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
    });

    // Link the patient
    await this.prisma.patientPortalGrant.upsert({
      where: {
        accountId_tenantId_patientId: {
          accountId,
          tenantId,
          patientId,
        },
      },
      update: { state: 'ACTIVE' },
      create: {
        accountId,
        tenantId,
        patientId,
        grantedVia: 'PIN_CODE',
      },
    });

    // Delete PIN to make it single-use
    await this.redis.del(cacheKey);

    return {
      success: true,
      clinicName: tenant.name,
    };
  }

  // --- Signed Deeplinks / QR Code Connections ---

  async generateSignedDeeplink(
    tenantId: string,
    patientId: string,
  ): Promise<{ patientId: string; expiresAt: number; signature: string }> {
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours link TTL
    const signature = this.computeSignature(tenantId, patientId, expiresAt);

    return {
      patientId,
      expiresAt,
      signature,
    };
  }

  async connectViaSignedDeeplink(
    accountId: string,
    tenantCode: string,
    patientId: string,
    expiresAt: number,
    signature: string,
  ): Promise<{ success: boolean; clinicName: string }> {
    // 1. Verify expiration
    if (Date.now() > expiresAt) {
      throw new BadRequestException('Signed connection link has expired');
    }

    // 2. Load tenant
    const tenant = await this.prisma.tenant.findUnique({
      where: { code: tenantCode },
    });

    if (!tenant) {
      throw new NotFoundException('Clinic not found');
    }

    // 3. Compute expected signature and compare
    const expected = this.computeSignature(tenant.id, patientId, expiresAt);
    if (expected !== signature) {
      throw new BadRequestException('Invalid connection signature');
    }

    // 4. Create or activate PatientPortalGrant
    await this.prisma.patientPortalGrant.upsert({
      where: {
        accountId_tenantId_patientId: {
          accountId,
          tenantId: tenant.id,
          patientId,
        },
      },
      update: { state: 'ACTIVE' },
      create: {
        accountId,
        tenantId: tenant.id,
        patientId,
        grantedVia: 'SIGNED_DEEPLINK',
      },
    });

    return {
      success: true,
      clinicName: tenant.name,
    };
  }

  // --- Linked Clinics Query ---

  async getConnectedClinics(accountId: string) {
    const grants = await this.prisma.patientPortalGrant.findMany({
      where: { accountId, state: 'ACTIVE' },
      include: {
        tenant: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    return grants.map((g) => ({
      tenantId: g.tenant.id,
      tenantCode: g.tenant.code,
      clinicName: g.tenant.name,
      patientId: g.patientId,
      connectedAt: g.grantedAt,
    }));
  }
}
