import { PrismaService } from '@core/database/prisma.service';
import { SchedulingPrismaService } from '@core/database/scheduling-prisma.service';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SmartSchedulingService } from '../../smart-scheduling/smart-scheduling.service';
import type { AuthenticatedPortalUser } from '../auth/patient-jwt-payload';
import type {
  PortalSlotsQueryDto,
  PortalReserveSlotDto,
  PortalConfirmBookingDto,
  PortalCancelBookingDto,
  PortalDoctorsQueryDto,
  PortalSpecialtiesQueryDto,
} from '../dto/portal-booking.dto';

@Injectable()
export class PortalBookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schedulingPrisma: SchedulingPrismaService,
    private readonly scheduling: SmartSchedulingService,
  ) {}

  /**
   * Resolve tenant by code and verify that the portal account has an active
   * PatientPortalGrant for that tenant. Returns both tenant and grant.
   */
  private async resolveGrant(accountId: string, tenantCode: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { code: tenantCode } });
    if (!tenant) throw new NotFoundException('Clinic not found');

    const grant = await this.prisma.patientPortalGrant.findFirst({
      where: { accountId, tenantId: tenant.id, state: 'ACTIVE' },
    });
    if (!grant) throw new ForbiddenException('You are not connected to this clinic');

    return { tenant, grant };
  }

  /**
   * Build a synthetic AuthenticatedUser object that SmartSchedulingService
   * expects. Portal requests always have a single branchId scope.
   */
  private buildInternalUser(tenantId: string, branchId: string) {
    return {
      userId: 'portal-system',
      tenantId,
      branchIds: [branchId],
      role: 'PORTAL_PATIENT' as any,
      permissions: ['scheduling.availability.read', 'scheduling.appointments.create'],
    };
  }

  async getSpecialties(portalUser: AuthenticatedPortalUser, dto: PortalSpecialtiesQueryDto) {
    const { tenant } = await this.resolveGrant(portalUser.accountId, dto.tenantCode);

    const services = await this.prisma.service.findMany({
      where: { tenantId: tenant.id, isActive: true, isOnlineBookable: true },
      select: {
        id: true,
        name: true,
        code: true,
        durationMinutes: true,
        basePrice: true,
      },
      orderBy: { name: 'asc' },
    });

    return { services };
  }

  async getDoctors(portalUser: AuthenticatedPortalUser, dto: PortalDoctorsQueryDto) {
    const { tenant } = await this.resolveGrant(portalUser.accountId, dto.tenantCode);

    const where: any = {
      tenantId: tenant.id,
      status: 'ACTIVE',
      positions: {
        some: {
          branchId: dto.branchId,
          activeTo: null,
          ...(dto.specialtyId ? { specialtyId: dto.specialtyId } : {}),
        },
      },
    };

    const employees = await this.prisma.employee.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        middleName: true,
        photoFileId: true,
        positions: {
          where: { branchId: dto.branchId, activeTo: null },
          select: {
            specialty: { select: { id: true, name: true } },
            position: { select: { id: true, name: true } },
          },
          take: 1,
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    return {
      doctors: employees.map((emp) => {
        const primary = emp.positions[0];
        return {
          id: emp.id,
          name: `${emp.lastName} ${emp.firstName}${emp.middleName ? ` ${emp.middleName}` : ''}`,
          photoFileId: emp.photoFileId,
          specialty: primary?.specialty ?? null,
          position: primary?.position ?? null,
        };
      }),
    };
  }

  async getSlots(portalUser: AuthenticatedPortalUser, dto: PortalSlotsQueryDto) {
    const { tenant } = await this.resolveGrant(portalUser.accountId, dto.tenantCode);
    const internalUser = this.buildInternalUser(tenant.id, dto.branchId);

    return this.scheduling.getPublicSlots(internalUser as any, {
      branchId: dto.branchId,
      employeeId: dto.employeeId,
      serviceId: dto.serviceId,
      date: dto.date,
    });
  }

  async reserveSlot(portalUser: AuthenticatedPortalUser, dto: PortalReserveSlotDto) {
    const { tenant, grant } = await this.resolveGrant(portalUser.accountId, dto.tenantCode);
    const internalUser = this.buildInternalUser(tenant.id, dto.branchId);

    return this.scheduling.onlineBookingReserve(internalUser as any, {
      branchId: dto.branchId,
      employeeId: dto.employeeId,
      serviceId: dto.serviceId,
      startAt: dto.startAt,
      endAt: dto.endAt,
      patientId: grant.patientId,
    });
  }

  async confirmBooking(portalUser: AuthenticatedPortalUser, dto: PortalConfirmBookingDto) {
    const { tenant } = await this.resolveGrant(portalUser.accountId, dto.tenantCode);

    // onlineBookingConfirm needs branchId in the internal user but the branch
    // is encoded inside the reservation's slotKey, so we pass an empty-array
    // user — the service resolves it from the token+reservation data.
    const internalUser = {
      userId: 'portal-system',
      tenantId: tenant.id,
      branchIds: [] as string[],
      role: 'PORTAL_PATIENT' as any,
      permissions: ['scheduling.appointments.create'],
    };

    return this.scheduling.onlineBookingConfirm(internalUser as any, {
      token: dto.token,
      code: dto.code,
    });
  }

  async cancelBooking(portalUser: AuthenticatedPortalUser, dto: PortalCancelBookingDto) {
    const { tenant, grant } = await this.resolveGrant(portalUser.accountId, dto.tenantCode);

    const appointment = await this.schedulingPrisma.appointment.findFirst({
      where: {
        id: dto.appointmentId,
        tenantId: tenant.id,
        patientId: grant.patientId,
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found or cannot be cancelled');
    }

    // Enforce 2-hour cancellation window
    const twoHoursMs = 2 * 60 * 60 * 1000;
    if (appointment.startAt.getTime() - Date.now() < twoHoursMs) {
      throw new BadRequestException(
        'Cannot cancel appointment less than 2 hours before start time',
      );
    }

    await this.schedulingPrisma.$transaction(async (tx) => {
      await tx.appointment.update({
        where: { id: dto.appointmentId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancellationReason: dto.reason ?? 'Cancelled by patient via portal',
        },
      });
      await tx.appointmentStatusHistory.create({
        data: {
          tenantId: tenant.id,
          appointmentId: dto.appointmentId,
          oldStatus: appointment.status,
          newStatus: 'CANCELLED',
          // changedBy is @db.Uuid — store the portal accountId (which is a UUID)
          changedBy: portalUser.accountId,
          reason: dto.reason ?? 'Cancelled by patient via portal',
        },
      });
    });

    return { success: true, message: 'Appointment cancelled successfully' };
  }

  async getUpcomingAppointments(portalUser: AuthenticatedPortalUser, tenantCode: string) {
    const { tenant, grant } = await this.resolveGrant(portalUser.accountId, tenantCode);

    const appointments = await this.schedulingPrisma.appointment.findMany({
      where: {
        tenantId: tenant.id,
        patientId: grant.patientId,
        startAt: { gte: new Date() },
        status: { in: ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN'] },
      },
      orderBy: { startAt: 'asc' },
      take: 20,
    });

    if (appointments.length === 0) return [];

    const employeeIds = Array.from(new Set(appointments.map((a) => a.employeeId)));
    const serviceIds = Array.from(
      new Set(appointments.map((a) => a.serviceId).filter(Boolean)),
    ) as string[];
    const branchIds = Array.from(new Set(appointments.map((a) => a.branchId)));

    const [employees, services, branches] = await Promise.all([
      this.prisma.employee.findMany({
        where: { id: { in: employeeIds } },
        select: { id: true, firstName: true, lastName: true, middleName: true },
      }),
      serviceIds.length > 0
        ? this.prisma.service.findMany({
            where: { id: { in: serviceIds } },
            select: { id: true, name: true, durationMinutes: true },
          })
        : [],
      this.prisma.branch.findMany({
        where: { id: { in: branchIds } },
        select: { id: true, name: true, address: true },
      }),
    ]);

    const employeeMap = new Map(employees.map((e) => [e.id, e]));
    const serviceMap = new Map(services.map((s) => [s.id, s]));
    const branchMap = new Map(branches.map((b) => [b.id, b]));

    return appointments.map((a) => ({
      ...a,
      employee: employeeMap.get(a.employeeId) || null,
      service: a.serviceId ? serviceMap.get(a.serviceId) || null : null,
      branch: branchMap.get(a.branchId) || null,
    }));
  }
}
