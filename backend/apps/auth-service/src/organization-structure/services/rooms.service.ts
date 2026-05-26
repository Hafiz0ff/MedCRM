import { AuditLoggerService } from '@core/audit/audit-logger.service';
import { PrismaService } from '@core/database/prisma.service';
import { SchedulingPrismaService } from '@core/database/scheduling-prisma.service';
import { AuthenticatedUser } from '@core/security/jwt-payload';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { RoomDto, EmployeeRoomAssignmentDto } from '../dto/organization-structure.schemas';

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schedulingPrisma: SchedulingPrismaService,
    private readonly audit: AuditLoggerService,
  ) {}

  async list(user: AuthenticatedUser, branchId?: string) {
    if (branchId) this.assertBranchAccess(user, branchId);

    const rooms = await this.schedulingPrisma.room.findMany({
      where: {
        tenantId: user.tenantId,
        branchId: branchId ? branchId : { in: user.branchIds },
      },
      include: {
        roomType: true,
        specialties: true,
        equipment: { include: { category: true } },
      },
      orderBy: { name: 'asc' },
    });

    return this.enrichRooms(rooms);
  }

  async get(user: AuthenticatedUser, id: string) {
    const room = await this.schedulingPrisma.room.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        roomType: true,
        specialties: true,
        equipment: { include: { category: true } },
        assignments: true,
      },
    });

    if (!room) throw new NotFoundException('Room not found');
    this.assertBranchAccess(user, room.branchId);

    const enriched = await this.enrichRooms([room]);
    return enriched[0];
  }

  async create(user: AuthenticatedUser, dto: RoomDto) {
    this.assertBranchAccess(user, dto.branchId);

    const room = await this.schedulingPrisma.room.create({
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

    const room = await this.schedulingPrisma.room.update({
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

    await this.schedulingPrisma.room.delete({ where: { id } });

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
    const assignments = await this.schedulingPrisma.employeeRoomAssignment.findMany({
      where: { tenantId: user.tenantId, roomId },
    });
    return this.enrichAssignments(assignments);
  }

  async assignEmployee(user: AuthenticatedUser, dto: EmployeeRoomAssignmentDto) {
    await this.get(user, dto.roomId); // Asserts access to room
    this.assertBranchAccess(user, dto.branchId);

    const assignment = await this.schedulingPrisma.employeeRoomAssignment.create({
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
    const current = await this.schedulingPrisma.employeeRoomAssignment.findFirst({
      where: { id: assignmentId, tenantId: user.tenantId },
    });
    if (!current) throw new NotFoundException('Assignment not found');

    this.assertBranchAccess(user, current.branchId);

    await this.schedulingPrisma.employeeRoomAssignment.delete({ where: { id: assignmentId } });

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
    await this.schedulingPrisma.roomSpecialty.deleteMany({
      where: {
        roomId,
        specialtyId: { notIn: specialtyIds },
      },
    });

    for (const specId of specialtyIds) {
      await this.schedulingPrisma.roomSpecialty.upsert({
        where: { roomId_specialtyId: { roomId, specialtyId: specId } },
        update: {},
        create: { roomId, specialtyId: specId },
      });
    }
  }

  private async enrichRooms(rooms: any[]) {
    if (rooms.length === 0) return rooms;

    const specialtyIds = new Set<string>();
    const employeeIds = new Set<string>();

    for (const room of rooms) {
      if (room.specialties) {
        for (const spec of room.specialties) {
          specialtyIds.add(spec.specialtyId);
        }
      }
      if (room.assignments) {
        for (const assign of room.assignments) {
          employeeIds.add(assign.employeeId);
          if (assign.specialtyId) specialtyIds.add(assign.specialtyId);
        }
      }
    }

    const [specialties, employees] = await Promise.all([
      specialtyIds.size > 0
        ? this.prisma.specialty.findMany({ where: { id: { in: Array.from(specialtyIds) } } })
        : [],
      employeeIds.size > 0
        ? this.prisma.employee.findMany({ where: { id: { in: Array.from(employeeIds) } } })
        : [],
    ]);

    const specialtyMap = new Map(specialties.map((s) => [s.id, s]));
    const employeeMap = new Map(employees.map((e) => [e.id, e]));

    return rooms.map((room) => {
      const roomSpecialties =
        room.specialties?.map((rs: any) => ({
          ...rs,
          specialty: specialtyMap.get(rs.specialtyId) || null,
        })) ?? [];

      const roomAssignments =
        room.assignments?.map((ra: any) => ({
          ...ra,
          employee: employeeMap.get(ra.employeeId) || null,
          specialty: ra.specialtyId ? specialtyMap.get(ra.specialtyId) || null : null,
        })) ?? [];

      return {
        ...room,
        specialties: roomSpecialties,
        assignments: roomAssignments,
      };
    });
  }

  private async enrichAssignments(assignments: any[]) {
    if (assignments.length === 0) return assignments;
    const employeeIds = Array.from(new Set(assignments.map((a) => a.employeeId)));
    const specialtyIds = Array.from(
      new Set(assignments.map((a) => a.specialtyId).filter(Boolean)),
    ) as string[];

    const [employees, specialties] = await Promise.all([
      this.prisma.employee.findMany({ where: { id: { in: employeeIds } } }),
      specialtyIds.length > 0
        ? this.prisma.specialty.findMany({ where: { id: { in: specialtyIds } } })
        : [],
    ]);

    const employeeMap = new Map(employees.map((e) => [e.id, e]));
    const specialtyMap = new Map(specialties.map((s) => [s.id, s]));

    return assignments.map((a) => ({
      ...a,
      employee: employeeMap.get(a.employeeId) || null,
      specialty: a.specialtyId ? specialtyMap.get(a.specialtyId) || null : null,
    }));
  }

  private assertBranchAccess(user: AuthenticatedUser, branchId: string): void {
    if (!user.branchIds.includes(branchId)) {
      throw new ForbiddenException('Branch access denied');
    }
  }
}
