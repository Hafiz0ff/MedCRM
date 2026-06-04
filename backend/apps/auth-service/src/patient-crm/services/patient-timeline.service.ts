import { PrismaService } from '@core/database/prisma.service';
import { AuthenticatedUser } from '@core/security/jwt-payload';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PatientNoteDto, PatientTimelineEventDto } from '../dto/patient-crm.dto';

/**
 * Service responsible for patient timeline events and notes.
 * Provides a unified chronological history of patient interactions.
 */
@Injectable()
export class PatientTimelineService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns all timeline events for a patient ordered by most recent first.
   */
  async getTimeline(user: AuthenticatedUser, patientId: string) {
    await this.assertPatientExists(user, patientId);
    return this.prisma.patientTimelineEvent.findMany({
      where: { tenantId: user.tenantId, patientId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Creates a new internal note and adds a corresponding timeline event.
   */
  async createNote(user: AuthenticatedUser, patientId: string, dto: PatientNoteDto) {
    await this.assertPatientExists(user, patientId);
    const note = await this.prisma.patientNote.create({
      data: {
        tenantId: user.tenantId,
        patientId,
        note: dto.note,
        visibility: dto.visibility,
        createdBy: user.userId,
      },
    });

    await this.addTimelineEvent(user, patientId, {
      eventType: 'NOTE',
      eventSource: 'STAFF',
      title: 'Добавлена заметка',
      description: dto.note.length > 60 ? dto.note.slice(0, 60) + '...' : dto.note,
      metadataJson: { noteId: note.id },
    });

    return note;
  }

  /**
   * Adds a generic timeline event to a patient's history.
   * Used by other services to log domain-specific events.
   */
  async addTimelineEvent(user: AuthenticatedUser, patientId: string, dto: PatientTimelineEventDto) {
    return this.prisma.patientTimelineEvent.create({
      data: {
        tenantId: user.tenantId,
        patientId,
        eventType: dto.eventType,
        eventSource: dto.eventSource,
        title: dto.title,
        description: dto.description,
        metadataJson: dto.metadataJson ?? undefined,
        createdBy: user.userId,
      },
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
