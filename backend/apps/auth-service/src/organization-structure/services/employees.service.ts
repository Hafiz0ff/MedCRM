import { AuditLoggerService } from '@core/audit/audit-logger.service';
import { PrismaService } from '@core/database/prisma.service';
import { AuthenticatedUser } from '@core/security/jwt-payload';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EmployeeDto, EmployeePositionDto } from '../dto/organization-structure.schemas';

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLoggerService,
  ) {}

  async list(user: AuthenticatedUser, branchId?: string) {
    if (branchId) this.assertBranchAccess(user, branchId);

    return this.prisma.employee.findMany({
      where: {
        tenantId: user.tenantId,
        positions: branchId
          ? { some: { branchId } }
          : { some: { branchId: { in: user.branchIds } } },
      },
      include: {
        positions: {
          include: {
            branch: true,
            department: true,
            position: true,
            specialty: true,
          },
        },
      },
      orderBy: { lastName: 'asc' },
    });
  }

  async get(user: AuthenticatedUser, id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        positions: {
          include: {
            branch: true,
            department: true,
            position: true,
            specialty: true,
          },
        },
      },
    });

    if (!employee) throw new NotFoundException('Employee not found');

    // Check if user has access to at least one branch of the employee
    const hasBranchAccess =
      employee.positions.length === 0 ||
      employee.positions.some((pos) => user.branchIds.includes(pos.branchId));
    if (!hasBranchAccess) throw new ForbiddenException('Access to this employee profile is denied');

    return employee;
  }

  async create(user: AuthenticatedUser, dto: EmployeeDto) {
    const employee = await this.prisma.employee.create({
      data: {
        tenantId: user.tenantId,
        userId: dto.userId,
        employeeNumber: dto.employeeNumber,
        firstName: dto.firstName,
        lastName: dto.lastName,
        middleName: dto.middleName,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
        gender: dto.gender,
        phone: dto.phone,
        email: dto.email || null,
        hireDate: new Date(dto.hireDate),
        dismissalDate: dto.dismissalDate ? new Date(dto.dismissalDate) : null,
        employmentType: dto.employmentType,
        photoFileId: dto.photoFileId,
        status: dto.status,
      },
    });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'employee.created',
      entityType: 'employee',
      entityId: employee.id,
      newValuesJson: employee,
    });

    return employee;
  }

  async update(user: AuthenticatedUser, id: string, dto: EmployeeDto) {
    const current = await this.get(user, id);

    const employee = await this.prisma.employee.update({
      where: { id },
      data: {
        userId: dto.userId,
        employeeNumber: dto.employeeNumber,
        firstName: dto.firstName,
        lastName: dto.lastName,
        middleName: dto.middleName,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
        gender: dto.gender,
        phone: dto.phone,
        email: dto.email || null,
        hireDate: new Date(dto.hireDate),
        dismissalDate: dto.dismissalDate ? new Date(dto.dismissalDate) : null,
        employmentType: dto.employmentType,
        photoFileId: dto.photoFileId,
        status: dto.status,
      },
    });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'employee.updated',
      entityType: 'employee',
      entityId: employee.id,
      oldValuesJson: current,
      newValuesJson: employee,
    });

    return employee;
  }

  async delete(user: AuthenticatedUser, id: string) {
    const employee = await this.get(user, id);

    await this.prisma.employee.delete({ where: { id } });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'employee.deleted',
      entityType: 'employee',
      entityId: employee.id,
    });

    return { success: true };
  }

  // Job Assignments (EmployeePosition)
  async listPositions(user: AuthenticatedUser, employeeId: string) {
    await this.get(user, employeeId); // Asserts access

    return this.prisma.employeePosition.findMany({
      where: { tenantId: user.tenantId, employeeId },
      include: {
        branch: true,
        department: true,
        position: true,
        specialty: true,
      },
    });
  }

  async assignPosition(user: AuthenticatedUser, dto: EmployeePositionDto) {
    await this.get(user, dto.employeeId); // Asserts access
    this.assertBranchAccess(user, dto.branchId);

    const assignment = await this.prisma.employeePosition.create({
      data: {
        tenantId: user.tenantId,
        employeeId: dto.employeeId,
        branchId: dto.branchId,
        departmentId: dto.departmentId,
        positionId: dto.positionId,
        specialtyId: dto.specialtyId,
        rate: dto.rate,
        workRate: dto.workRate,
        isPrimary: dto.isPrimary,
        activeFrom: dto.activeFrom ? new Date(dto.activeFrom) : undefined,
        activeTo: dto.activeTo ? new Date(dto.activeTo) : null,
      },
    });

    await this.audit.log({
      tenantId: user.tenantId,
      branchId: dto.branchId,
      userId: user.userId,
      action: 'employee.position.assigned',
      entityType: 'employee_position',
      entityId: assignment.id,
      newValuesJson: assignment,
    });

    return assignment;
  }

  async removePosition(user: AuthenticatedUser, positionAssignmentId: string) {
    const current = await this.prisma.employeePosition.findFirst({
      where: { id: positionAssignmentId, tenantId: user.tenantId },
    });
    if (!current) throw new NotFoundException('Assignment not found');

    this.assertBranchAccess(user, current.branchId);

    await this.prisma.employeePosition.delete({ where: { id: positionAssignmentId } });

    await this.audit.log({
      tenantId: user.tenantId,
      branchId: current.branchId,
      userId: user.userId,
      action: 'employee.position.removed',
      entityType: 'employee_position',
      entityId: positionAssignmentId,
    });

    return { success: true };
  }

  private assertBranchAccess(user: AuthenticatedUser, branchId: string): void {
    if (!user.branchIds.includes(branchId)) {
      throw new ForbiddenException('Branch access denied');
    }
  }
}
