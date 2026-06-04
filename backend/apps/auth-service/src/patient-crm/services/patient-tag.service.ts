import { PrismaService } from '@core/database/prisma.service';
import { AuthenticatedUser } from '@core/security/jwt-payload';
import { Injectable, NotFoundException } from '@nestjs/common';
import { CrmTagDto } from '../dto/patient-crm.dto';
import { PatientTimelineService } from './patient-timeline.service';

/**
 * Service responsible for CRM tag management and patient tag assignment.
 */
@Injectable()
export class PatientTagService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timeline: PatientTimelineService,
  ) {}

  /**
   * Lists all CRM tags for the tenant.
   */
  async listTags(user: AuthenticatedUser) {
    return this.prisma.crmTag.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { code: 'asc' },
    });
  }

  /**
   * Creates a new CRM tag within the tenant scope.
   */
  async createTag(user: AuthenticatedUser, dto: CrmTagDto) {
    return this.prisma.crmTag.create({
      data: {
        tenantId: user.tenantId,
        code: dto.code,
        name: dto.name,
        color: dto.color,
      },
    });
  }

  /**
   * Assigns a tag to a patient. Idempotent via upsert.
   */
  async assignTag(user: AuthenticatedUser, patientId: string, tagId: string) {
    await this.assertPatientExists(user, patientId);
    const tag = await this.prisma.crmTag.findFirst({
      where: { id: tagId, tenantId: user.tenantId },
    });
    if (!tag) throw new NotFoundException('Tag not found');

    const pt = await this.prisma.patientTag.upsert({
      where: { patientId_tagId: { patientId, tagId } },
      update: {},
      create: {
        tenantId: user.tenantId,
        patientId,
        tagId,
        assignedBy: user.userId,
      },
    });

    await this.timeline.addTimelineEvent(user, patientId, {
      eventType: 'TAG_ASSIGNED',
      eventSource: 'SYSTEM',
      title: `Присвоен тег: ${tag.name}`,
      metadataJson: { tagId, tagCode: tag.code },
    });

    return pt;
  }

  /**
   * Removes a tag from a patient.
   */
  async removeTag(user: AuthenticatedUser, patientId: string, tagId: string) {
    await this.assertPatientExists(user, patientId);
    await this.prisma.patientTag.delete({
      where: { patientId_tagId: { patientId, tagId } },
    });
    return { success: true };
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
