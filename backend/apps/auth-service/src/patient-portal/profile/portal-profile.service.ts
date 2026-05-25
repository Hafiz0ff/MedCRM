import { createHash } from 'node:crypto';
import { AuditLoggerService } from '@core/audit/audit-logger.service';
import { PrismaService } from '@core/database/prisma.service';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedPortalUser } from '../auth/patient-jwt-payload';

@Injectable()
export class PortalProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLoggerService,
  ) {}

  private async resolveGrant(accountId: string, tenantCode: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { code: tenantCode } });
    if (!tenant) throw new NotFoundException('Clinic not found');

    const grant = await this.prisma.patientPortalGrant.findFirst({
      where: { accountId, tenantId: tenant.id, state: 'ACTIVE' },
      include: { patient: { include: { contacts: true } } },
    });
    if (!grant) throw new ForbiddenException('You are not connected to this clinic');

    return { tenant, grant };
  }

  async getProfile(portalUser: AuthenticatedPortalUser, tenantCode: string) {
    const { grant } = await this.resolveGrant(portalUser.accountId, tenantCode);

    return {
      id: grant.patient.id,
      firstName: grant.patient.firstName,
      lastName: grant.patient.lastName,
      middleName: grant.patient.middleName,
      birthDate: grant.patient.birthDate,
      gender: grant.patient.gender,
      phone: grant.patient.contacts.find((c) => c.isPrimary && c.type === 'PHONE')?.value,
    };
  }

  async listConsents(portalUser: AuthenticatedPortalUser, tenantCode: string) {
    const { tenant, grant } = await this.resolveGrant(portalUser.accountId, tenantCode);

    const documents = await this.prisma.patientLegalDocument.findMany({
      where: {
        tenantId: tenant.id,
        patientId: grant.patientId,
        status: 'ACTIVE',
      },
      include: {
        documentType: true,
      },
      orderBy: { signedAt: 'desc' },
    });

    return documents.map((d) => ({
      id: d.id,
      documentType: {
        id: d.documentType.id,
        code: d.documentType.code,
        name: d.documentType.name,
      },
      signedAt: d.signedAt,
      status: d.status,
    }));
  }

  async listMissingConsents(portalUser: AuthenticatedPortalUser, tenantCode: string) {
    const { tenant, grant } = await this.resolveGrant(portalUser.accountId, tenantCode);

    // Get all required document types
    const requiredTypes = await this.prisma.legalDocumentType.findMany({
      where: {
        OR: [{ tenantId: tenant.id }, { tenantId: null }],
        isRequired: true,
      },
    });

    // Get existing active consents
    const existingConsents = await this.prisma.patientLegalDocument.findMany({
      where: {
        tenantId: tenant.id,
        patientId: grant.patientId,
        status: 'ACTIVE',
        documentTypeId: { in: requiredTypes.map((t) => t.id) },
      },
    });

    const existingTypeIds = new Set(existingConsents.map((c) => c.documentTypeId));
    const missingTypes = requiredTypes.filter((t) => !existingTypeIds.has(t.id));

    return missingTypes.map((t) => ({
      id: t.id,
      code: t.code,
      name: t.name,
    }));
  }

  async signConsent(
    portalUser: AuthenticatedPortalUser,
    tenantCode: string,
    documentTypeId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const { tenant, grant } = await this.resolveGrant(portalUser.accountId, tenantCode);

    const docType = await this.prisma.legalDocumentType.findUnique({
      where: { id: documentTypeId },
    });
    if (!docType) throw new NotFoundException('Document type not found');

    // Generate a simple hash to act as a digital trace (since DigitalSignature model expects an Encounter)
    const tracePayload = `${grant.patientId}:${docType.id}:${Date.now()}:${ipAddress}`;
    const traceHash = createHash('sha256').update(tracePayload).digest('hex');

    const document = await this.prisma.patientLegalDocument.create({
      data: {
        tenantId: tenant.id,
        patientId: grant.patientId,
        documentTypeId: docType.id,
        status: 'ACTIVE',
        documentNumber: `CONSENT-${Date.now()}`, // Mock number
      },
    });

    await this.audit.log({
      tenantId: tenant.id,
      userId: grant.patientId, // Patient acts as user
      action: 'consent.signed',
      entityType: 'PatientLegalDocument',
      entityId: document.id,
      ipAddress,
      userAgent,
      newValuesJson: { documentTypeId, docCode: docType.code, traceHash },
    });

    return { success: true, documentId: document.id, signedAt: document.signedAt };
  }

  async revokeConsent(
    portalUser: AuthenticatedPortalUser,
    tenantCode: string,
    documentId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const { tenant, grant } = await this.resolveGrant(portalUser.accountId, tenantCode);

    const doc = await this.prisma.patientLegalDocument.findFirst({
      where: { id: documentId, tenantId: tenant.id, patientId: grant.patientId },
    });
    if (!doc) throw new NotFoundException('Consent document not found');

    const updated = await this.prisma.patientLegalDocument.update({
      where: { id: documentId },
      data: { status: 'REVOKED' },
    });

    await this.audit.log({
      tenantId: tenant.id,
      userId: grant.patientId,
      action: 'consent.revoked',
      entityType: 'PatientLegalDocument',
      entityId: documentId,
      ipAddress,
      userAgent,
      oldValuesJson: { status: doc.status },
      newValuesJson: { status: updated.status },
    });

    return { success: true, status: updated.status };
  }
}
