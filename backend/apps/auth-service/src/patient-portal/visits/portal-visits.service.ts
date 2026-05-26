import { PrismaService } from '@core/database/prisma.service';
import { SchedulingPrismaService } from '@core/database/scheduling-prisma.service';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedPortalUser } from '../auth/patient-jwt-payload';

@Injectable()
export class PortalVisitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schedulingPrisma: SchedulingPrismaService,
  ) {}

  private async resolveGrant(accountId: string, tenantCode: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { code: tenantCode } });
    if (!tenant) throw new NotFoundException('Clinic not found');

    const grant = await this.prisma.patientPortalGrant.findFirst({
      where: { accountId, tenantId: tenant.id, state: 'ACTIVE' },
    });
    if (!grant) throw new ForbiddenException('You are not connected to this clinic');

    return { tenant, grant };
  }

  async getVisitsHistory(
    portalUser: AuthenticatedPortalUser,
    tenantCode: string,
    page = 1,
    limit = 20,
  ) {
    const { tenant, grant } = await this.resolveGrant(portalUser.accountId, tenantCode);
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 50);
    const skip = (safePage - 1) * safeLimit;

    const whereClause = {
      tenantId: tenant.id,
      patientId: grant.patientId,
      status: { in: ['COMPLETED', 'NO_SHOW', 'CANCELLED'] },
    };

    const [visits, total] = await Promise.all([
      this.schedulingPrisma.appointment.findMany({
        where: whereClause,
        orderBy: { startAt: 'desc' },
        skip,
        take: safeLimit,
      }),
      this.schedulingPrisma.appointment.count({ where: whereClause }),
    ]);

    if (visits.length === 0) {
      return {
        visits: [],
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: 0,
      };
    }

    const employeeIds = Array.from(new Set(visits.map((a) => a.employeeId)));
    const serviceIds = Array.from(
      new Set(visits.map((a) => a.serviceId).filter(Boolean)),
    ) as string[];
    const branchIds = Array.from(new Set(visits.map((a) => a.branchId)));

    const [employees, services, branches] = await Promise.all([
      this.prisma.employee.findMany({
        where: { id: { in: employeeIds } },
        select: { id: true, firstName: true, lastName: true, middleName: true },
      }),
      serviceIds.length > 0
        ? this.prisma.service.findMany({
            where: { id: { in: serviceIds } },
            select: { id: true, name: true },
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

    const enrichedVisits = visits.map((a) => ({
      ...a,
      employee: employeeMap.get(a.employeeId) || null,
      service: a.serviceId ? serviceMap.get(a.serviceId) || null : null,
      branch: branchMap.get(a.branchId) || null,
    }));

    return {
      visits: enrichedVisits,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  async getAppointmentDetail(
    portalUser: AuthenticatedPortalUser,
    tenantCode: string,
    appointmentId: string,
  ) {
    const { tenant, grant } = await this.resolveGrant(portalUser.accountId, tenantCode);

    const appointment = await this.schedulingPrisma.appointment.findFirst({
      where: {
        id: appointmentId,
        tenantId: tenant.id,
        patientId: grant.patientId,
      },
      include: {
        statusHistory: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!appointment) throw new NotFoundException('Appointment not found');

    const [employee, service, branch] = await Promise.all([
      this.prisma.employee.findFirst({
        where: { id: appointment.employeeId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          middleName: true,
          photoFileId: true,
        },
      }),
      appointment.serviceId
        ? this.prisma.service.findFirst({
            where: { id: appointment.serviceId },
            select: { id: true, name: true, durationMinutes: true, basePrice: true },
          })
        : null,
      this.prisma.branch.findFirst({
        where: { id: appointment.branchId },
        select: { id: true, name: true, address: true, phone: true },
      }),
    ]);

    return {
      ...appointment,
      employee,
      service,
      branch,
    };
  }
}
