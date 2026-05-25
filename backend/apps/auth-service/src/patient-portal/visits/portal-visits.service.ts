import { PrismaService } from '@core/database/prisma.service';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedPortalUser } from '../auth/patient-jwt-payload';

@Injectable()
export class PortalVisitsService {
  constructor(private readonly prisma: PrismaService) {}

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
      this.prisma.appointment.findMany({
        where: whereClause,
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true, middleName: true },
          },
          service: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true, address: true } },
        },
        orderBy: { startAt: 'desc' },
        skip,
        take: safeLimit,
      }),
      this.prisma.appointment.count({ where: whereClause }),
    ]);

    return {
      visits,
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

    const appointment = await this.prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        tenantId: tenant.id,
        patientId: grant.patientId,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            middleName: true,
            photoFileId: true,
          },
        },
        service: {
          select: { id: true, name: true, durationMinutes: true, basePrice: true },
        },
        branch: { select: { id: true, name: true, address: true, phone: true } },
        statusHistory: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!appointment) throw new NotFoundException('Appointment not found');
    return appointment;
  }
}
