import { AuditLoggerService } from '@core/audit/audit-logger.service';
import { REDIS_CLIENT } from '@core/cache/redis.module';
import { PrismaService } from '@core/database/prisma.service';
import { AuthenticatedUser } from '@core/security/jwt-payload';
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import Redis from 'ioredis';
import {
  CreatePatientDto,
  UpdatePatientDto,
  PatientStatusTransitionDto,
} from '../dto/patient.schemas';
import { assertBranchAccess, fullName, normalize, hash } from '../patient-crm.utils';
import { PatientTimelineService } from './patient-timeline.service';

/**
 * Service to manage creating and updating patient records.
 */
@Injectable()
export class PatientCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLoggerService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly timeline: PatientTimelineService,
  ) {}

  /**
   * Creates a new patient record and maps initial contacts.
   */
  async create(user: AuthenticatedUser, dto: CreatePatientDto) {
    const branchId = dto.registrationBranchId ?? user.branchIds[0];
    assertBranchAccess(user, branchId);
    const computedFullName = fullName(dto);
    const patientCode = await this.nextPatientCode(user.tenantId);

    const patient = await this.prisma.patient.create({
      data: {
        tenantId: user.tenantId,
        patientCode,
        firstName: dto.firstName,
        lastName: dto.lastName,
        middleName: dto.middleName,
        fullName: computedFullName,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        gender: dto.gender,
        language: 'ru',
        status: dto.status,
        registrationBranchId: branchId,
        contacts: {
          create: [
            ...(dto.phone ? [this.contactCreate(user.tenantId, 'PHONE', dto.phone, true)] : []),
            ...(dto.email
              ? [this.contactCreate(user.tenantId, 'EMAIL', dto.email, !dto.phone)]
              : []),
          ],
        },
      },
      include: { contacts: true, registrationBranch: true },
    });

    await this.audit.log({
      tenantId: user.tenantId,
      branchId,
      userId: user.userId,
      action: 'patient.created',
      entityType: 'patient',
      entityId: patient.id,
      newValuesJson: patient,
    });
    return patient;
  }

  /**
   * Updates basic patient profile details.
   */
  async update(user: AuthenticatedUser, id: string, dto: UpdatePatientDto) {
    const current = await this.prisma.patient.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
        OR: [{ registrationBranchId: null }, { registrationBranchId: { in: user.branchIds } }],
      },
      include: { contacts: true, registrationBranch: true },
    });
    if (!current) throw new NotFoundException('Patient not found');

    const branchId = dto.registrationBranchId ?? current.registrationBranchId ?? user.branchIds[0];
    assertBranchAccess(user, branchId);

    const patient = await this.prisma.patient.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        middleName: dto.middleName,
        fullName:
          dto.firstName || dto.lastName || dto.middleName
            ? fullName({ ...current, ...dto })
            : undefined,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        gender: dto.gender,
        status: dto.status,
        registrationBranchId: branchId,
      },
      include: { contacts: true, registrationBranch: true },
    });

    await this.audit.log({
      tenantId: user.tenantId,
      branchId,
      userId: user.userId,
      action: 'patient.updated',
      entityType: 'patient',
      entityId: patient.id,
      oldValuesJson: current,
      newValuesJson: patient,
    });
    return patient;
  }

  /**
   * Transitions patient status and writes a timeline event.
   */
  async updateStatus(user: AuthenticatedUser, patientId: string, dto: PatientStatusTransitionDto) {
    const current = await this.prisma.patient.findFirst({
      where: {
        id: patientId,
        tenantId: user.tenantId,
        OR: [{ registrationBranchId: null }, { registrationBranchId: { in: user.branchIds } }],
      },
    });
    if (!current) throw new NotFoundException('Patient not found');

    const updated = await this.prisma.patient.update({
      where: { id: patientId },
      data: { status: dto.status },
    });

    await this.timeline.addTimelineEvent(user, patientId, {
      eventType: 'STATUS_CHANGED',
      eventSource: 'SYSTEM',
      title: `Статус изменен: ${dto.status}`,
      description: `Предыдущий статус: ${current.status}`,
    });

    await this.audit.log({
      tenantId: user.tenantId,
      branchId: current.registrationBranchId ?? undefined,
      userId: user.userId,
      action: 'patient.status.updated',
      entityType: 'patient',
      entityId: patientId,
      oldValuesJson: { status: current.status },
      newValuesJson: { status: dto.status },
    });

    return updated;
  }

  private async nextPatientCode(tenantId: string): Promise<string> {
    const exists = await this.redis.exists(`tenant:${tenantId}:patient_seq`);
    if (!exists) {
      const lastPatient = await this.prisma.patient.findFirst({
        where: { tenantId },
        orderBy: { patientCode: 'desc' },
      });
      let seq = 0;
      if (lastPatient) {
        const match = lastPatient.patientCode.match(/\d+/);
        if (match) {
          seq = parseInt(match[0], 10);
        }
      }
      await this.redis.set(`tenant:${tenantId}:patient_seq`, seq);
    }
    const seq = await this.redis.incr(`tenant:${tenantId}:patient_seq`);
    return `P-${String(seq).padStart(6, '0')}`;
  }

  private contactCreate(tenantId: string, type: string, value: string, isPrimary: boolean) {
    const normalized = normalize(value);
    return { tenantId, type, value, normalizedValueHash: hash(normalized), isPrimary };
  }
}
