import { AuthenticatedUser } from '@core/security/jwt-payload';
import { Controller, UseInterceptors, UseFilters } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PrismaService } from '../prisma.service';
import { RpcExceptionTranslationFilter } from './rpc-exception.filter';
import { RpcTenantInterceptor } from './rpc-tenant.interceptor';
import { SmartSchedulingService } from './smart-scheduling.service';

// ────────────────────────────────────────────────────────────────────────────────
// Payload type helpers (kept local – no need for a shared DTO on the RPC layer)
// ────────────────────────────────────────────────────────────────────────────────

/** Payload for high-level service operations that require an authenticated user. */
interface ServicePayload<T = any> {
  user: AuthenticatedUser;
  dto?: T;
  query?: T;
  id?: string;
  status?: string;
  reason?: string;
}

/** Payload for raw Prisma query operations. */
interface PrismaQueryPayload {
  where?: any;
  select?: any;
  include?: any;
  orderBy?: any;
  take?: number;
  skip?: number;
  distinct?: any;
  data?: any;
  create?: any;
  update?: any;
  cursor?: any;
}

@UseInterceptors(RpcTenantInterceptor)
@UseFilters(RpcExceptionTranslationFilter)
@Controller()
export class SmartSchedulingRpcController {
  constructor(
    private readonly scheduling: SmartSchedulingService,
    private readonly prisma: PrismaService,
  ) {}

  // ══════════════════════════════════════════════════════════════════════════════
  // HIGH-LEVEL SERVICE OPERATIONS (SmartSchedulingService)
  // ══════════════════════════════════════════════════════════════════════════════

  @MessagePattern('scheduling.list')
  async list(@Payload() data: ServicePayload) {
    return this.scheduling.list(data.user, data.query);
  }

  @MessagePattern('scheduling.create')
  async create(@Payload() data: ServicePayload) {
    return this.scheduling.create(data.user, data.dto);
  }

  @MessagePattern('scheduling.update')
  async update(@Payload() data: ServicePayload) {
    return this.scheduling.update(data.user, data.id!, data.dto);
  }

  @MessagePattern('scheduling.transition')
  async transition(@Payload() data: ServicePayload) {
    return this.scheduling.transition(data.user, data.id!, data.status!, data.reason);
  }

  @MessagePattern('scheduling.availability')
  async availability(@Payload() data: ServicePayload) {
    return this.scheduling.availability(data.user, data.query);
  }

  @MessagePattern('scheduling.reserveSlot')
  async reserveSlot(@Payload() data: ServicePayload) {
    return this.scheduling.reserveSlot(data.user, data.dto);
  }

  @MessagePattern('scheduling.getPublicSlots')
  async getPublicSlots(@Payload() data: ServicePayload) {
    return this.scheduling.getPublicSlots(data.user, data.query);
  }

  @MessagePattern('scheduling.onlineBookingReserve')
  async onlineBookingReserve(@Payload() data: ServicePayload) {
    return this.scheduling.onlineBookingReserve(data.user, data.dto);
  }

  @MessagePattern('scheduling.onlineBookingConfirm')
  async onlineBookingConfirm(@Payload() data: ServicePayload) {
    return this.scheduling.onlineBookingConfirm(data.user, data.dto);
  }

  @MessagePattern('scheduling.reschedule')
  async reschedule(@Payload() data: ServicePayload) {
    return this.scheduling.reschedule(data.user, data.id!, data.dto);
  }

  @MessagePattern('scheduling.createRecurring')
  async createRecurring(@Payload() data: ServicePayload) {
    return this.scheduling.createRecurring(data.user, data.dto);
  }

  @MessagePattern('scheduling.getWeekAvailability')
  async getWeekAvailability(@Payload() data: ServicePayload) {
    return this.scheduling.getWeekAvailability(data.user, data.query);
  }

  @MessagePattern('scheduling.getRoomUtilization')
  async getRoomUtilization(@Payload() data: ServicePayload) {
    return this.scheduling.getRoomUtilization(data.user, data.query);
  }

  // ── Waiting List (high-level) ─────────────────────────────────────────────

  @MessagePattern('scheduling.listWaitingList')
  async listWaitingList(@Payload() data: ServicePayload) {
    return this.scheduling.listWaitingList(data.user);
  }

  @MessagePattern('scheduling.createWaitingList')
  async createWaitingList(@Payload() data: ServicePayload) {
    return this.scheduling.createWaitingList(data.user, data.dto);
  }

  @MessagePattern('scheduling.updateWaitingList')
  async updateWaitingList(@Payload() data: ServicePayload) {
    return this.scheduling.updateWaitingList(data.user, data.id!, data.dto);
  }

  @MessagePattern('scheduling.deleteWaitingList')
  async deleteWaitingList(@Payload() data: ServicePayload) {
    return this.scheduling.deleteWaitingList(data.user, data.id!);
  }

  // ── Resource Buffers (high-level) ─────────────────────────────────────────

  @MessagePattern('scheduling.listResourceBuffers')
  async listResourceBuffers(@Payload() data: ServicePayload) {
    return this.scheduling.listResourceBuffers(data.user);
  }

  @MessagePattern('scheduling.upsertResourceBuffer')
  async upsertResourceBuffer(@Payload() data: ServicePayload) {
    return this.scheduling.upsertResourceBuffer(data.user, data.dto);
  }

  @MessagePattern('scheduling.deleteResourceBuffer')
  async deleteResourceBuffer(@Payload() data: ServicePayload) {
    return this.scheduling.deleteResourceBuffer(data.user, data.id!);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // RAW PRISMA DATA ACCESS (for BI, reception dashboards, workers, auth-service)
  // ══════════════════════════════════════════════════════════════════════════════

  // ── Helper methods to construct Prisma query arguments ─────────────────────
  private buildArgs(query: PrismaQueryPayload) {
    const args: any = {
      where: query.where,
      orderBy: query.orderBy,
      take: query.take,
      skip: query.skip,
      distinct: query.distinct,
    };
    if (query.select) {
      args.select = query.select;
    } else if (query.include) {
      args.include = query.include;
    }
    return args;
  }

  private buildCreateArgs(query: { data: any } & PrismaQueryPayload) {
    const args: any = {
      data: query.data,
    };
    if (query.select) {
      args.select = query.select;
    } else if (query.include) {
      args.include = query.include;
    }
    return args;
  }

  // ── Appointment ───────────────────────────────────────────────────────────

  @MessagePattern('scheduling.appointment.findMany')
  async appointmentFindMany(@Payload() query: PrismaQueryPayload) {
    return this.prisma.appointment.findMany(this.buildArgs(query));
  }

  @MessagePattern('scheduling.appointment.findFirst')
  async appointmentFindFirst(@Payload() query: PrismaQueryPayload) {
    return this.prisma.appointment.findFirst(this.buildArgs(query));
  }

  @MessagePattern('scheduling.appointment.findUnique')
  async appointmentFindUnique(@Payload() query: { where: { id: string } } & PrismaQueryPayload) {
    const args = this.buildArgs(query);
    args.where = query.where;
    return this.prisma.appointment.findUnique(args);
  }

  @MessagePattern('scheduling.appointment.count')
  async appointmentCount(@Payload() query: PrismaQueryPayload) {
    return this.prisma.appointment.count({ where: query.where });
  }

  @MessagePattern('scheduling.appointment.update')
  async appointmentUpdate(@Payload() query: { where: { id: string }; data: any }) {
    return this.prisma.appointment.update({
      where: query.where,
      data: query.data,
    });
  }

  @MessagePattern('scheduling.appointment.create')
  async appointmentCreate(@Payload() query: { data: any } & PrismaQueryPayload) {
    return this.prisma.appointment.create(this.buildCreateArgs(query));
  }

  // ── Appointment + Status History atomic transition ────────────────────────

  @MessagePattern('scheduling.appointment.transition')
  async appointmentTransition(
    @Payload()
    data: {
      appointmentId: string;
      status: string;
      oldStatus: string;
      changedBy: string;
      tenantId: string;
      reason?: string;
      extraData?: Record<string, any>;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const statusData: Record<string, any> = { status: data.status, ...data.extraData };
      if (data.status === 'CONFIRMED') statusData.confirmedAt = new Date();
      if (data.status === 'CHECKED_IN') statusData.checkedInAt = new Date();
      if (data.status === 'COMPLETED') statusData.completedAt = new Date();
      if (data.status === 'CANCELLED') {
        statusData.cancelledAt = new Date();
        statusData.cancellationReason = data.reason ?? null;
      }

      const appointment = await tx.appointment.update({
        where: { id: data.appointmentId },
        data: statusData,
      });

      await tx.appointmentStatusHistory.create({
        data: {
          tenantId: data.tenantId,
          appointmentId: data.appointmentId,
          oldStatus: data.oldStatus,
          newStatus: data.status,
          changedBy: data.changedBy,
          reason: data.reason,
        },
      });

      return appointment;
    });
  }

  // ── VisitQueue ────────────────────────────────────────────────────────────

  @MessagePattern('scheduling.visitQueue.findMany')
  async visitQueueFindMany(@Payload() query: PrismaQueryPayload) {
    return this.prisma.visitQueue.findMany(this.buildArgs(query));
  }

  @MessagePattern('scheduling.visitQueue.create')
  async visitQueueCreate(@Payload() query: { data: any } & PrismaQueryPayload) {
    return this.prisma.visitQueue.create(this.buildCreateArgs(query));
  }

  @MessagePattern('scheduling.visitQueue.update')
  async visitQueueUpdate(@Payload() query: { where: { id: string }; data: any }) {
    return this.prisma.visitQueue.update({
      where: query.where,
      data: query.data,
    });
  }

  @MessagePattern('scheduling.visitQueue.updateMany')
  async visitQueueUpdateMany(@Payload() query: { where: any; data: any }) {
    return this.prisma.visitQueue.updateMany({
      where: query.where,
      data: query.data,
    });
  }

  // ── IncomingCall ──────────────────────────────────────────────────────────

  @MessagePattern('scheduling.incomingCall.findMany')
  async incomingCallFindMany(@Payload() query: PrismaQueryPayload) {
    return this.prisma.incomingCall.findMany(this.buildArgs(query));
  }

  @MessagePattern('scheduling.incomingCall.create')
  async incomingCallCreate(@Payload() query: { data: any }) {
    return this.prisma.incomingCall.create({ data: query.data });
  }

  @MessagePattern('scheduling.incomingCall.update')
  async incomingCallUpdate(@Payload() query: { where: { id: string }; data: any }) {
    return this.prisma.incomingCall.update({
      where: query.where,
      data: query.data,
    });
  }

  // ── Room ──────────────────────────────────────────────────────────────────

  @MessagePattern('scheduling.room.findMany')
  async roomFindMany(@Payload() query: PrismaQueryPayload) {
    return this.prisma.room.findMany(this.buildArgs(query));
  }

  @MessagePattern('scheduling.room.findFirst')
  async roomFindFirst(@Payload() query: PrismaQueryPayload) {
    return this.prisma.room.findFirst(this.buildArgs(query));
  }

  @MessagePattern('scheduling.room.create')
  async roomCreate(@Payload() query: { data: any } & PrismaQueryPayload) {
    return this.prisma.room.create(this.buildCreateArgs(query));
  }

  @MessagePattern('scheduling.room.update')
  async roomUpdate(@Payload() query: { where: { id: string }; data: any }) {
    return this.prisma.room.update({
      where: query.where,
      data: query.data,
    });
  }

  @MessagePattern('scheduling.room.delete')
  async roomDelete(@Payload() query: { where: { id: string } }) {
    return this.prisma.room.delete({ where: query.where });
  }

  // ── Equipment ─────────────────────────────────────────────────────────────

  @MessagePattern('scheduling.equipment.findMany')
  async equipmentFindMany(@Payload() query: PrismaQueryPayload) {
    return this.prisma.equipment.findMany(this.buildArgs(query));
  }

  @MessagePattern('scheduling.equipment.findFirst')
  async equipmentFindFirst(@Payload() query: PrismaQueryPayload) {
    return this.prisma.equipment.findFirst(this.buildArgs(query));
  }

  @MessagePattern('scheduling.equipment.create')
  async equipmentCreate(@Payload() query: { data: any } & PrismaQueryPayload) {
    return this.prisma.equipment.create(this.buildCreateArgs(query));
  }

  @MessagePattern('scheduling.equipment.update')
  async equipmentUpdate(@Payload() query: { where: { id: string }; data: any }) {
    return this.prisma.equipment.update({
      where: query.where,
      data: query.data,
    });
  }

  @MessagePattern('scheduling.equipment.delete')
  async equipmentDelete(@Payload() query: { where: { id: string } }) {
    return this.prisma.equipment.delete({ where: query.where });
  }

  // ── RoomEquipment ─────────────────────────────────────────────────────────

  @MessagePattern('scheduling.roomEquipment.create')
  async roomEquipmentCreate(@Payload() query: { data: any }) {
    return this.prisma.roomEquipment.create({ data: query.data });
  }

  @MessagePattern('scheduling.roomEquipment.updateMany')
  async roomEquipmentUpdateMany(@Payload() query: { where: any; data: any }) {
    return this.prisma.roomEquipment.updateMany({
      where: query.where,
      data: query.data,
    });
  }

  // ── EmployeeRoomAssignment ────────────────────────────────────────────────

  @MessagePattern('scheduling.employeeRoomAssignment.findMany')
  async employeeRoomAssignmentFindMany(@Payload() query: PrismaQueryPayload) {
    return this.prisma.employeeRoomAssignment.findMany(this.buildArgs(query));
  }

  @MessagePattern('scheduling.employeeRoomAssignment.create')
  async employeeRoomAssignmentCreate(@Payload() query: { data: any }) {
    return this.prisma.employeeRoomAssignment.create({ data: query.data });
  }

  @MessagePattern('scheduling.employeeRoomAssignment.delete')
  async employeeRoomAssignmentDelete(@Payload() query: { where: { id: string } }) {
    return this.prisma.employeeRoomAssignment.delete({ where: query.where });
  }

  // ── WorkingSchedule ───────────────────────────────────────────────────────

  @MessagePattern('scheduling.workingSchedule.findMany')
  async workingScheduleFindMany(@Payload() query: PrismaQueryPayload) {
    return this.prisma.workingSchedule.findMany(this.buildArgs(query));
  }

  @MessagePattern('scheduling.workingSchedule.upsert')
  async workingScheduleUpsert(@Payload() query: { where: any; create: any; update: any }) {
    return this.prisma.workingSchedule.upsert({
      where: query.where,
      create: query.create,
      update: query.update,
    });
  }

  @MessagePattern('scheduling.workingSchedule.delete')
  async workingScheduleDelete(@Payload() query: { where: { id: string } }) {
    return this.prisma.workingSchedule.delete({ where: query.where });
  }

  // ── ScheduleException ─────────────────────────────────────────────────────

  @MessagePattern('scheduling.scheduleException.findMany')
  async scheduleExceptionFindMany(@Payload() query: PrismaQueryPayload) {
    return this.prisma.scheduleException.findMany(this.buildArgs(query));
  }

  @MessagePattern('scheduling.scheduleException.create')
  async scheduleExceptionCreate(@Payload() query: { data: any }) {
    return this.prisma.scheduleException.create({ data: query.data });
  }

  @MessagePattern('scheduling.scheduleException.delete')
  async scheduleExceptionDelete(@Payload() query: { where: { id: string } }) {
    return this.prisma.scheduleException.delete({ where: query.where });
  }

  // ── RoomType ──────────────────────────────────────────────────────────────

  @MessagePattern('scheduling.roomType.findMany')
  async roomTypeFindMany(@Payload() query: PrismaQueryPayload) {
    return this.prisma.roomType.findMany(this.buildArgs(query));
  }

  @MessagePattern('scheduling.roomType.findFirst')
  async roomTypeFindFirst(@Payload() query: PrismaQueryPayload) {
    return this.prisma.roomType.findFirst(this.buildArgs(query));
  }

  @MessagePattern('scheduling.roomType.create')
  async roomTypeCreate(@Payload() query: { data: any }) {
    return this.prisma.roomType.create({ data: query.data });
  }

  @MessagePattern('scheduling.roomType.delete')
  async roomTypeDelete(@Payload() query: { where: { id: string } }) {
    return this.prisma.roomType.delete({ where: query.where });
  }

  // ── EquipmentCategory ─────────────────────────────────────────────────────

  @MessagePattern('scheduling.equipmentCategory.findMany')
  async equipmentCategoryFindMany(@Payload() query: PrismaQueryPayload) {
    return this.prisma.equipmentCategory.findMany(this.buildArgs(query));
  }

  @MessagePattern('scheduling.equipmentCategory.findFirst')
  async equipmentCategoryFindFirst(@Payload() query: PrismaQueryPayload) {
    return this.prisma.equipmentCategory.findFirst(this.buildArgs(query));
  }

  @MessagePattern('scheduling.equipmentCategory.create')
  async equipmentCategoryCreate(@Payload() query: { data: any }) {
    return this.prisma.equipmentCategory.create({ data: query.data });
  }

  @MessagePattern('scheduling.equipmentCategory.delete')
  async equipmentCategoryDelete(@Payload() query: { where: { id: string } }) {
    return this.prisma.equipmentCategory.delete({ where: query.where });
  }

  // ── AppointmentNotification ───────────────────────────────────────────────

  @MessagePattern('scheduling.appointmentNotification.findMany')
  async appointmentNotificationFindMany(@Payload() query: PrismaQueryPayload) {
    return this.prisma.appointmentNotification.findMany(this.buildArgs(query));
  }

  @MessagePattern('scheduling.appointmentNotification.findFirst')
  async appointmentNotificationFindFirst(@Payload() query: PrismaQueryPayload) {
    return this.prisma.appointmentNotification.findFirst(this.buildArgs(query));
  }

  @MessagePattern('scheduling.appointmentNotification.create')
  async appointmentNotificationCreate(@Payload() query: { data: any }) {
    return this.prisma.appointmentNotification.create({ data: query.data });
  }

  @MessagePattern('scheduling.appointmentNotification.update')
  async appointmentNotificationUpdate(@Payload() query: { where: { id: string }; data: any }) {
    return this.prisma.appointmentNotification.update({
      where: query.where,
      data: query.data,
    });
  }

  // ── AppointmentReservation ────────────────────────────────────────────────

  @MessagePattern('scheduling.appointmentReservation.findMany')
  async appointmentReservationFindMany(@Payload() query: PrismaQueryPayload) {
    return this.prisma.appointmentReservation.findMany(this.buildArgs(query));
  }

  @MessagePattern('scheduling.appointmentReservation.upsert')
  async appointmentReservationUpsert(@Payload() query: { where: any; create: any; update: any }) {
    return this.prisma.appointmentReservation.upsert({
      where: query.where,
      create: query.create,
      update: query.update,
    });
  }

  @MessagePattern('scheduling.appointmentReservation.deleteMany')
  async appointmentReservationDeleteMany(@Payload() query: { where: any }) {
    return this.prisma.appointmentReservation.deleteMany({ where: query.where });
  }

  // ── WaitingList (raw) ─────────────────────────────────────────────────────

  @MessagePattern('scheduling.waitingList.findFirst')
  async waitingListFindFirst(@Payload() query: PrismaQueryPayload) {
    return this.prisma.waitingList.findFirst(this.buildArgs(query));
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // COMPOSITE TRANSACTIONS
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Atomic check-in: update appointment status → create status history → create visit queue entry.
   */
  @MessagePattern('scheduling.composite.checkIn')
  async compositeCheckIn(
    @Payload()
    data: {
      tenantId: string;
      appointmentId: string;
      changedBy: string;
      branchId: string;
      patientId: string;
      employeeId: string;
      queueData?: {
        queueStatus?: string;
        position?: number;
        roomId?: string;
        notes?: string;
      };
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Fetch current appointment for old status
      const current = await tx.appointment.findUniqueOrThrow({
        where: { id: data.appointmentId },
      });

      // 2. Update appointment to CHECKED_IN
      const appointment = await tx.appointment.update({
        where: { id: data.appointmentId },
        data: {
          status: 'CHECKED_IN',
          checkedInAt: new Date(),
        },
      });

      // 3. Create status history record
      await tx.appointmentStatusHistory.create({
        data: {
          tenantId: data.tenantId,
          appointmentId: data.appointmentId,
          oldStatus: current.status,
          newStatus: 'CHECKED_IN',
          changedBy: data.changedBy,
          reason: 'Patient checked in',
        },
      });

      // Calculate queue count & wait time
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const queueCount = await tx.visitQueue.count({
        where: {
          tenantId: data.tenantId,
          branchId: data.branchId,
          createdAt: { gte: startOfDay },
        },
      });
      const queueNumber = `Q-${String(queueCount + 1).padStart(3, '0')}`;

      const patientsAhead = await tx.visitQueue.count({
        where: {
          tenantId: data.tenantId,
          branchId: data.branchId,
          queueStatus: { in: ['WAITING', 'CALLED'] },
          appointment: { employeeId: current.employeeId },
        },
      });
      const estimatedWaitTime = patientsAhead * 15;

      // 4. Create visit queue entry
      const queueEntry = await tx.visitQueue.create({
        data: {
          tenantId: data.tenantId,
          branchId: data.branchId,
          appointmentId: data.appointmentId,
          queueNumber,
          queueStatus: data.queueData?.queueStatus ?? 'WAITING',
          priority: 'NORMAL',
          estimatedWaitTime,
        },
      });

      return { appointment, queueEntry };
    });
  }

  /**
   * Atomic fast-booking: create appointment → create status history → create visit queue entry.
   * Used by the reception desk for walk-in patients.
   */
  @MessagePattern('scheduling.composite.fastBooking')
  async compositeFastBooking(
    @Payload()
    data: {
      tenantId: string;
      branchId: string;
      patientId: string;
      employeeId: string;
      changedBy: string;
      appointmentData: {
        appointmentNumber: string;
        serviceId?: string;
        startAt: string;
        endAt: string;
        bookingSource?: string;
        appointmentType?: string;
        notes?: string;
      };
      queueData?: {
        queueStatus?: string;
        position?: number;
        roomId?: string;
        notes?: string;
      };
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const startAt = new Date(data.appointmentData.startAt);
      const endAt = new Date(data.appointmentData.endAt);

      // 1. Create appointment
      const appointment = await tx.appointment.create({
        data: {
          tenantId: data.tenantId,
          branchId: data.branchId,
          patientId: data.patientId,
          employeeId: data.employeeId,
          serviceId: data.appointmentData.serviceId,
          appointmentNumber: data.appointmentData.appointmentNumber,
          bookingSource: data.appointmentData.bookingSource ?? 'WALK_IN',
          appointmentType: data.appointmentData.appointmentType ?? 'CONSULTATION',
          startAt,
          endAt,
          durationMinutes: Math.round((endAt.getTime() - startAt.getTime()) / 60000),
          notes: data.appointmentData.notes,
          status: 'CHECKED_IN',
          checkedInAt: new Date(),
          createdBy: data.changedBy,
        },
      });

      // 2. Create status history (initial SCHEDULED)
      await tx.appointmentStatusHistory.create({
        data: {
          tenantId: data.tenantId,
          appointmentId: appointment.id,
          newStatus: 'SCHEDULED',
          changedBy: data.changedBy,
          reason: 'Walk-in fast booking',
        },
      });

      // 3. Create status history (transition to CHECKED_IN)
      await tx.appointmentStatusHistory.create({
        data: {
          tenantId: data.tenantId,
          appointmentId: appointment.id,
          oldStatus: 'SCHEDULED',
          newStatus: 'CHECKED_IN',
          changedBy: data.changedBy,
          reason: 'Immediate check-in (fast booking)',
        },
      });

      // Calculate queue details
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const queueCount = await tx.visitQueue.count({
        where: {
          tenantId: data.tenantId,
          branchId: data.branchId,
          createdAt: { gte: startOfDay },
        },
      });
      const queueNumber = `Q-${String(queueCount + 1).padStart(3, '0')}`;

      const patientsAhead = await tx.visitQueue.count({
        where: {
          tenantId: data.tenantId,
          branchId: data.branchId,
          queueStatus: { in: ['WAITING', 'CALLED'] },
          appointment: { employeeId: data.employeeId },
        },
      });
      const estimatedWaitTime = patientsAhead * 15;

      // 4. Create visit queue entry
      const queueEntry = await tx.visitQueue.create({
        data: {
          tenantId: data.tenantId,
          branchId: data.branchId,
          appointmentId: appointment.id,
          queueNumber,
          queueStatus: data.queueData?.queueStatus ?? 'WAITING',
          priority: 'NORMAL',
          estimatedWaitTime,
        },
      });

      return { appointment, queueEntry };
    });
  }
}
