import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly rawPrisma = new PrismaClient();
  private readonly KEK: Buffer;

  // Cache of decrypted DEKs: tenantId/cacheKey -> { dek, version, expiresAt }
  private readonly dekCache = new Map<
    string,
    { dek: Buffer; version: number; expiresAt: number }
  >();
  private readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache duration

  constructor() {
    const masterKey =
      process.env.KMS_MASTER_KEY || 'change_me_kms_master_key_default_32_bytes_fallback';
    this.KEK = createHash('sha256').update(masterKey).digest();
  }

  async getOrCreateTenantDek(tenantId: string): Promise<{ dek: Buffer; version: number }> {
    const now = Date.now();
    const cached = this.dekCache.get(tenantId);
    if (cached && cached.expiresAt > now) {
      return { dek: cached.dek, version: cached.version };
    }

    // Load active key from DB
    let keyRecord = await this.rawPrisma.encryptionKey.findFirst({
      where: { tenantId, state: 'active' },
      orderBy: { version: 'desc' },
    });

    if (!keyRecord) {
      this.logger.log(`No active DEK found for tenant ${tenantId}. Generating new version 1...`);
      const newDek = randomBytes(32);
      const encryptedDek = this.encryptDekWithKek(newDek);

      keyRecord = await this.rawPrisma.encryptionKey.create({
        data: {
          tenantId,
          version: 1,
          encryptedDek: encryptedDek as any,
          state: 'active',
        },
      });

      this.dekCache.set(tenantId, {
        dek: newDek,
        version: 1,
        expiresAt: now + this.CACHE_TTL_MS,
      });

      return { dek: newDek, version: 1 };
    }

    const decryptedDek = this.decryptDekWithKek(Buffer.from(keyRecord.encryptedDek));
    this.dekCache.set(tenantId, {
      dek: decryptedDek,
      version: keyRecord.version,
      expiresAt: now + this.CACHE_TTL_MS,
    });

    return { dek: decryptedDek, version: keyRecord.version };
  }

  private encryptDekWithKek(dek: Buffer): Buffer {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.KEK, iv);
    const encrypted = Buffer.concat([cipher.update(dek), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]);
  }

  private decryptDekWithKek(combined: Buffer): Buffer {
    const iv = combined.subarray(0, 12);
    const tag = combined.subarray(12, 28);
    const encrypted = combined.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', this.KEK, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }

  async encrypt(plaintext: string, tenantId: string): Promise<string> {
    if (!plaintext) return '';
    const { dek, version } = await this.getOrCreateTenantDek(tenantId);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', dek, iv);
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]).toString('base64');
    const tag = cipher.getAuthTag().toString('base64');
    const ivStr = iv.toString('base64');
    return JSON.stringify({ v: version, iv: ivStr, tag, ct });
  }

  async decrypt(ciphertextJsonStr: string, tenantId: string): Promise<string> {
    if (!ciphertextJsonStr) return '';

    // Check if it is a JSON. Return as-is if database contains legacy plaintext
    if (!ciphertextJsonStr.startsWith('{') || !ciphertextJsonStr.endsWith('}')) {
      return ciphertextJsonStr;
    }

    try {
      const { v, iv, tag, ct } = JSON.parse(ciphertextJsonStr);
      const dek = await this.getTenantDekByVersion(tenantId, v);
      const decipher = createDecipheriv('aes-256-gcm', dek, Buffer.from(iv, 'base64'));
      decipher.setAuthTag(Buffer.from(tag, 'base64'));
      return Buffer.concat([decipher.update(Buffer.from(ct, 'base64')), decipher.final()]).toString(
        'utf8',
      );
    } catch (err: any) {
      this.logger.error(`Decryption failed for ciphertext: ${err.message}`);
      return ciphertextJsonStr;
    }
  }

  private async getTenantDekByVersion(tenantId: string, version: number): Promise<Buffer> {
    const cacheKey = `${tenantId}:${version}`;
    const cached = this.dekCache.get(cacheKey);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      return cached.dek;
    }

    const keyRecord = await this.rawPrisma.encryptionKey.findUnique({
      where: { tenantId_version: { tenantId, version } },
    });

    if (!keyRecord) {
      throw new Error(`Encryption key version ${version} not found for tenant ${tenantId}`);
    }

    const decryptedDek = this.decryptDekWithKek(Buffer.from(keyRecord.encryptedDek));
    this.dekCache.set(cacheKey, {
      dek: decryptedDek,
      version,
      expiresAt: now + this.CACHE_TTL_MS,
    });

    return decryptedDek;
  }
}
