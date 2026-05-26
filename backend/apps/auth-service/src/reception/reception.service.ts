import { createHash } from 'node:crypto';
import { AuditLoggerService } from '@core/audit/audit-logger.service';
import { REDIS_CLIENT } from '@core/cache/redis.module';
import { PrismaService } from '@core/database/prisma.service';
import { SchedulingPrismaService } from '@core/database/scheduling-prisma.service';
import { AuthenticatedUser } from '@core/security/jwt-payload';
import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  forwardRef,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import Redis from 'ioredis';
import { RealtimeGateway } from '../smart-scheduling/realtime.gateway';
import { SmartSchedulingService } from '../smart-scheduling/smart-scheduling.service';
import {
  CheckInDto,
  FastBookingDto,
  IncomingCallDto,
  CreateInvoiceDto,
  PayInvoiceDto,
} from './dto/reception.dto';

const BOARD_STATUSES = [
  'WAITING',
  'CHECKED_IN',
  'IN_PROGRESS',
  'COMPLETED_PENDING_PAYMENT',
  'COMPLETED',
  'NO_SHOW',
  'CANCELLED',
];

@Injectable()
export class ReceptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schedulingPrisma: SchedulingPrismaService,
    private readonly audit: AuditLoggerService,
    private readonly realtime: RealtimeGateway,
    @Inject(forwardRef(() => SmartSchedulingService))
    private readonly scheduling: SmartSchedulingService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  private normalizePhone(value: string): string {
    return value.toLowerCase().replace(/[\s()+-]/g, '');
  }

  private hashPhone(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private calculateAge(birthDate: Date): number {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  private async getServicePrice(serviceId: string | null): Promise<number> {
    if (!serviceId) return 0;
    const service = await this.prisma.service.findUnique({ where: { id: serviceId } });
    return service?.basePrice ? Number(service.basePrice) : 0;
  }

  async getDashboard(user: AuthenticatedUser, branchId?: string, dateStr?: string) {
    const targetBranchId = branchId ?? user.branchIds[0];
    const todayStr = dateStr ?? new Date().toISOString().slice(0, 10);

    const cached = await this.schedulingPrisma.receptionistDashboardCache.findUnique({
      where: {
        tenantId_branchId_dashboardDate: {
          tenantId: user.tenantId,
          branchId: targetBranchId,
          dashboardDate: new Date(todayStr),
        },
      },
    });

    if (cached) {
      return cached.dashboardJson;
    }

    return this.recalculateDashboard(user.tenantId, targetBranchId, todayStr);
  }

  async recalculateDashboard(tenantId: string, branchId: string, dateStr: string) {
    const date = new Date(dateStr);
    const start = new Date(date);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setUTCHours(23, 59, 59, 999);

    const appointments = await this.schedulingPrisma.appointment.findMany({
      where: {
        tenantId,
        branchId,
        startAt: { gte: start, lte: end },
      },
      include: {
        resources: true,
      },
      orderBy: { startAt: 'asc' },
    });

    const columns: Record<string, any[]> = {
      WAITING: [],
      CHECKED_IN: [],
      IN_PROGRESS: [],
      COMPLETED_PENDING_PAYMENT: [],
      COMPLETED: [],
      NO_SHOW: [],
      CANCELLED: [],
    };

    if (appointments.length === 0) {
      const emptyDashboard = {
        branchId,
        date: dateStr,
        columns,
        counters: {
          total: 0,
          waiting: 0,
          checkedIn: 0,
          inProgress: 0,
          completedPendingPayment: 0,
          completed: 0,
          cancelled: 0,
          noShow: 0,
        },
        queue: [],
        recalculatedAt: new Date().toISOString(),
      };
      await this.saveDashboardToCache(tenantId, branchId, dateStr, emptyDashboard);
      return emptyDashboard;
    }

    const patientIds = Array.from(new Set(appointments.map((a) => a.patientId)));
    const serviceIds = Array.from(
      new Set(appointments.map((a) => a.serviceId).filter(Boolean)),
    ) as string[];
    const employeeIds = Array.from(new Set(appointments.map((a) => a.employeeId)));

    const [patients, services, employees, rooms] = await Promise.all([
      this.prisma.patient.findMany({
        where: { id: { in: patientIds } },
        include: {
          contacts: true,
          tags: { include: { tag: true } },
          metrics: true,
          invoices: {
            where: { status: { in: ['DRAFT', 'PENDING_PAYMENT'] } },
          },
        },
      }),
      serviceIds.length > 0
        ? this.prisma.service.findMany({ where: { id: { in: serviceIds } } })
        : [],
      this.prisma.employee.findMany({
        where: { id: { in: employeeIds } },
      }),
      this.schedulingPrisma.room.findMany({
        where: {
          id: {
            in: appointments
              .flatMap((a) => a.resources)
              .filter((r) => r.resourceType === 'ROOM')
              .map((r) => r.resourceId),
          },
        },
      }),
    ]);

    const patientMap = new Map(patients.map((p) => [p.id, p]));
    const serviceMap = new Map(services.map((s) => [s.id, s]));
    const employeeMap = new Map(employees.map((e) => [e.id, e]));
    const roomMap = new Map(rooms.map((r) => [r.id, r]));

    for (const app of appointments) {
      const p = patientMap.get(app.patientId);
      if (!p) continue;

      const primaryContact =
        p.contacts.find((c: any) => c.isPrimary)?.value || p.contacts[0]?.value || null;
      const isVip = p.tags.some(
        (t: any) => t.tag.code === 'VIP' || t.tag.name.toLowerCase() === 'vip',
      );
      const debt = p.invoices.reduce((sum: number, inv: any) => sum + Number(inv.totalAmount), 0);
      const age = p.birthDate ? this.calculateAge(p.birthDate) : null;

      const employee = employeeMap.get(app.employeeId);
      const doctorName = employee
        ? `${employee.lastName} ${employee.firstName}`
        : 'Неизвестный врач';

      const appRooms = app.resources.filter((r: any) => r.resourceType === 'ROOM');
      const roomName =
        appRooms
          .map((r: any) => roomMap.get(r.resourceId)?.name)
          .filter(Boolean)
          .join(', ') || 'Нет кабинета';

      const card = {
        id: app.id,
        patientId: p.id,
        patientName: p.fullName,
        patientCode: p.patientCode,
        patient: { fullName: p.fullName },
        service: app.serviceId ? serviceMap.get(app.serviceId) || null : null,
        appointmentNumber: app.appointmentNumber,
        age,
        phone: primaryContact,
        doctorName,
        roomName,
        startAt: app.startAt.toISOString(),
        endAt: app.endAt.toISOString(),
        status: app.status,
        appointmentType: app.appointmentType,
        isVip,
        priority: app.priority,
        debt,
        lastVisitAt: p.metrics?.lastVisitAt?.toISOString() || null,
      };

      if (app.status === 'SCHEDULED' || app.status === 'CONFIRMED') {
        columns.WAITING.push(card);
      } else if (columns[app.status]) {
        columns[app.status].push(card);
      } else {
        columns.CANCELLED.push(card);
      }
    }

    const counters = {
      total: appointments.length,
      waiting: columns.WAITING?.length ?? 0,
      checkedIn: columns.CHECKED_IN?.length ?? 0,
      inProgress: columns.IN_PROGRESS?.length ?? 0,
      completedPendingPayment: columns.COMPLETED_PENDING_PAYMENT?.length ?? 0,
      completed: columns.COMPLETED?.length ?? 0,
      cancelled: columns.CANCELLED?.length ?? 0,
      noShow: columns.NO_SHOW?.length ?? 0,
    };

    const queue = [...(columns.CHECKED_IN ?? [])].sort((a: any, b: any) => {
      const aPriority = a.priority ?? 'NORMAL';
      const bPriority = b.priority ?? 'NORMAL';
      if (aPriority !== bPriority) {
        return bPriority.localeCompare(aPriority);
      }
      return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
    });

    const dashboardJson = {
      branchId,
      date: dateStr,
      columns,
      counters,
      queue,
      recalculatedAt: new Date().toISOString(),
    };

    await this.saveDashboardToCache(tenantId, branchId, dateStr, dashboardJson);
    return dashboardJson;
  }

  private async saveDashboardToCache(
    tenantId: string,
    branchId: string,
    dateStr: string,
    dashboardJson: any,
  ) {
    await this.schedulingPrisma.receptionistDashboardCache.upsert({
      where: {
        tenantId_branchId_dashboardDate: {
          tenantId,
          branchId,
          dashboardDate: new Date(dateStr),
        },
      },
      create: {
        tenantId,
        branchId,
        dashboardDate: new Date(dateStr),
        dashboardJson: dashboardJson as any,
        recalculatedAt: new Date(),
      },
      update: {
        dashboardJson: dashboardJson as any,
        recalculatedAt: new Date(),
      },
    });

    this.realtime.emitAppointmentEvent('reception.dashboard.updated', tenantId, branchId, {
      dateStr,
    });
  }

  async checkIn(user: AuthenticatedUser, dto: CheckInDto) {
    const appointment = await this.schedulingPrisma.appointment.findUnique({
      where: { id: dto.appointmentId },
    });
    if (!appointment) throw new NotFoundException('Запись не найдена');
    if (appointment.tenantId !== user.tenantId) throw new ForbiddenException();

    const patient = await this.prisma.patient.findUnique({
      where: { id: appointment.patientId },
    });
    if (!patient) throw new NotFoundException('Пациент не найден');

    const allowed = ['SCHEDULED', 'CONFIRMED'];
    if (!allowed.includes(appointment.status)) {
      throw new BadRequestException(
        `Нельзя зарегистрировать визит со статусом ${appointment.status}`,
      );
    }

    const result = await this.schedulingPrisma.$transaction(async (tx) => {
      const app = await tx.appointment.update({
        where: { id: dto.appointmentId },
        data: { status: 'CHECKED_IN', checkedInAt: new Date() },
      });

      await tx.appointmentStatusHistory.create({
        data: {
          tenantId: user.tenantId,
          appointmentId: dto.appointmentId,
          oldStatus: appointment.status,
          newStatus: 'CHECKED_IN',
          changedBy: user.userId,
          reason: 'Регистрация на ресепшене',
        },
      });

      await tx.appointmentVisitState.create({
        data: {
          tenantId: user.tenantId,
          appointmentId: dto.appointmentId,
          oldState: appointment.status,
          newState: 'CHECKED_IN',
          changedBy: user.userId,
          workstationType: 'RECEPTIONIST',
        },
      });

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const queueCount = await tx.visitQueue.count({
        where: {
          tenantId: user.tenantId,
          branchId: app.branchId,
          createdAt: { gte: startOfDay },
        },
      });
      const queueNumber = `Q-${String(queueCount + 1).padStart(3, '0')}`;

      const patientsAhead = await tx.visitQueue.count({
        where: {
          tenantId: user.tenantId,
          branchId: app.branchId,
          queueStatus: { in: ['WAITING', 'CALLED'] },
          appointment: { employeeId: app.employeeId },
        },
      });
      const estimatedWaitTime = patientsAhead * 15;

      const queueRecord = await tx.visitQueue.create({
        data: {
          tenantId: user.tenantId,
          branchId: app.branchId,
          appointmentId: dto.appointmentId,
          queueNumber,
          queueStatus: 'WAITING',
          priority: dto.priority,
          estimatedWaitTime,
        },
      });

      return { app, queueRecord };
    });

    const dateStr = appointment.startAt.toISOString().slice(0, 10);
    await this.recalculateDashboard(user.tenantId, appointment.branchId, dateStr);

    this.realtime.emitAppointmentEvent('patient.checked_in', user.tenantId, appointment.branchId, {
      appointmentId: appointment.id,
      patientName: patient.fullName,
      queueNumber: result.queueRecord.queueNumber,
    });
    this.realtime.emitAppointmentEvent(
      'queue.updated',
      user.tenantId,
      appointment.branchId,
      result.queueRecord,
    );

    await this.audit.log({
      tenantId: user.tenantId,
      branchId: appointment.branchId,
      userId: user.userId,
      action: 'receptionist.checkin',
      entityType: 'appointment',
      entityId: appointment.id,
      newValuesJson: result,
    });

    return result;
  }

  async transitionVisit(
    user: AuthenticatedUser,
    appointmentId: string,
    status: string,
    reason?: string,
  ) {
    const current = await this.schedulingPrisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    if (!current) throw new NotFoundException('Запись не найдена');
    if (current.tenantId !== user.tenantId) throw new ForbiddenException();

    const allowedTransitions: Record<string, string[]> = {
      SCHEDULED: ['CONFIRMED', 'CANCELLED', 'NO_SHOW'],
      CONFIRMED: ['CHECKED_IN', 'CANCELLED', 'NO_SHOW'],
      CHECKED_IN: ['IN_PROGRESS', 'CANCELLED', 'NO_SHOW'],
      IN_PROGRESS: ['COMPLETED_PENDING_PAYMENT', 'COMPLETED', 'CANCELLED', 'NO_SHOW'],
      COMPLETED_PENDING_PAYMENT: ['COMPLETED', 'CANCELLED'],
      COMPLETED: [],
      CANCELLED: [],
      NO_SHOW: [],
    };

    const nextOptions = allowedTransitions[current.status] || [];
    if (!nextOptions.includes(status)) {
      throw new BadRequestException(
        `Нельзя перевести визит из статуса ${current.status} в ${status}`,
      );
    }

    const data: Record<string, Date | string | null> = { status };
    if (status === 'CONFIRMED') data.confirmedAt = new Date();
    if (status === 'CHECKED_IN') data.checkedInAt = new Date();
    if (status === 'COMPLETED') data.completedAt = new Date();
    if (status === 'CANCELLED') {
      data.cancelledAt = new Date();
      data.cancellationReason = reason ?? null;
    }

    const app = await this.schedulingPrisma.$transaction(async (tx) => {
      const updated = await tx.appointment.update({
        where: { id: appointmentId },
        data,
      });

      await tx.appointmentStatusHistory.create({
        data: {
          tenantId: user.tenantId,
          appointmentId,
          oldStatus: current.status,
          newStatus: status,
          changedBy: user.userId,
          reason: reason ?? 'Переход статуса визита',
        },
      });

      await tx.appointmentVisitState.create({
        data: {
          tenantId: user.tenantId,
          appointmentId,
          oldState: current.status,
          newState: status,
          changedBy: user.userId,
          workstationType: 'RECEPTIONIST',
        },
      });

      const queueRecord = await tx.visitQueue.findFirst({
        where: { tenantId: user.tenantId, appointmentId },
      });
      if (queueRecord) {
        let newQueueStatus = queueRecord.queueStatus;
        if (status === 'IN_PROGRESS') newQueueStatus = 'IN_ROOM';
        if (status === 'COMPLETED' || status === 'COMPLETED_PENDING_PAYMENT')
          newQueueStatus = 'COMPLETED';
        if (status === 'CANCELLED' || status === 'NO_SHOW') newQueueStatus = 'SKIPPED';

        if (newQueueStatus !== queueRecord.queueStatus) {
          const updatedQueue = await tx.visitQueue.update({
            where: { id: queueRecord.id },
            data: { queueStatus: newQueueStatus },
          });
          this.realtime.emitAppointmentEvent(
            'queue.updated',
            user.tenantId,
            updated.branchId,
            updatedQueue,
          );
        }
      }

      return updated;
    });

    // Resolve patient, service, branch from main DB
    const [patient, service, branch] = await Promise.all([
      this.prisma.patient.findFirst({
        where: { id: app.patientId },
        include: { contacts: true },
      }),
      app.serviceId ? this.prisma.service.findFirst({ where: { id: app.serviceId } }) : null,
      this.prisma.branch.findFirst({ where: { id: app.branchId } }),
    ]);

    const result = {
      ...app,
      patient,
      service,
      branch,
    };

    if (status === 'COMPLETED' || status === 'COMPLETED_PENDING_PAYMENT') {
      await this.autoGenerateInvoice(user, result);
    }

    const dateStr = result.startAt.toISOString().slice(0, 10);
    await this.recalculateDashboard(user.tenantId, result.branchId, dateStr);

    this.realtime.emitAppointmentEvent('visit.completed', user.tenantId, result.branchId, result);

    await this.audit.log({
      tenantId: user.tenantId,
      branchId: result.branchId,
      userId: user.userId,
      action: 'receptionist.visit.status_changed',
      entityType: 'appointment',
      entityId: appointmentId,
      oldValuesJson: current,
      newValuesJson: result,
    });

    return result;
  }

  private async autoGenerateInvoice(user: AuthenticatedUser, app: any) {
    if (!app.serviceId) return;

    const existing = await this.prisma.invoice.findFirst({
      where: { tenantId: user.tenantId, appointmentId: app.id },
    });
    if (existing) return;

    const unitPrice = await this.getServicePrice(app.serviceId);
    const subtotalAmount = unitPrice;
    const totalAmount = unitPrice;

    const invoice = await this.prisma.invoice.create({
      data: {
        tenantId: user.tenantId,
        branchId: app.branchId,
        patientId: app.patientId,
        appointmentId: app.id,
        invoiceNumber: `INV-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
        status: app.status === 'COMPLETED_PENDING_PAYMENT' ? 'PENDING_PAYMENT' : 'DRAFT',
        subtotalAmount,
        discountAmount: 0,
        totalAmount,
        dueAmount: totalAmount,
        createdBy: user.userId,
        items: {
          create: [
            {
              tenantId: user.tenantId,
              serviceId: app.serviceId,
              quantity: 1,
              unitPrice,
              totalAmount: unitPrice,
              performerEmployeeId: app.employeeId,
            },
          ],
        },
      },
      include: { items: true },
    });

    this.realtime.emitAppointmentEvent('invoice.generated', user.tenantId, app.branchId, invoice);
    return invoice;
  }

  async getQueue(user: AuthenticatedUser, branchId: string) {
    const queues = await this.schedulingPrisma.visitQueue.findMany({
      where: { tenantId: user.tenantId, branchId },
      include: { appointment: true },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });

    if (queues.length === 0) return [];

    const patientIds = Array.from(new Set(queues.map((q) => q.appointment.patientId)));
    const patients = await this.prisma.patient.findMany({
      where: { id: { in: patientIds } },
    });
    const patientMap = new Map(patients.map((p) => [p.id, p]));

    return queues.map((q) => ({
      ...q,
      appointment: {
        ...q.appointment,
        patient: patientMap.get(q.appointment.patientId) || null,
      },
    }));
  }

  async updateQueueStatus(
    user: AuthenticatedUser,
    queueId: string,
    status: string,
    reason?: string,
  ) {
    const queueRecord = await this.schedulingPrisma.visitQueue.findUnique({
      where: { id: queueId },
    });
    if (!queueRecord) throw new NotFoundException('Запись очереди не найдена');
    if (queueRecord.tenantId !== user.tenantId) throw new ForbiddenException();

    const allowed = ['WAITING', 'CALLED', 'IN_ROOM', 'COMPLETED', 'SKIPPED'];
    if (!allowed.includes(status)) {
      throw new BadRequestException(`Недопустимый статус очереди: ${status}`);
    }

    const updated = await this.schedulingPrisma.visitQueue.update({
      where: { id: queueId },
      data: { queueStatus: status },
    });

    this.realtime.emitAppointmentEvent(
      'queue.updated',
      user.tenantId,
      queueRecord.branchId,
      updated,
    );

    const dateStr = queueRecord.createdAt.toISOString().slice(0, 10);
    await this.recalculateDashboard(user.tenantId, queueRecord.branchId, dateStr);

    await this.audit.log({
      tenantId: user.tenantId,
      branchId: queueRecord.branchId,
      userId: user.userId,
      action: 'receptionist.queue.updated',
      entityType: 'visit_queue',
      entityId: queueId,
      oldValuesJson: queueRecord,
      newValuesJson: { ...updated, reason },
    });

    return updated;
  }

  async updateQueuePriority(user: AuthenticatedUser, id: string, priority: string) {
    let queueRecord = await this.schedulingPrisma.visitQueue.findUnique({
      where: { id },
    });
    if (!queueRecord) {
      queueRecord = await this.schedulingPrisma.visitQueue.findFirst({
        where: { appointmentId: id, tenantId: user.tenantId },
      });
    }
    if (!queueRecord) throw new NotFoundException('Запись очереди не найдена');
    if (queueRecord.tenantId !== user.tenantId) throw new ForbiddenException();

    const allowed = ['VIP', 'URGENT', 'NORMAL', 'LOW'];
    if (!allowed.includes(priority)) {
      throw new BadRequestException(`Недопустимый приоритет очереди: ${priority}`);
    }

    const updated = await this.schedulingPrisma.visitQueue.update({
      where: { id: queueRecord.id },
      data: { priority },
    });

    this.realtime.emitAppointmentEvent(
      'queue.updated',
      user.tenantId,
      queueRecord.branchId,
      updated,
    );

    const dateStr = queueRecord.createdAt.toISOString().slice(0, 10);
    await this.recalculateDashboard(user.tenantId, queueRecord.branchId, dateStr);

    await this.audit.log({
      tenantId: user.tenantId,
      branchId: queueRecord.branchId,
      userId: user.userId,
      action: 'receptionist.queue.priority_updated',
      entityType: 'visit_queue',
      entityId: queueRecord.id,
      oldValuesJson: { priority: queueRecord.priority },
      newValuesJson: { priority },
    });

    return updated;
  }

  async incomingCall(user: AuthenticatedUser, dto: IncomingCallDto) {
    const normPhone = this.normalizePhone(dto.phoneNumber);
    const phoneHash = this.hashPhone(normPhone);

    const contact = await this.prisma.patientContact.findFirst({
      where: { tenantId: user.tenantId, normalizedValueHash: phoneHash },
      include: {
        patient: {
          include: {
            tags: { include: { tag: true } },
            metrics: true,
            invoices: {
              where: { status: { in: ['DRAFT', 'PENDING_PAYMENT'] } },
            },
          },
        },
      },
    });

    let card = null;
    if (contact) {
      const p = contact.patient;
      const debt = p.invoices.reduce((sum: number, inv: any) => sum + Number(inv.totalAmount), 0);
      const isVip = p.tags.some(
        (t: any) => t.tag.code === 'VIP' || t.tag.name.toLowerCase() === 'vip',
      );
      const notesCount = await this.prisma.patientNote.count({ where: { patientId: p.id } });

      card = {
        patientId: p.id,
        fullName: p.fullName,
        patientCode: p.patientCode,
        isVip,
        lastVisitAt: p.metrics?.lastVisitAt?.toISOString() || null,
        debt,
        notesCount,
      };
    }

    const call = await this.schedulingPrisma.incomingCall.create({
      data: {
        tenantId: user.tenantId,
        branchId: dto.branchId,
        phoneNumber: dto.phoneNumber,
        patientId: contact ? contact.patientId : null,
        operatorUserId: user.userId,
        callStartedAt: new Date(),
        callResult: 'ANSWERED',
      },
    });

    this.realtime.emitAppointmentEvent('call.received', user.tenantId, dto.branchId, {
      callId: call.id,
      phoneNumber: dto.phoneNumber,
      card,
    });

    await this.audit.log({
      tenantId: user.tenantId,
      branchId: dto.branchId,
      userId: user.userId,
      action: 'call.popup.opened',
      entityType: 'incoming_call',
      entityId: call.id,
      newValuesJson: { call, card },
    });

    return { call, card };
  }

  async searchCalls(user: AuthenticatedUser, branchId: string) {
    const calls = await this.schedulingPrisma.incomingCall.findMany({
      where: { tenantId: user.tenantId, branchId },
      orderBy: { callStartedAt: 'desc' },
      take: 20,
    });

    if (calls.length === 0) return [];

    const patientIds = Array.from(
      new Set(calls.map((c) => c.patientId).filter(Boolean)),
    ) as string[];
    const patients =
      patientIds.length > 0
        ? await this.prisma.patient.findMany({ where: { id: { in: patientIds } } })
        : [];
    const patientMap = new Map(patients.map((p) => [p.id, p]));

    return calls.map((c) => ({
      ...c,
      patient: c.patientId ? patientMap.get(c.patientId) || null : null,
    }));
  }

  async getInvoices(user: AuthenticatedUser, branchId: string) {
    return this.prisma.invoice.findMany({
      where: { tenantId: user.tenantId, branchId },
      include: { patient: true, items: { include: { service: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createInvoice(user: AuthenticatedUser, dto: CreateInvoiceDto) {
    const subtotal = dto.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const total = Math.max(0, subtotal - (dto.discountAmount ?? 0));

    const invoice = await this.prisma.invoice.create({
      data: {
        tenantId: user.tenantId,
        branchId: dto.branchId,
        patientId: dto.patientId,
        appointmentId: dto.appointmentId || null,
        invoiceNumber: `INV-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
        status: 'DRAFT',
        subtotalAmount: subtotal,
        discountAmount: dto.discountAmount ?? 0,
        totalAmount: total,
        dueAmount: total,
        createdBy: user.userId,
        items: {
          create: dto.items.map((item) => ({
            tenantId: user.tenantId,
            serviceId: item.serviceId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalAmount: item.unitPrice * item.quantity,
            performerEmployeeId: item.performerEmployeeId || null,
          })),
        },
      },
      include: { items: true },
    });

    this.realtime.emitAppointmentEvent('invoice.generated', user.tenantId, dto.branchId, invoice);

    await this.audit.log({
      tenantId: user.tenantId,
      branchId: dto.branchId,
      userId: user.userId,
      action: 'invoice.draft.created',
      entityType: 'invoice',
      entityId: invoice.id,
      newValuesJson: invoice,
    });

    return invoice;
  }

  async payInvoice(user: AuthenticatedUser, invoiceId: string, dto: PayInvoiceDto) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });
    if (!invoice) throw new NotFoundException('Счет не найден');
    if (invoice.tenantId !== user.tenantId) throw new ForbiddenException();

    const { updatedInvoice, shouldUpdateAppointment } = await this.prisma.$transaction(
      async (tx) => {
        const inv = await tx.invoice.update({
          where: { id: invoiceId },
          data: { status: 'PAID' },
        });

        await tx.payment.create({
          data: {
            tenantId: user.tenantId,
            branchId: invoice.branchId,
            invoiceId: invoice.id,
            patientId: invoice.patientId,
            paymentMethod: dto.paymentMethod,
            amount: invoice.totalAmount,
            cashierUserId: user.userId,
            status: 'COMPLETED',
          },
        });

        return { updatedInvoice: inv, shouldUpdateAppointment: !!invoice.appointmentId };
      },
    );

    // If tied to an appointment, transition the appointment status to COMPLETED
    if (shouldUpdateAppointment && invoice.appointmentId) {
      const app = await this.schedulingPrisma.appointment.findUnique({
        where: { id: invoice.appointmentId },
      });
      if (app && ['COMPLETED_PENDING_PAYMENT', 'CHECKED_IN', 'IN_PROGRESS'].includes(app.status)) {
        await this.schedulingPrisma.$transaction(async (tx) => {
          await tx.appointment.update({
            where: { id: invoice.appointmentId! },
            data: { status: 'COMPLETED', completedAt: new Date() },
          });

          await tx.appointmentStatusHistory.create({
            data: {
              tenantId: user.tenantId,
              appointmentId: invoice.appointmentId!,
              oldStatus: app.status,
              newStatus: 'COMPLETED',
              changedBy: user.userId,
              reason: 'Счет полностью оплачен',
            },
          });

          await tx.appointmentVisitState.create({
            data: {
              tenantId: user.tenantId,
              appointmentId: invoice.appointmentId!,
              oldState: app.status,
              newState: 'COMPLETED',
              changedBy: user.userId,
              workstationType: 'RECEPTIONIST',
            },
          });
        });
      }
    }

    this.realtime.emitAppointmentEvent(
      'payment.completed',
      user.tenantId,
      invoice.branchId,
      updatedInvoice,
    );

    // Invalidate dashboard cache
    const dateStr = invoice.createdAt.toISOString().slice(0, 10);
    await this.recalculateDashboard(user.tenantId, invoice.branchId, dateStr);

    await this.recalculateMetrics(user.tenantId, invoice.patientId);

    await this.audit.log({
      tenantId: user.tenantId,
      branchId: invoice.branchId,
      userId: user.userId,
      action: 'payment.completed',
      entityType: 'invoice',
      entityId: invoiceId,
      oldValuesJson: invoice,
      newValuesJson: updatedInvoice,
    });

    return updatedInvoice;
  }

  async fastBooking(user: AuthenticatedUser, dto: FastBookingDto) {
    const normPhone = this.normalizePhone(dto.phone);
    const phoneHash = this.hashPhone(normPhone);

    const contact = await this.prisma.patientContact.findFirst({
      where: { tenantId: user.tenantId, normalizedValueHash: phoneHash },
      include: { patient: true },
    });

    let patientId = contact?.patientId;

    if (!patientId) {
      const patientCode = await this.nextPatientCode(user.tenantId);
      const fullName = [dto.lastName, dto.firstName, dto.middleName].filter(Boolean).join(' ');

      const newPatient = await this.prisma.patient.create({
        data: {
          tenantId: user.tenantId,
          patientCode,
          firstName: dto.firstName,
          lastName: dto.lastName,
          middleName: dto.middleName,
          fullName,
          contacts: {
            create: [
              {
                tenantId: user.tenantId,
                type: 'PHONE',
                value: dto.phone,
                normalizedValueHash: phoneHash,
                isPrimary: true,
              },
            ],
          },
        },
      });
      patientId = newPatient.id;
    }

    const service = await this.prisma.service.findUnique({
      where: { id: dto.serviceId },
    });
    const duration = service?.durationMinutes ?? 30;
    const startAt = new Date(dto.startAt);
    const endAt = new Date(startAt.getTime() + duration * 60 * 1000);

    const app = await this.scheduling.create(user, {
      branchId: dto.branchId,
      patientId: patientId!,
      employeeId: dto.employeeId,
      serviceId: dto.serviceId,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      bookingSource: 'PHONE_CALL',
      appointmentType: 'CONSULTATION',
      notes: 'Быстрая запись через АРМ администратора',
    });

    // If booking contains a custom priority, update appointment priority
    if (dto.priority && dto.priority !== 'NORMAL') {
      await this.schedulingPrisma.appointment.update({
        where: { id: app.id },
        data: { priority: dto.priority },
      });
    }

    const dateStr = startAt.toISOString().slice(0, 10);
    await this.recalculateDashboard(user.tenantId, dto.branchId, dateStr);

    await this.audit.log({
      tenantId: user.tenantId,
      branchId: dto.branchId,
      userId: user.userId,
      action: 'receptionist.fastbooking',
      entityType: 'appointment',
      entityId: app.id,
      newValuesJson: app,
    });

    return app;
  }

  async getPatientPreview(user: AuthenticatedUser, patientId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, tenantId: user.tenantId },
      include: {
        contacts: true,
        tags: { include: { tag: true } },
        metrics: true,
        familyMembers: {
          include: { familyGroup: { include: { members: { include: { patient: true } } } } },
        },
        invoices: {
          where: { status: { in: ['DRAFT', 'PENDING_PAYMENT'] } },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });
    if (!patient) throw new NotFoundException('Пациент не найден');

    const recentAppointments = await this.schedulingPrisma.appointment.findMany({
      where: { patientId, tenantId: user.tenantId },
      orderBy: { startAt: 'desc' },
      take: 5,
    });

    const serviceIds = recentAppointments.map((a) => a.serviceId).filter(Boolean) as string[];
    const services =
      serviceIds.length > 0
        ? await this.prisma.service.findMany({ where: { id: { in: serviceIds } } })
        : [];
    const serviceMap = new Map(services.map((s) => [s.id, s]));

    const recentAppointmentsWithService = recentAppointments.map((a) => ({
      id: a.id,
      date: a.startAt.toISOString(),
      service: a.serviceId ? (serviceMap.get(a.serviceId)?.name ?? 'Без услуги') : 'Без услуги',
      status: a.status,
    }));

    const debt = patient.invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
    const isVip = patient.tags.some(
      (t) => t.tag.code === 'VIP' || t.tag.name.toLowerCase() === 'vip',
    );
    const age = patient.birthDate ? this.calculateAge(patient.birthDate) : null;
    const primaryPhone =
      patient.contacts.find((c) => c.isPrimary)?.value || patient.contacts[0]?.value || null;

    const familyMembers = patient.familyMembers.flatMap((fm) =>
      fm.familyGroup.members
        .filter((m) => m.patientId !== patientId)
        .map((m) => ({
          id: m.patient.id,
          name: m.patient.fullName,
          relation: fm.relationType,
        })),
    );

    return {
      id: patient.id,
      fullName: patient.fullName,
      patientCode: patient.patientCode,
      age,
      gender: patient.gender,
      phone: primaryPhone,
      isVip,
      status: patient.status,
      debt,
      tags: patient.tags.map((t) => ({ id: t.tag.id, name: t.tag.name, color: t.tag.color })),
      metrics: patient.metrics
        ? {
            totalVisits: patient.metrics.totalVisits,
            totalRevenue: Number(patient.metrics.totalRevenue),
            ltv: Number(patient.metrics.ltv),
            averageCheck: Number(patient.metrics.averageCheck),
            retentionScore: patient.metrics.retentionScore,
          }
        : null,
      familyMembers,
      recentAppointments: recentAppointmentsWithService,
    };
  }

  async recalculateMetrics(tenantId: string, patientId: string) {
    const appointments = await this.schedulingPrisma.appointment.findMany({
      where: { tenantId, patientId },
    });

    const completed = appointments.filter((a: any) => a.status === 'COMPLETED');
    const cancellations = appointments.filter((a: any) => a.status === 'CANCELLED').length;
    const missed = appointments.filter((a: any) => a.status === 'NO_SHOW').length;
    const totalVisits = completed.length;

    const invoices = await this.prisma.invoice.findMany({
      where: { tenantId, patientId, status: 'PAID' },
    });
    const totalRevenue = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
    const averageCheck = totalVisits > 0 ? totalRevenue / totalVisits : 0;

    const lastVisit =
      completed.length > 0
        ? new Date(Math.max(...completed.map((c: any) => c.startAt.getTime())))
        : null;

    await this.prisma.patientCrmMetric.upsert({
      where: { patientId },
      update: {
        totalVisits,
        totalRevenue: new Prisma.Decimal(totalRevenue),
        ltv: new Prisma.Decimal(totalRevenue),
        averageCheck: new Prisma.Decimal(averageCheck),
        missedAppointments: missed,
        cancellations,
        lastVisitAt: lastVisit,
      },
      create: {
        tenantId,
        patientId,
        totalVisits,
        totalRevenue: new Prisma.Decimal(totalRevenue),
        ltv: new Prisma.Decimal(totalRevenue),
        averageCheck: new Prisma.Decimal(averageCheck),
        missedAppointments: missed,
        cancellations,
        lastVisitAt: lastVisit,
      },
    });
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
}
