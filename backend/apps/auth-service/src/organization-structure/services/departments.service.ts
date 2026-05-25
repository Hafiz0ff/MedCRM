import { AuditLoggerService } from '@core/audit/audit-logger.service';
import { PrismaService } from '@core/database/prisma.service';
import { AuthenticatedUser } from '@core/security/jwt-payload';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DepartmentDto } from '../dto/organization-structure.schemas';

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLoggerService,
  ) {}

  async list(user: AuthenticatedUser) {
    return this.prisma.department.findMany({
      where: {
        tenantId: user.tenantId,
        branchId: { in: user.branchIds },
      },
      include: {
        parent: true,
        children: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async create(user: AuthenticatedUser, dto: DepartmentDto) {
    this.assertBranchAccess(user, dto.branchId);

    const department = await this.prisma.department.create({
      data: {
        tenantId: user.tenantId,
        branchId: dto.branchId,
        parentDepartmentId: dto.parentDepartmentId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        color: dto.color,
        isActive: dto.isActive,
      },
    });

    await this.audit.log({
      tenantId: user.tenantId,
      branchId: dto.branchId,
      userId: user.userId,
      action: 'department.created',
      entityType: 'department',
      entityId: department.id,
      newValuesJson: department,
    });

    return department;
  }

  async update(user: AuthenticatedUser, id: string, dto: DepartmentDto) {
    this.assertBranchAccess(user, dto.branchId);

    const current = await this.prisma.department.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!current) throw new NotFoundException('Department not found');

    const department = await this.prisma.department.update({
      where: { id },
      data: {
        branchId: dto.branchId,
        parentDepartmentId: dto.parentDepartmentId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        color: dto.color,
        isActive: dto.isActive,
      },
    });

    await this.audit.log({
      tenantId: user.tenantId,
      branchId: dto.branchId,
      userId: user.userId,
      action: 'department.updated',
      entityType: 'department',
      entityId: department.id,
      oldValuesJson: current,
      newValuesJson: department,
    });

    return department;
  }

  async delete(user: AuthenticatedUser, id: string) {
    const department = await this.prisma.department.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!department) throw new NotFoundException('Department not found');

    this.assertBranchAccess(user, department.branchId);

    await this.prisma.department.delete({ where: { id } });

    await this.audit.log({
      tenantId: user.tenantId,
      branchId: department.branchId,
      userId: user.userId,
      action: 'department.deleted',
      entityType: 'department',
      entityId: department.id,
    });

    return { success: true };
  }

  private assertBranchAccess(user: AuthenticatedUser, branchId: string): void {
    if (!user.branchIds.includes(branchId)) {
      throw new ForbiddenException('Branch access denied');
    }
  }
}
