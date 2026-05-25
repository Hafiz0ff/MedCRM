import { AuditLoggerService } from '@core/audit/audit-logger.service';
import { PrismaService } from '@core/database/prisma.service';
import { AuthenticatedUser } from '@core/security/jwt-payload';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BranchDto } from '../dto/organization-structure.schemas';

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLoggerService,
  ) {}

  async list(user: AuthenticatedUser) {
    return this.prisma.branch.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async create(user: AuthenticatedUser, dto: BranchDto) {
    const branch = await this.prisma.branch.create({
      data: {
        tenantId: user.tenantId,
        code: dto.code,
        name: dto.name,
        address: dto.address,
        phone: dto.phone,
        timezone: dto.timezone,
        status: dto.isActive ? 'active' : 'inactive',
      },
    });

    await this.audit.log({
      tenantId: user.tenantId,
      branchId: branch.id,
      userId: user.userId,
      action: 'branch.created',
      entityType: 'branch',
      entityId: branch.id,
      newValuesJson: branch,
    });

    return branch;
  }

  async update(user: AuthenticatedUser, id: string, dto: BranchDto) {
    const current = await this.prisma.branch.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!current) throw new NotFoundException('Branch not found');

    const branch = await this.prisma.branch.update({
      where: { id },
      data: {
        code: dto.code,
        name: dto.name,
        address: dto.address,
        phone: dto.phone,
        timezone: dto.timezone,
        status: dto.isActive ? 'active' : 'inactive',
      },
    });

    await this.audit.log({
      tenantId: user.tenantId,
      branchId: branch.id,
      userId: user.userId,
      action: 'branch.updated',
      entityType: 'branch',
      entityId: branch.id,
      oldValuesJson: current,
      newValuesJson: branch,
    });

    return branch;
  }

  async delete(user: AuthenticatedUser, id: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    await this.prisma.branch.delete({ where: { id } });

    await this.audit.log({
      tenantId: user.tenantId,
      branchId: branch.id,
      userId: user.userId,
      action: 'branch.deleted',
      entityType: 'branch',
      entityId: branch.id,
    });

    return { success: true };
  }
}
