import { AuditLoggerService } from '@core/audit/audit-logger.service';
import { PrismaService } from '@core/database/prisma.service';
import { SchedulingPrismaService } from '@core/database/scheduling-prisma.service';
import { AuthenticatedUser } from '@core/security/jwt-payload';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { WorkingScheduleDto, ScheduleExceptionDto } from '../dto/organization-structure.schemas';

@Injectable()
export class SchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schedulingPrisma: SchedulingPrismaService,
    private readonly audit: AuditLoggerService,
  ) {}

  // Working Schedules
  async listWorkingSchedules(user: AuthenticatedUser, entityType: string, entityId: string) {
    await this.assertEntityAccess(user, entityType, entityId);

    return this.schedulingPrisma.workingSchedule.findMany({
      where: {
        tenantId: user.tenantId,
        entityType,
        entityId,
      },
      orderBy: { weekday: 'asc' },
    });
  }

  async createWorkingSchedule(user: AuthenticatedUser, dto: WorkingScheduleDto) {
    await this.assertEntityAccess(user, dto.entityType, dto.entityId);

    const schedule = await this.schedulingPrisma.workingSchedule.create({
      data: {
        tenantId: user.tenantId,
        entityType: dto.entityType,
        entityId: dto.entityId,
        weekday: dto.weekday,
        startTime: dto.startTime,
        endTime: dto.endTime,
        breakStart: dto.breakStart,
        breakEnd: dto.breakEnd,
        recurrenceRule: dto.recurrenceRule,
        timezone: dto.timezone,
        isActive: dto.isActive,
      },
    });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'schedule.working.created',
      entityType: 'working_schedule',
      entityId: schedule.id,
      newValuesJson: schedule,
    });

    return schedule;
  }

  async updateWorkingSchedule(user: AuthenticatedUser, id: string, dto: WorkingScheduleDto) {
    const current = await this.schedulingPrisma.workingSchedule.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!current) throw new NotFoundException('Schedule not found');

    await this.assertEntityAccess(user, dto.entityType, dto.entityId);

    const schedule = await this.schedulingPrisma.workingSchedule.update({
      where: { id },
      data: {
        weekday: dto.weekday,
        startTime: dto.startTime,
        endTime: dto.endTime,
        breakStart: dto.breakStart,
        breakEnd: dto.breakEnd,
        recurrenceRule: dto.recurrenceRule,
        timezone: dto.timezone,
        isActive: dto.isActive,
      },
    });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'schedule.working.updated',
      entityType: 'working_schedule',
      entityId: schedule.id,
      oldValuesJson: current,
      newValuesJson: schedule,
    });

    return schedule;
  }

  async deleteWorkingSchedule(user: AuthenticatedUser, id: string) {
    const current = await this.schedulingPrisma.workingSchedule.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!current) throw new NotFoundException('Schedule not found');

    await this.assertEntityAccess(user, current.entityType, current.entityId);

    await this.schedulingPrisma.workingSchedule.delete({ where: { id } });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'schedule.working.deleted',
      entityType: 'working_schedule',
      entityId: id,
    });

    return { success: true };
  }

  // Schedule Exceptions
  async listExceptions(user: AuthenticatedUser, entityType: string, entityId: string) {
    await this.assertEntityAccess(user, entityType, entityId);

    return this.schedulingPrisma.scheduleException.findMany({
      where: {
        tenantId: user.tenantId,
        entityType,
        entityId,
      },
      orderBy: { exceptionDate: 'asc' },
    });
  }

  async createException(user: AuthenticatedUser, dto: ScheduleExceptionDto) {
    await this.assertEntityAccess(user, dto.entityType, dto.entityId);

    const exception = await this.schedulingPrisma.scheduleException.create({
      data: {
        tenantId: user.tenantId,
        entityType: dto.entityType,
        entityId: dto.entityId,
        exceptionDate: new Date(dto.exceptionDate),
        reason: dto.reason,
        startTime: dto.startTime,
        endTime: dto.endTime,
        isDayOff: dto.isDayOff,
      },
    });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'schedule.exception.created',
      entityType: 'schedule_exception',
      entityId: exception.id,
      newValuesJson: exception,
    });

    return exception;
  }

  async updateException(user: AuthenticatedUser, id: string, dto: ScheduleExceptionDto) {
    const current = await this.schedulingPrisma.scheduleException.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!current) throw new NotFoundException('Exception not found');

    await this.assertEntityAccess(user, dto.entityType, dto.entityId);

    const exception = await this.schedulingPrisma.scheduleException.update({
      where: { id },
      data: {
        exceptionDate: new Date(dto.exceptionDate),
        reason: dto.reason,
        startTime: dto.startTime,
        endTime: dto.endTime,
        isDayOff: dto.isDayOff,
      },
    });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'schedule.exception.updated',
      entityType: 'schedule_exception',
      entityId: exception.id,
      oldValuesJson: current,
      newValuesJson: exception,
    });

    return exception;
  }

  async deleteException(user: AuthenticatedUser, id: string) {
    const current = await this.schedulingPrisma.scheduleException.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!current) throw new NotFoundException('Exception not found');

    await this.assertEntityAccess(user, current.entityType, current.entityId);

    await this.schedulingPrisma.scheduleException.delete({ where: { id } });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'schedule.exception.deleted',
      entityType: 'schedule_exception',
      entityId: id,
    });

    return { success: true };
  }

  // Helpers
  private async assertEntityAccess(user: AuthenticatedUser, entityType: string, entityId: string) {
    if (entityType === 'branch') {
      const branch = await this.prisma.branch.findFirst({
        where: { id: entityId, tenantId: user.tenantId },
      });
      if (!branch) throw new NotFoundException('Branch not found');
      if (!user.branchIds.includes(entityId)) throw new ForbiddenException('Branch access denied');
    } else if (entityType === 'room') {
      const room = await this.schedulingPrisma.room.findFirst({
        where: { id: entityId, tenantId: user.tenantId },
      });
      if (!room) throw new NotFoundException('Room not found');
      if (!user.branchIds.includes(room.branchId))
        throw new ForbiddenException('Room access denied');
    } else if (entityType === 'employee') {
      const employee = await this.prisma.employee.findFirst({
        where: { id: entityId, tenantId: user.tenantId },
        include: { positions: true },
      });
      if (!employee) throw new NotFoundException('Employee not found');
      const hasAccess =
        employee.positions.length === 0 ||
        employee.positions.some((pos) => user.branchIds.includes(pos.branchId));
      if (!hasAccess) throw new ForbiddenException('Employee access denied');
    } else if (entityType === 'equipment') {
      const equipment = await this.schedulingPrisma.equipment.findFirst({
        where: { id: entityId, tenantId: user.tenantId },
      });
      if (!equipment) throw new NotFoundException('Equipment not found');
      if (!user.branchIds.includes(equipment.branchId))
        throw new ForbiddenException('Equipment access denied');
    } else {
      throw new Error('Invalid entity type');
    }
  }
}
