import { AuditLoggerService } from '@core/audit/audit-logger.service';
import { PrismaService } from '@core/database/prisma.service';
import { AuthenticatedUser } from '@core/security/jwt-payload';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { RoomDto, EmployeeRoomAssignmentDto } from '../dto/organization-structure.schemas';

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLoggerService,
  ) {}

  async list(user: AuthenticatedUser, branchId?: string) {
    if (branchId) this.assertBranchAccess(user, branchId);

    return this.prisma.room.findMany({
      where: {
        tenantId: user.tenantId,
        branchId: branchId ? branchId : { in: user.branchIds },
      },
      include: {
        roomType: true,
        specialties: { include: { specialty: true } },
        equipment: { include: { category: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async get(user: AuthenticatedUser, id: string) {
    const room = await this.prisma.room.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        roomType: true,
        specialties: { include: { specialty: true } },
        equipment: { include: { category: true } },
        assignments: {
          include: {
            employee: true,
            specialty: true,
          },
        },
      },
    });

    if (!room) throw new NotFoundException('Room not found');
    this.assertBranchAccess(user, room.branchId);

    return room;
  }

  async create(user: AuthenticatedUser, dto: RoomDto) {
    this.assertBranchAccess(user, dto.branchId);

    const room = await this.prisma.room.create({
      data: {
        tenantId: user.tenantId,
        branchId: dto.branchId,
        departmentId: dto.departmentId,
        roomTypeId: dto.roomTypeId,
        code: dto.code,
        name: dto.name,
        floor: dto.floor,
        capacity: dto.capacity,
        description: dto.description,
        scheduleJson: dto.scheduleJson ?? undefined,
        status: dto.status,
        isActive: dto.isActive,
      },
    });

    if (dto.specialtyIds) {
      await this.syncSpecialties(room.id, dto.specialtyIds);
    }

    await this.audit.log({
      tenantId: user.tenantId,
      branchId: dto.branchId,
      userId: user.userId,
      action: 'room.created',
      entityType: 'room',
      entityId: room.id,
      newValuesJson: room,
    });

    return this.get(user, room.id);
  }

  async update(user: AuthenticatedUser, id: string, dto: RoomDto) {
    const current = await this.get(user, id); // Asserts branch access and existence

    const room = await this.prisma.room.update({
      where: { id },
      data: {
        branchId: dto.branchId,
        departmentId: dto.departmentId,
        roomTypeId: dto.roomTypeId,
        code: dto.code,
        name: dto.name,
        floor: dto.floor,
        capacity: dto.capacity,
        description: dto.description,
        scheduleJson: dto.scheduleJson ?? undefined,
        status: dto.status,
        isActive: dto.isActive,
      },
    });

    if (dto.specialtyIds) {
      await this.syncSpecialties(room.id, dto.specialtyIds);
    }

    await this.audit.log({
      tenantId: user.tenantId,
      branchId: dto.branchId,
      userId: user.userId,
      action: 'room.updated',
      entityType: 'room',
      entityId: room.id,
      oldValuesJson: current,
      newValuesJson: room,
    });

    return this.get(user, room.id);
  }

  async delete(user: AuthenticatedUser, id: string) {
    const room = await this.get(user, id);

    await this.prisma.room.delete({ where: { id } });

    await this.audit.log({
      tenantId: user.tenantId,
      branchId: room.branchId,
      userId: user.userId,
      action: 'room.deleted',
      entityType: 'room',
      entityId: room.id,
    });

    return { success: true };
  }

  // Doctor Room Assignments
  async listAssignments(user: AuthenticatedUser, roomId: string) {
    await this.get(user, roomId); // Asserts access
    return this.prisma.employeeRoomAssignment.findMany({
      where: { tenantId: user.tenantId, roomId },
      include: {
        employee: true,
        specialty: true,
      },
    });
  }

  async assignEmployee(user: AuthenticatedUser, dto: EmployeeRoomAssignmentDto) {
    await this.get(user, dto.roomId); // Asserts access to room
    this.assertBranchAccess(user, dto.branchId);

    const assignment = await this.prisma.employeeRoomAssignment.create({
      data: {
        tenantId: user.tenantId,
        employeeId: dto.employeeId,
        branchId: dto.branchId,
        departmentId: dto.departmentId,
        roomId: dto.roomId,
        specialtyId: dto.specialtyId,
        activeFrom: dto.activeFrom ? new Date(dto.activeFrom) : undefined,
        activeTo: dto.activeTo ? new Date(dto.activeTo) : null,
        workScheduleJson: dto.workScheduleJson ?? undefined,
      },
    });

    await this.audit.log({
      tenantId: user.tenantId,
      branchId: dto.branchId,
      userId: user.userId,
      action: 'room.employee.assigned',
      entityType: 'employee_room_assignment',
      entityId: assignment.id,
      newValuesJson: assignment,
    });

    return assignment;
  }

  async removeEmployeeAssignment(user: AuthenticatedUser, assignmentId: string) {
    const current = await this.prisma.employeeRoomAssignment.findFirst({
      where: { id: assignmentId, tenantId: user.tenantId },
    });
    if (!current) throw new NotFoundException('Assignment not found');

    this.assertBranchAccess(user, current.branchId);

    await this.prisma.employeeRoomAssignment.delete({ where: { id: assignmentId } });

    await this.audit.log({
      tenantId: user.tenantId,
      branchId: current.branchId,
      userId: user.userId,
      action: 'room.employee.unassigned',
      entityType: 'employee_room_assignment',
      entityId: assignmentId,
    });

    return { success: true };
  }

  // Specialties helper
  private async syncSpecialties(roomId: string, specialtyIds: string[]) {
    await this.prisma.roomSpecialty.deleteMany({
      where: {
        roomId,
        specialtyId: { notIn: specialtyIds },
      },
    });

    for (const specId of specialtyIds) {
      await this.prisma.roomSpecialty.upsert({
        where: { roomId_specialtyId: { roomId, specialtyId: specId } },
        update: {},
        create: { roomId, specialtyId: specId },
      });
    }
  }

  private assertBranchAccess(user: AuthenticatedUser, branchId: string): void {
    if (!user.branchIds.includes(branchId)) {
      throw new ForbiddenException('Branch access denied');
    }
  }
}
