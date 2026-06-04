import { AuditLoggerService } from '@core/audit/audit-logger.service';
import { PrismaService } from '@core/database/prisma.service';
import { AuthenticatedUser } from '@core/security/jwt-payload';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PatientLegalDocumentDto } from '../dto/patient-crm.dto';
import { assertBranchAccess } from '../patient-crm.utils';
import { PatientTimelineService } from './patient-timeline.service';

/**
 * Service responsible for patient legal document management.
 * Handles document signing, listing, and template retrieval.
 */
@Injectable()
export class PatientDocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLoggerService,
    private readonly timeline: PatientTimelineService,
  ) {}

  /**
   * Lists all signed legal documents for a specific patient.
   */
  async listLegalDocuments(user: AuthenticatedUser, patientId: string) {
    await this.assertPatientExists(user, patientId);
    return this.prisma.patientLegalDocument.findMany({
      where: { tenantId: user.tenantId, patientId },
      include: { documentType: true, branch: true, signedByUser: true },
      orderBy: { signedAt: 'desc' },
    });
  }

  /**
   * Signs a legal document for a patient, creates a timeline event, and logs an audit entry.
   */
  async signLegalDocument(
    user: AuthenticatedUser,
    patientId: string,
    dto: PatientLegalDocumentDto,
  ) {
    await this.assertPatientExists(user, patientId);
    if (dto.branchId) assertBranchAccess(user, dto.branchId);

    const docType = await this.prisma.legalDocumentType.findUnique({
      where: { id: dto.documentTypeId },
    });
    if (!docType) throw new NotFoundException('Document type not found');

    const signedDoc = await this.prisma.patientLegalDocument.create({
      data: {
        tenantId: user.tenantId,
        patientId,
        documentTypeId: dto.documentTypeId,
        fileId: dto.fileId,
        documentNumber: dto.documentNumber,
        signedAt: dto.signedAt ? new Date(dto.signedAt) : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        retentionUntil: dto.retentionUntil ? new Date(dto.retentionUntil) : null,
        status: dto.status,
        signedByUserId: user.userId,
        branchId: dto.branchId ?? user.branchIds[0],
      },
    });

    await this.timeline.addTimelineEvent(user, patientId, {
      eventType: 'DOCUMENT_SIGNED',
      eventSource: 'SYSTEM',
      title: `Подписан документ: ${docType.name}`,
      description: dto.documentNumber ? `Номер документа: ${dto.documentNumber}` : undefined,
      metadataJson: { documentId: signedDoc.id },
    });

    await this.audit.log({
      tenantId: user.tenantId,
      branchId: dto.branchId ?? user.branchIds[0],
      userId: user.userId,
      action: 'patient.document.signed',
      entityType: 'patient_legal_document',
      entityId: signedDoc.id,
      newValuesJson: signedDoc,
    });

    return signedDoc;
  }

  /**
   * Lists available legal document templates (both global and tenant-specific).
   */
  async listTemplates(user: AuthenticatedUser) {
    return this.prisma.legalDocumentTemplate.findMany({
      where: { OR: [{ tenantId: null }, { tenantId: user.tenantId }] },
      include: { documentType: true },
    });
  }

  /**
   * Validates that a patient exists and belongs to the user's tenant.
   */
  private async assertPatientExists(user: AuthenticatedUser, patientId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: {
        id: patientId,
        tenantId: user.tenantId,
        OR: [{ registrationBranchId: null }, { registrationBranchId: { in: user.branchIds } }],
      },
    });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }
}
