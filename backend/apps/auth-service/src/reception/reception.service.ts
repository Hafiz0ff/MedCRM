import { Injectable, Inject, NotFoundException, ForbiddenException, BadRequestException, forwardRef } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import Redis from 'ioredis';
import { PrismaService } from '@core/database/prisma.service';
import { AuthenticatedUser } from '@core/security/jwt-payload';
import { REDIS_CLIENT } from '@core/cache/redis.module';
import { AuditLoggerService } from '@core/audit/audit-logger.service';
import { RealtimeGateway } from '../smart-scheduling/realtime.gateway';
import { SmartSchedulingService } from '../smart-scheduling/smart-scheduling.service';
import {
  CheckInDto,
  FastBookingDto,
  IncomingCallDto,
  CreateInvoiceDto,
  PayInvoiceDto
} from './dto/reception.dto';

const BOARD_STATUSES = ['WAITING', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED_PENDING_PAYMENT', 'COMPLETED', 'NO_SHOW', 'CANCELLED'];

@Injectable()
export class ReceptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLoggerService,
    private readonly realtime: RealtimeGateway,
    @Inject(forwardRef(() => SmartSchedulingService))
    private readonly scheduling: SmartSchedulingService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis
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
    
    const cached = await this.prisma.receptionistDashboardCache.findUnique({
      where: {
        tenantId_branchId_dashboardDate: {
          tenantId: user.tenantId,
          branchId: targetBranchId,
          dashboardDate: new Date(todayStr)
        }
      }
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

    const appointments = await this.prisma.appointment.findMany({
      where: {
        tenantId,
        branchId,
        startAt: { gte: start, lte: end }
      },
      include: {
        patient: {
          include: {
            contacts: true,
            tags: { include: { tag: true } },
            metrics: true,
            invoices: {
              where: { status: { in: ['DRAFT', 'PENDING_PAYMENT'] } }
            }
          }
        },
        service: true,
        resources: true
      },
      orderBy: { startAt: 'asc' }
    });

    const employeeIds = [...new Set(appointments.map(a => a.employeeId))];
    const employees = await this.prisma.employee.findMany({
      where: { id: { in: employeeIds } }
    });
    const employeeMap = new Map(employees.map(e => [e.id, e]));

    const roomIds = appointments
      .flatMap(a => a.resources)
      .filter(r => r.resourceType === 'ROOM')
      .map(r => r.resourceId);
    const rooms = await this.prisma.room.findMany({
      where: { id: { in: roomIds } }
    });
    const roomMap = new Map(rooms.map(r => [r.id, r]));

    const columns: Record<string, any[]> = {
      WAITING: [],
      CHECKED_IN: [],
      IN_PROGRESS: [],
      COMPLETED_PENDING_PAYMENT: [],
      COMPLETED: [],
      NO_SHOW: [],
      CANCELLED: []
    };

    for (const app of appointments) {
      const p = app.patient;
      const primaryContact = p.contacts.find(c => c.isPrimary)?.value || (p.contacts[0]?.value || null);
      const isVip = p.tags.some(t => t.tag.code === 'VIP' || t.tag.name.toLowerCase() === 'vip');
      const debt = p.invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
      const age = p.birthDate ? this.calculateAge(p.birthDate) : null;

      const employee = employeeMap.get(app.employeeId);
      const doctorName = employee ? `${employee.lastName} ${employee.firstName}` : 'Неизвестный врач';

      const appRooms = app.resources.filter(r => r.resourceType === 'ROOM');
      const roomName = appRooms.map(r => roomMap.get(r.resourceId)?.name).filter(Boolean).join(', ') || 'Нет кабинета';

      const card = {
        id: app.id,
        patientId: p.id,
        patientName: p.fullName,
        patientCode: p.patientCode,
        age,
        phone: primaryContact,
        doctorName,
        roomName,
        startAt: app.startAt.toISOString(),
        endAt: app.endAt.toISOString(),
        status: app.status,
        appointmentType: app.appointmentType,
        isVip,
        debt,
        lastVisitAt: p.metrics?.lastVisitAt?.toISOString() || null
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
      waiting: (columns.WAITING?.length ?? 0),
      checkedIn: (columns.CHECKED_IN?.length ?? 0),
      inProgress: (columns.IN_PROGRESS?.length ?? 0),
      completedPendingPayment: (columns.COMPLETED_PENDING_PAYMENT?.length ?? 0),
      completed: (columns.COMPLETED?.length ?? 0),
      cancelled: (columns.CANCELLED?.length ?? 0),
      noShow: (columns.NO_SHOW?.length ?? 0)
    };

    const queue = [...(columns.CHECKED_IN ?? [])].sort((a: any, b: any) => {
      const aPriority = a.isVip ? 0 : 2;
      const bPriority = b.isVip ? 0 : 2;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
    });

    const dashboardJson = {
      branchId,
      date: dateStr,
      columns,
      counters,
      queue,
      recalculatedAt: new Date().toISOString()
    };

    await this.prisma.receptionistDashboardCache.upsert({
      where: {
        tenantId_branchId_dashboardDate: {
          tenantId,
          branchId,
          dashboardDate: new Date(dateStr)
        }
      },
      create: {
        tenantId,
        branchId,
        dashboardDate: new Date(dateStr),
        dashboardJson: dashboardJson as any,
        recalculatedAt: new Date()
      },
      update: {
        dashboardJson: dashboardJson as any,
        recalculatedAt: new Date()
      }
    });

    this.realtime.emitAppointmentEvent('reception.dashboard.updated', tenantId, branchId, { dateStr });
    return dashboardJson;
  }

  async checkIn(user: AuthenticatedUser, dto: CheckInDto) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: dto.appointmentId },
      include: { patient: true }
    });
    if (!appointment) throw new NotFoundException('Запись не найдена');
    if (appointment.tenantId !== user.tenantId) throw new ForbiddenException();

    const allowed = ['SCHEDULED', 'CONFIRMED'];
    if (!allowed.includes(appointment.status)) {
      throw new BadRequestException(`Нельзя зарегистрировать визит со статусом ${appointment.status}`);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const app = await tx.appointment.update({
        where: { id: dto.appointmentId },
        data: { status: 'CHECKED_IN', checkedInAt: new Date() }
      });

      await tx.appointmentStatusHistory.create({
        data: {
          tenantId: user.tenantId,
          appointmentId: dto.appointmentId,
          oldStatus: appointment.status,
          newStatus: 'CHECKED_IN',
          changedBy: user.userId,
          reason: 'Регистрация на ресепшене'
        }
      });

      await tx.appointmentVisitState.create({
        data: {
          tenantId: user.tenantId,
          appointmentId: dto.appointmentId,
          oldState: appointment.status,
          newState: 'CHECKED_IN',
          changedBy: user.userId,
          workstationType: 'RECEPTIONIST'
        }
      });

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const queueCount = await tx.visitQueue.count({
        where: {
          tenantId: user.tenantId,
          branchId: app.branchId,
          createdAt: { gte: startOfDay }
        }
      });
      const queueNumber = `Q-${String(queueCount + 1).padStart(3, '0')}`;

      const patientsAhead = await tx.visitQueue.count({
        where: {
          tenantId: user.tenantId,
          branchId: app.branchId,
          queueStatus: { in: ['WAITING', 'CALLED'] },
          appointment: { employeeId: app.employeeId }
        }
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
          estimatedWaitTime
        }
      });

      return { app, queueRecord };
    });

    const dateStr = appointment.startAt.toISOString().slice(0, 10);
    await this.recalculateDashboard(user.tenantId, appointment.branchId, dateStr);

    this.realtime.emitAppointmentEvent('patient.checked_in', user.tenantId, appointment.branchId, {
      appointmentId: appointment.id,
      patientName: appointment.patient.fullName,
      queueNumber: result.queueRecord.queueNumber
    });
    this.realtime.emitAppointmentEvent('queue.updated', user.tenantId, appointment.branchId, result.queueRecord);

    await this.audit.log({
      tenantId: user.tenantId,
      branchId: appointment.branchId,
      userId: user.userId,
      action: 'receptionist.checkin',
      entityType: 'appointment',
      entityId: appointment.id,
      newValuesJson: result
    });

    return result;
  }

  async transitionVisit(user: AuthenticatedUser, appointmentId: string, status: string, reason?: string) {
    const current = await this.prisma.appointment.findUnique({
      where: { id: appointmentId }
    });
    if (!current) throw new NotFoundException('Запись не найдена');
    if (current.tenantId !== user.tenantId) throw new ForbiddenException();

    const allowedTransitions: Record<string, string[]> = {
      'SCHEDULED': ['CONFIRMED', 'CANCELLED', 'NO_SHOW'],
      'CONFIRMED': ['CHECKED_IN', 'CANCELLED', 'NO_SHOW'],
      'CHECKED_IN': ['IN_PROGRESS', 'CANCELLED', 'NO_SHOW'],
      'IN_PROGRESS': ['COMPLETED_PENDING_PAYMENT', 'COMPLETED', 'CANCELLED', 'NO_SHOW'],
      'COMPLETED_PENDING_PAYMENT': ['COMPLETED', 'CANCELLED'],
      'COMPLETED': [],
      'CANCELLED': [],
      'NO_SHOW': []
    };

    const nextOptions = allowedTransitions[current.status] || [];
    if (!nextOptions.includes(status)) {
      throw new BadRequestException(`Нельзя перевести визит из статуса ${current.status} в ${status}`);
    }

    const data: Record<string, Date | string | null> = { status };
    if (status === 'CONFIRMED') data.confirmedAt = new Date();
    if (status === 'CHECKED_IN') data.checkedInAt = new Date();
    if (status === 'COMPLETED') data.completedAt = new Date();
    if (status === 'CANCELLED') {
      data.cancelledAt = new Date();
      data.cancellationReason = reason ?? null;
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const app = await tx.appointment.update({
        where: { id: appointmentId },
        data,
        include: { patient: { include: { contacts: true } }, service: true, branch: true }
      });

      await tx.appointmentStatusHistory.create({
        data: {
          tenantId: user.tenantId,
          appointmentId,
          oldStatus: current.status,
          newStatus: status,
          changedBy: user.userId,
          reason: reason ?? 'Переход статуса визита'
        }
      });

      await tx.appointmentVisitState.create({
        data: {
          tenantId: user.tenantId,
          appointmentId,
          oldState: current.status,
          newState: status,
          changedBy: user.userId,
          workstationType: 'RECEPTIONIST'
        }
      });

      const queueRecord = await tx.visitQueue.findFirst({
        where: { tenantId: user.tenantId, appointmentId }
      });
      if (queueRecord) {
        let newQueueStatus = queueRecord.queueStatus;
        if (status === 'IN_PROGRESS') newQueueStatus = 'IN_ROOM';
        if (status === 'COMPLETED' || status === 'COMPLETED_PENDING_PAYMENT') newQueueStatus = 'COMPLETED';
        if (status === 'CANCELLED' || status === 'NO_SHOW') newQueueStatus = 'SKIPPED';

        if (newQueueStatus !== queueRecord.queueStatus) {
          const updatedQueue = await tx.visitQueue.update({
            where: { id: queueRecord.id },
            data: { queueStatus: newQueueStatus }
          });
          this.realtime.emitAppointmentEvent('queue.updated', user.tenantId, app.branchId, updatedQueue);
        }
      }

      if (status === 'COMPLETED' || status === 'COMPLETED_PENDING_PAYMENT') {
        await this.autoGenerateInvoiceTx(tx, user, app);
      }

      return app;
    });

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
      newValuesJson: result
    });

    return result;
  }

  private async autoGenerateInvoiceTx(tx: any, user: AuthenticatedUser, app: any) {
    if (!app.serviceId || !app.service) return;

    const existing = await tx.invoice.findFirst({
      where: { tenantId: user.tenantId, appointmentId: app.id }
    });
    if (existing) return;

    const unitPrice = await this.getServicePrice(app.serviceId);
    const subtotalAmount = unitPrice;
    const totalAmount = unitPrice;

    const invoice = await tx.invoice.create({
      data: {
        tenantId: user.tenantId,
        branchId: app.branchId,
        patientId: app.patientId,
        appointmentId: app.id,
        status: app.status === 'COMPLETED_PENDING_PAYMENT' ? 'PENDING_PAYMENT' : 'DRAFT',
        subtotalAmount,
        discountAmount: 0,
        totalAmount,
        createdBy: user.userId,
        items: {
          create: [
            {
              tenantId: user.tenantId,
              serviceId: app.serviceId,
              quantity: 1,
              unitPrice,
              totalPrice: unitPrice,
              performerEmployeeId: app.employeeId
            }
          ]
        }
      },
      include: { items: true }
    });

    this.realtime.emitAppointmentEvent('invoice.generated', user.tenantId, app.branchId, invoice);
    return invoice;
  }

  async getQueue(user: AuthenticatedUser, branchId: string) {
    return this.prisma.visitQueue.findMany({
      where: { tenantId: user.tenantId, branchId },
      include: { appointment: { include: { patient: true } } },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' }
      ]
    });
  }

  async updateQueueStatus(user: AuthenticatedUser, queueId: string, status: string, reason?: string) {
    const queueRecord = await this.prisma.visitQueue.findUnique({
      where: { id: queueId }
    });
    if (!queueRecord) throw new NotFoundException('Запись очереди не найдена');
    if (queueRecord.tenantId !== user.tenantId) throw new ForbiddenException();

    const allowed = ['WAITING', 'CALLED', 'IN_ROOM', 'COMPLETED', 'SKIPPED'];
    if (!allowed.includes(status)) {
      throw new BadRequestException(`Недопустимый статус очереди: ${status}`);
    }

    const updated = await this.prisma.visitQueue.update({
      where: { id: queueId },
      data: { queueStatus: status }
    });

    this.realtime.emitAppointmentEvent('queue.updated', user.tenantId, queueRecord.branchId, updated);

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
      newValuesJson: { ...updated, reason }
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
              where: { status: { in: ['DRAFT', 'PENDING_PAYMENT'] } }
            }
          }
        }
      }
    });

    let card = null;
    if (contact) {
      const p = contact.patient;
      const debt = p.invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
      const isVip = p.tags.some(t => t.tag.code === 'VIP' || t.tag.name.toLowerCase() === 'vip');
      const notesCount = await this.prisma.patientNote.count({ where: { patientId: p.id } });

      card = {
        patientId: p.id,
        fullName: p.fullName,
        patientCode: p.patientCode,
        isVip,
        lastVisitAt: p.metrics?.lastVisitAt?.toISOString() || null,
        debt,
        notesCount
      };
    }

    const call = await this.prisma.incomingCall.create({
      data: {
        tenantId: user.tenantId,
        branchId: dto.branchId,
        phoneNumber: dto.phoneNumber,
        patientId: contact ? contact.patientId : null,
        operatorUserId: user.userId,
        callStartedAt: new Date(),
        callResult: 'ANSWERED'
      }
    });

    this.realtime.emitAppointmentEvent('call.received', user.tenantId, dto.branchId, {
      callId: call.id,
      phoneNumber: dto.phoneNumber,
      card
    });

    await this.audit.log({
      tenantId: user.tenantId,
      branchId: dto.branchId,
      userId: user.userId,
      action: 'call.popup.opened',
      entityType: 'incoming_call',
      entityId: call.id,
      newValuesJson: { call, card }
    });

    return { call, card };
  }

  async searchCalls(user: AuthenticatedUser, branchId: string) {
    return this.prisma.incomingCall.findMany({
      where: { tenantId: user.tenantId, branchId },
      include: { patient: true },
      orderBy: { callStartedAt: 'desc' },
      take: 20
    });
  }

  async getInvoices(user: AuthenticatedUser, branchId: string) {
    return this.prisma.invoice.findMany({
      where: { tenantId: user.tenantId, branchId },
      include: { patient: true, items: { include: { service: true } } },
      orderBy: { createdAt: 'desc' }
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
          create: dto.items.map(item => ({
            tenantId: user.tenantId,
            serviceId: item.serviceId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalAmount: item.unitPrice * item.quantity,
            performerEmployeeId: item.performerEmployeeId || null
          }))
        }
      },
      include: { items: true }
    });

    this.realtime.emitAppointmentEvent('invoice.generated', user.tenantId, dto.branchId, invoice);

    await this.audit.log({
      tenantId: user.tenantId,
      branchId: dto.branchId,
      userId: user.userId,
      action: 'invoice.draft.created',
      entityType: 'invoice',
      entityId: invoice.id,
      newValuesJson: invoice
    });

    return invoice;
  }

  async payInvoice(user: AuthenticatedUser, invoiceId: string, dto: PayInvoiceDto) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId }
    });
    if (!invoice) throw new NotFoundException('Счет не найден');
    if (invoice.tenantId !== user.tenantId) throw new ForbiddenException();

    const updated = await this.prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.update({
        where: { id: invoiceId },
        data: { status: 'PAID' }
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
          status: 'COMPLETED'
        }
      });

      // If tied to an appointment, transition the appointment status to COMPLETED
      if (invoice.appointmentId) {
        const app = await tx.appointment.findUnique({ where: { id: invoice.appointmentId } });
        if (app && ['COMPLETED_PENDING_PAYMENT', 'CHECKED_IN', 'IN_PROGRESS'].includes(app.status)) {
          await tx.appointment.update({
            where: { id: invoice.appointmentId },
            data: { status: 'COMPLETED', completedAt: new Date() }
          });
          
          await tx.appointmentStatusHistory.create({
            data: {
              tenantId: user.tenantId,
              appointmentId: invoice.appointmentId,
              oldStatus: app.status,
              newStatus: 'COMPLETED',
              changedBy: user.userId,
              reason: 'Счет полностью оплачен'
            }
          });

          await tx.appointmentVisitState.create({
            data: {
              tenantId: user.tenantId,
              appointmentId: invoice.appointmentId,
              oldState: app.status,
              newState: 'COMPLETED',
              changedBy: user.userId,
              workstationType: 'RECEPTIONIST'
            }
          });
        }
      }

      return inv;
    });

    this.realtime.emitAppointmentEvent('payment.completed', user.tenantId, invoice.branchId, updated);
    
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
      newValuesJson: updated
    });

    return updated;
  }

  async fastBooking(user: AuthenticatedUser, dto: FastBookingDto) {
    const normPhone = this.normalizePhone(dto.phone);
    const phoneHash = this.hashPhone(normPhone);

    const contact = await this.prisma.patientContact.findFirst({
      where: { tenantId: user.tenantId, normalizedValueHash: phoneHash },
      include: { patient: true }
    });

    let patientId = contact?.patientId;

    if (!patientId) {
      const count = await this.prisma.patient.count({ where: { tenantId: user.tenantId } });
      const patientCode = `P-${String(count + 1).padStart(6, '0')}`;
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
                isPrimary: true
              }
            ]
          }
        }
      });
      patientId = newPatient.id;
    }

    const service = await this.prisma.service.findUnique({
      where: { id: dto.serviceId }
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
      notes: 'Быстрая запись через АРМ администратора'
    });

    // If booking contains a custom priority, update appointment priority
    if (dto.priority && dto.priority !== 'NORMAL') {
      await this.prisma.appointment.update({
        where: { id: app.id },
        data: { priority: dto.priority }
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
      newValuesJson: app
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
          include: { familyGroup: { include: { members: { include: { patient: true } } } } }
        },
        invoices: {
          where: { status: { in: ['DRAFT', 'PENDING_PAYMENT'] } },
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    });
    if (!patient) throw new NotFoundException('Пациент не найден');

    const recentAppointments = await this.prisma.appointment.findMany({
      where: { patientId, tenantId: user.tenantId },
      include: { service: true },
      orderBy: { startAt: 'desc' },
      take: 5
    });

    const debt = patient.invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
    const isVip = patient.tags.some(t => t.tag.code === 'VIP' || t.tag.name.toLowerCase() === 'vip');
    const age = patient.birthDate ? this.calculateAge(patient.birthDate) : null;
    const primaryPhone = patient.contacts.find(c => c.isPrimary)?.value || patient.contacts[0]?.value || null;

    const familyMembers = patient.familyMembers.flatMap(fm =>
      fm.familyGroup.members
        .filter(m => m.patientId !== patientId)
        .map(m => ({
          id: m.patient.id,
          name: m.patient.fullName,
          relation: fm.relationType
        }))
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
      tags: patient.tags.map(t => ({ id: t.tag.id, name: t.tag.name, color: t.tag.color })),
      metrics: patient.metrics ? {
        totalVisits: patient.metrics.totalVisits,
        totalRevenue: Number(patient.metrics.totalRevenue),
        ltv: Number(patient.metrics.ltv),
        averageCheck: Number(patient.metrics.averageCheck),
        retentionScore: patient.metrics.retentionScore
      } : null,
      familyMembers,
      recentAppointments: recentAppointments.map(a => ({
        id: a.id,
        date: a.startAt.toISOString(),
        service: a.service?.name ?? 'Без услуги',
        status: a.status
      }))
    };
  }

  async recalculateMetrics(tenantId: string, patientId: string) {
    const appointments = await this.prisma.appointment.findMany({
      where: { tenantId, patientId }
    });

    const completed = appointments.filter(a => a.status === 'COMPLETED');
    const cancellations = appointments.filter(a => a.status === 'CANCELLED').length;
    const missed = appointments.filter(a => a.status === 'NO_SHOW').length;
    const totalVisits = completed.length;

    const invoices = await this.prisma.invoice.findMany({
      where: { tenantId, patientId, status: 'PAID' }
    });
    const totalRevenue = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
    const averageCheck = totalVisits > 0 ? totalRevenue / totalVisits : 0;

    const lastVisit = completed.length > 0
      ? new Date(Math.max(...completed.map(c => c.startAt.getTime())))
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
        lastVisitAt: lastVisit
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
        lastVisitAt: lastVisit
      }
    });
  }
}
