import { createHmac, timingSafeEqual } from 'node:crypto';
import { AuditLoggerService } from '@core/audit/audit-logger.service';
import { PrismaService } from '@core/database/prisma.service';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthenticatedPortalUser } from '../auth/patient-jwt-payload';

@Injectable()
export class PortalDocumentsService {
  private readonly secretKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditLoggerService,
  ) {
    this.secretKey = this.config.getOrThrow<string>('PORTAL_JWT_ACCESS_SECRET');
  }

  /**
   * Generates a short-lived (15 min) signed URL for downloading a medical file.
   */
  async generateSignedUrl(user: AuthenticatedPortalUser, tenantCode: string, fileId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { code: tenantCode, status: 'ACTIVE' },
    });
    if (!tenant) {
      throw new NotFoundException('Clinic not found');
    }

    const grant = await this.prisma.patientPortalGrant.findFirst({
      where: { accountId: user.accountId, tenantId: tenant.id, state: 'ACTIVE' },
    });
    if (!grant) {
      throw new ForbiddenException('Not connected to this clinic');
    }

    const file = await this.prisma.medicalFile.findUnique({
      where: { id: fileId },
    });
    if (!file || file.tenantId !== tenant.id || file.patientId !== grant.patientId) {
      throw new NotFoundException('File not found or access denied');
    }

    // 15 minutes TTL
    const expiresAt = Math.floor(Date.now() / 1000) + 15 * 60;
    const signature = this.signPayload(tenantCode, fileId, expiresAt);

    // Using relative URL; the frontend will attach the correct origin
    const url = `/api/portal/v1/documents/${tenantCode}/${fileId}/download?expiresAt=${expiresAt}&signature=${signature}`;

    return { url, expiresAt, fileType: file.fileType };
  }

  /**
   * Verifies the signature and logs the download event.
   */
  async verifyAndDownload(
    tenantCode: string,
    fileId: string,
    expiresAt: number,
    signature: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    // 1. Verify expiration
    if (Math.floor(Date.now() / 1000) > expiresAt) {
      throw new ForbiddenException('Signed URL has expired');
    }

    // 2. Verify signature securely
    const expectedSignature = this.signPayload(tenantCode, fileId, expiresAt);
    if (!this.secureCompare(signature, expectedSignature)) {
      throw new ForbiddenException('Invalid signature');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { code: tenantCode },
    });
    if (!tenant) {
      throw new NotFoundException('Clinic not found');
    }

    const file = await this.prisma.medicalFile.findUnique({
      where: { id: fileId },
    });
    if (!file || file.tenantId !== tenant.id) {
      throw new NotFoundException('File not found');
    }

    // 3. Log audit event
    await this.audit.log({
      tenantId: tenant.id,
      userId: file.patientId, // Patient is the actor
      action: 'document.downloaded',
      entityType: 'MedicalFile',
      entityId: file.id,
      ipAddress,
      userAgent,
      newValuesJson: { fileType: file.fileType, mimeType: file.mimeType },
    });

    // 4. Return file location or stream
    // For MVP, we return a mock pre-signed URL or metadata since actual S3 is out of scope here.
    return {
      fileId: file.id,
      provider: file.storageProvider,
      path: file.filePath,
      mimeType: file.mimeType,
      downloadUrl: `https://mock-s3-bucket.s3.amazonaws.com/${file.filePath}`, // In a real scenario, generate an S3 presigned URL
    };
  }

  private signPayload(tenantCode: string, fileId: string, expiresAt: number): string {
    const payload = `${tenantCode}:${fileId}:${expiresAt}`;
    return createHmac('sha256', this.secretKey).update(payload).digest('hex');
  }

  private secureCompare(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }
}
