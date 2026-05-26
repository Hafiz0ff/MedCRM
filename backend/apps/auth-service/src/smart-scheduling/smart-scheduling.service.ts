import { PrismaService } from '@core/database/prisma.service';
import { AuthenticatedUser } from '@core/security/jwt-payload';
import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class SmartSchedulingService {
  constructor(
    @Inject('SCHEDULING_SERVICE') private readonly client: ClientProxy,
    private readonly prisma: PrismaService,
  ) {}

  private async enrichAppointments(tenantId: string, appointments: any[]): Promise<any[]> {
    const patientIds = Array.from(
      new Set(appointments.map((a) => a.patientId).filter(Boolean)),
    ) as string[];
    const serviceIds = Array.from(
      new Set(appointments.map((a) => a.serviceId).filter(Boolean)),
    ) as string[];
    const employeeIds = Array.from(
      new Set(appointments.map((a) => a.employeeId).filter(Boolean)),
    ) as string[];

    const [patients, services, employees] = await Promise.all([
      patientIds.length > 0
        ? this.prisma.patient.findMany({ where: { tenantId, id: { in: patientIds } } })
        : [],
      serviceIds.length > 0
        ? this.prisma.service.findMany({ where: { tenantId, id: { in: serviceIds } } })
        : [],
      employeeIds.length > 0
        ? this.prisma.employee.findMany({ where: { tenantId, id: { in: employeeIds } } })
        : [],
    ]);

    const patientMap = new Map(patients.map((p) => [p.id, p]));
    const serviceMap = new Map(services.map((s) => [s.id, s]));
    const employeeMap = new Map(employees.map((e) => [e.id, e]));

    return appointments.map((a) => ({
      ...a,
      patient: a.patientId ? patientMap.get(a.patientId) || null : null,
      service: a.serviceId ? serviceMap.get(a.serviceId) || null : null,
      employee: a.employeeId ? employeeMap.get(a.employeeId) || null : null,
    }));
  }

  private async enrichSingle(tenantId: string, appointment: any): Promise<any> {
    if (!appointment) return appointment;
    const enriched = await this.enrichAppointments(tenantId, [appointment]);
    return enriched[0];
  }

  async list(user: AuthenticatedUser, query: any): Promise<any> {
    const res = await firstValueFrom(this.client.send('scheduling.list', { user, query }));
    if (res && res.items && res.items.length > 0) {
      res.items = await this.enrichAppointments(user.tenantId, res.items);
    }
    return res;
  }

  async create(user: AuthenticatedUser, dto: any): Promise<any> {
    const res = await firstValueFrom(this.client.send('scheduling.create', { user, dto }));
    return this.enrichSingle(user.tenantId, res);
  }

  async update(user: AuthenticatedUser, id: string, dto: any): Promise<any> {
    const res = await firstValueFrom(this.client.send('scheduling.update', { user, id, dto }));
    return this.enrichSingle(user.tenantId, res);
  }

  async transition(
    user: AuthenticatedUser,
    id: string,
    status: string,
    reason?: string,
  ): Promise<any> {
    const res = await firstValueFrom(
      this.client.send('scheduling.transition', { user, id, status, reason }),
    );
    return this.enrichSingle(user.tenantId, res);
  }

  async availability(user: AuthenticatedUser, query: any): Promise<any> {
    return firstValueFrom(this.client.send('scheduling.availability', { user, query }));
  }

  async reserveSlot(user: AuthenticatedUser, dto: any): Promise<any> {
    return firstValueFrom(this.client.send('scheduling.reserveSlot', { user, dto }));
  }

  async getPublicSlots(user: AuthenticatedUser, query: any): Promise<any> {
    return firstValueFrom(this.client.send('scheduling.getPublicSlots', { user, query }));
  }

  async onlineBookingReserve(user: AuthenticatedUser, dto: any): Promise<any> {
    return firstValueFrom(this.client.send('scheduling.onlineBookingReserve', { user, dto }));
  }

  async onlineBookingConfirm(user: AuthenticatedUser, dto: any): Promise<any> {
    return firstValueFrom(this.client.send('scheduling.onlineBookingConfirm', { user, dto }));
  }

  async reschedule(user: AuthenticatedUser, id: string, dto: any): Promise<any> {
    const res = await firstValueFrom(this.client.send('scheduling.reschedule', { user, id, dto }));
    return this.enrichSingle(user.tenantId, res);
  }

  async createRecurring(user: AuthenticatedUser, dto: any): Promise<any> {
    const res = await firstValueFrom(this.client.send('scheduling.createRecurring', { user, dto }));
    if (res && res.appointments && res.appointments.length > 0) {
      res.appointments = await this.enrichAppointments(user.tenantId, res.appointments);
    }
    return res;
  }

  async getWeekAvailability(user: AuthenticatedUser, query: any): Promise<any> {
    return firstValueFrom(this.client.send('scheduling.getWeekAvailability', { user, query }));
  }

  async getRoomUtilization(user: AuthenticatedUser, query: any): Promise<any> {
    return firstValueFrom(this.client.send('scheduling.getRoomUtilization', { user, query }));
  }

  // Waiting list
  async listWaitingList(user: AuthenticatedUser): Promise<any> {
    return firstValueFrom(this.client.send('scheduling.listWaitingList', { user }));
  }

  async createWaitingList(user: AuthenticatedUser, dto: any): Promise<any> {
    return firstValueFrom(this.client.send('scheduling.createWaitingList', { user, dto }));
  }

  async updateWaitingList(user: AuthenticatedUser, id: string, dto: any): Promise<any> {
    return firstValueFrom(this.client.send('scheduling.updateWaitingList', { user, id, dto }));
  }

  async deleteWaitingList(user: AuthenticatedUser, id: string): Promise<any> {
    return firstValueFrom(this.client.send('scheduling.deleteWaitingList', { user, id }));
  }

  // Resource buffers
  async listResourceBuffers(user: AuthenticatedUser): Promise<any> {
    return firstValueFrom(this.client.send('scheduling.listResourceBuffers', { user }));
  }

  async upsertResourceBuffer(user: AuthenticatedUser, dto: any): Promise<any> {
    return firstValueFrom(this.client.send('scheduling.upsertResourceBuffer', { user, dto }));
  }

  async deleteResourceBuffer(user: AuthenticatedUser, id: string): Promise<any> {
    return firstValueFrom(this.client.send('scheduling.deleteResourceBuffer', { user, id }));
  }

  async getDoctors(user: AuthenticatedUser): Promise<any[]> {
    const employees = await this.prisma.employee.findMany({
      where: { tenantId: user.tenantId, status: 'ACTIVE' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        middleName: true,
        photoFileId: true,
        positions: {
          where: { activeTo: null },
          select: {
            specialty: { select: { id: true, name: true } },
            position: { select: { id: true, name: true } },
          },
          take: 1,
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    return employees.map((emp) => {
      const primary = emp.positions[0];
      return {
        id: emp.id,
        name: `${emp.lastName} ${emp.firstName}${emp.middleName ? ` ${emp.middleName}` : ''}`,
        role: primary?.specialty?.name ?? primary?.position?.name ?? 'Врач',
        photoFileId: emp.photoFileId,
      };
    });
  }

  async getServices(user: AuthenticatedUser): Promise<any[]> {
    return this.prisma.service.findMany({
      where: { tenantId: user.tenantId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }
}
