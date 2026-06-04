import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';

/**
 * Error thrown when a ciphertext decryption fails due to invalid parameters or key issues.
 */
export class DecryptionFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DecryptionFailedError';
  }
}

/**
 * Error thrown when the requested DEK key version is not found in the database.
 */
export class EncryptionKeyNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EncryptionKeyNotFoundError';
  }
}

/**
 * Service to manage tenant-level database field encryption (using AES-256-GCM and KMS Master KEK).
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly KEK: Buffer;
  private readonly dekCache = new Map<
    string,
    { dek: Buffer; version: number; expiresAt: number }
  >();
  private readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache duration

  constructor(
    private readonly config: ConfigService,
    @Inject(forwardRef(() => PrismaService))
    private readonly prisma: PrismaService,
  ) {
    const masterKey = this.config.getOrThrow<string>('KMS_MASTER_KEY');
    this.KEK = createHash('sha256').update(masterKey).digest();
  }

  /**
   * Retrieves or generates a Data Encryption Key (DEK) for the tenant, cached in memory.
   */
  async getOrCreateTenantDek(tenantId: string): Promise<{ dek: Buffer; version: number }> {
    const now = Date.now();
    const cached = this.dekCache.get(tenantId);
    if (cached && cached.expiresAt > now) {
      return { dek: cached.dek, version: cached.version };
    }

    let keyRecord = await this.prisma.encryptionKey.findFirst({
      where: { tenantId, state: 'active' },
      orderBy: { version: 'desc' },
    });

    if (!keyRecord) {
      this.logger.log(`No active DEK found for tenant ${tenantId}. Generating new version 1...`);
      const newDek = randomBytes(32);
      const encryptedDek = this.encryptDekWithKek(newDek);

      keyRecord = await this.prisma.encryptionKey.create({
        data: {
          tenantId,
          version: 1,
          encryptedDek: new Uint8Array(encryptedDek),
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

  /**
   * Encrypts plaintext string using the active tenant DEK.
   */
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

  /**
   * Decrypts ciphertext JSON string using versioned tenant DEK. Throws typed errors on failures.
   */
  async decrypt(ciphertextJsonStr: string, tenantId: string): Promise<string> {
    if (!ciphertextJsonStr) return '';

    if (!ciphertextJsonStr.startsWith('{') || !ciphertextJsonStr.endsWith('}')) {
      throw new DecryptionFailedError('Invalid ciphertext format');
    }

    try {
      const { v, iv, tag, ct } = JSON.parse(ciphertextJsonStr);
      if (v === undefined || !iv || !tag || !ct) {
        throw new DecryptionFailedError('Missing fields in ciphertext payload');
      }
      const dek = await this.getTenantDekByVersion(tenantId, v);
      const decipher = createDecipheriv('aes-256-gcm', dek, Buffer.from(iv, 'base64'));
      decipher.setAuthTag(Buffer.from(tag, 'base64'));
      return Buffer.concat([decipher.update(Buffer.from(ct, 'base64')), decipher.final()]).toString(
        'utf8',
      );
    } catch (err: unknown) {
      if (err instanceof EncryptionKeyNotFoundError || err instanceof DecryptionFailedError) {
        throw err;
      }
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Decryption failed: ${errMsg}`);
      throw new DecryptionFailedError(`Decryption failed: ${errMsg}`);
    }
  }

  /**
   * Decrypts ciphertext string with an explicit migration strategy fallback for legacy plaintext.
   */
  async decryptWithMigrationStrategy(
    ciphertextJsonStr: string,
    tenantId: string,
    strategy: 'strict' | 'fallback-to-plaintext',
  ): Promise<string> {
    try {
      return await this.decrypt(ciphertextJsonStr, tenantId);
    } catch (err: unknown) {
      if (strategy === 'fallback-to-plaintext' && err instanceof DecryptionFailedError) {
        return ciphertextJsonStr;
      }
      throw err;
    }
  }

  private async getTenantDekByVersion(tenantId: string, version: number): Promise<Buffer> {
    const cacheKey = `${tenantId}:${version}`;
    const cached = this.dekCache.get(cacheKey);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      return cached.dek;
    }

    const keyRecord = await this.prisma.encryptionKey.findUnique({
      where: { tenantId_version: { tenantId, version } },
    });

    if (!keyRecord) {
      throw new EncryptionKeyNotFoundError(
        `Encryption key version ${version} not found for tenant ${tenantId}`,
      );
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
