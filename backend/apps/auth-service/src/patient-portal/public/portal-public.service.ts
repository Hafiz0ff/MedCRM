import { PrismaService } from '@core/database/prisma.service';
import { Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class PortalPublicService {
  constructor(private readonly prisma: PrismaService) {}

  async getClinics() {
    const tenants = await this.prisma.tenant.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        code: true,
        name: true,
        createdAt: true,
        // Typically a clinic might have a logo or address fields in a real schema,
        // we return safe basic fields for the directory.
      },
      orderBy: { name: 'asc' },
    });

    return { clinics: tenants };
  }

  async getClinicByCode(tenantCode: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { code: tenantCode, status: 'ACTIVE' },
    });

    if (!tenant) throw new NotFoundException('Clinic not found');

    // Also fetch branches for this clinic to show on public page
    const branches = await this.prisma.branch.findMany({
      where: { tenantId: tenant.id, status: 'active' },
      select: { id: true, name: true, address: true, phone: true, timezone: true },
    });

    return { clinic: tenant, branches };
  }

  async getDoctorsByClinic(tenantCode: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { code: tenantCode, status: 'ACTIVE' },
    });

    if (!tenant) throw new NotFoundException('Clinic not found');

    const doctors = await this.prisma.employee.findMany({
      where: {
        tenantId: tenant.id,
        status: 'ACTIVE',
        positions: { some: { activeTo: null } },
      },
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
        },
      },
    });

    return { doctors };
  }

  async getDoctorDetail(tenantCode: string, doctorId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { code: tenantCode, status: 'ACTIVE' },
    });

    if (!tenant) throw new NotFoundException('Clinic not found');

    const doctor = await this.prisma.employee.findFirst({
      where: {
        id: doctorId,
        tenantId: tenant.id,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        middleName: true,
        photoFileId: true,
        phone: true, // Only if public
        email: true,
        positions: {
          where: { activeTo: null },
          select: {
            specialty: { select: { id: true, name: true } },
            position: { select: { id: true, name: true } },
            branch: { select: { id: true, name: true, address: true } },
          },
        },
      },
    });

    if (!doctor) throw new NotFoundException('Doctor not found');

    return { doctor };
  }
}
