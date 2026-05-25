import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { AuditLoggerService } from '@core/audit/audit-logger.service';
import { AuthenticatedUser } from '@core/security/jwt-payload';
import { RealtimeGateway } from '../smart-scheduling/realtime.gateway';
import { SessionInvalidatorService } from './session-invalidator.service';
import {
  AssignUserRolesDto,
  CreateRoleDto,
  SetRolePermissionsDto,
  UpdateRoleDto
} from './dto/role-management.dto';

/**
 * Manages tenant-scoped roles, their permission bindings, and user→role
 * assignments per branch. Mutations to a user's roles trigger immediate
 * session invalidation so the new policy applies on the next request.
 */
@Injectable()
export class RoleManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLoggerService,
    private readonly realtime: RealtimeGateway,
    private readonly sessions: SessionInvalidatorService
  ) {}

  async listPermissions() {
    const permissions = await this.prisma.permission.findMany({
      include: { module: true },
      orderBy: [{ moduleCode: 'asc' }, { code: 'asc' }]
    });
    return permissions.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description,
      moduleCode: p.moduleCode,
      moduleName: p.module?.name ?? null
    }));
  }

  async listRoles(user: AuthenticatedUser) {
    const roles = await this.prisma.role.findMany({
      where: {
        OR: [{ tenantId: user.tenantId }, { tenantId: null, isSystem: true }]
      },
      include: { permissions: { include: { permission: true } } },
      orderBy: [{ isSystem: 'desc' }, { code: 'asc' }]
    });
    return roles.map((role) => ({
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      tenantId: role.tenantId,
      permissions: role.permissions.map((rp) => rp.permission.code)
    }));
  }

  async createRole(user: AuthenticatedUser, dto: CreateRoleDto) {
    const existing = await this.prisma.role.findUnique({
      where: { tenantId_code: { tenantId: user.tenantId, code: dto.code } }
    });
    if (existing) {
      throw new ConflictException(`Role with code "${dto.code}" already exists`);
    }

    const role = await this.prisma.role.create({
      data: {
        tenantId: user.tenantId,
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
        isSystem: false
      }
    });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'system.role.created',
      entityType: 'role',
      entityId: role.id,
      newValuesJson: { code: role.code, name: role.name, description: role.description }
    });

    this.realtime.emitTenantSystemEvent('tenant.role.created', user.tenantId, {
      tenantId: user.tenantId,
      role: { id: role.id, code: role.code, name: role.name }
    });

    return role;
  }

  async updateRole(user: AuthenticatedUser, roleId: string, dto: UpdateRoleDto) {
    const existing = await this.assertWritableRole(user.tenantId, roleId);

    const updated = await this.prisma.role.update({
      where: { id: roleId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {})
      }
    });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'system.role.updated',
      entityType: 'role',
      entityId: roleId,
      oldValuesJson: { name: existing.name, description: existing.description },
      newValuesJson: { name: updated.name, description: updated.description }
    });

    return updated;
  }

  async deleteRole(user: AuthenticatedUser, roleId: string) {
    const existing = await this.assertWritableRole(user.tenantId, roleId);

    const inUse = await this.prisma.userBranchRole.count({
      where: { roleId, tenantId: user.tenantId, activeTo: null }
    });
    if (inUse > 0) {
      throw new ConflictException(
        `Role is assigned to ${inUse} active user(s); reassign them before deletion`
      );
    }

    await this.prisma.rolePermission.deleteMany({ where: { roleId } });
    await this.prisma.role.delete({ where: { id: roleId } });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'system.role.deleted',
      entityType: 'role',
      entityId: roleId,
      oldValuesJson: { code: existing.code, name: existing.name }
    });

    return { ok: true };
  }

  async setRolePermissions(
    user: AuthenticatedUser,
    roleId: string,
    dto: SetRolePermissionsDto
  ) {
    const role = await this.assertWritableRole(user.tenantId, roleId);

    const permissions = await this.prisma.permission.findMany({
      where: { code: { in: dto.permissionCodes } }
    });
    const foundCodes = new Set(permissions.map((p) => p.code));
    const unknown = dto.permissionCodes.filter((code) => !foundCodes.has(code));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Unknown permission codes: ${unknown.join(', ')}`
      );
    }

    const existing = await this.prisma.rolePermission.findMany({
      where: { roleId },
      include: { permission: true }
    });
    const oldCodes = existing.map((rp) => rp.permission.code).sort();

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId } }),
      this.prisma.rolePermission.createMany({
        data: permissions.map((p) => ({ roleId, permissionId: p.id })),
        skipDuplicates: true
      })
    ]);

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'system.role.permissions.updated',
      entityType: 'role',
      entityId: roleId,
      oldValuesJson: { permissions: oldCodes },
      newValuesJson: { permissions: dto.permissionCodes.slice().sort() }
    });

    // Revoke sessions for all users currently holding this role; their JWTs
    // carry stale permissions and must be re-issued.
    const affectedUsers = await this.prisma.userBranchRole.findMany({
      where: { roleId, tenantId: user.tenantId, activeTo: null },
      select: { userId: true },
      distinct: ['userId']
    });

    let totalRevoked = 0;
    for (const { userId } of affectedUsers) {
      const result = await this.sessions.revokeAllSessionsForUser(userId, user.tenantId, {
        reason: 'rbac.role.permissions.changed'
      });
      totalRevoked += result.count;
    }

    this.realtime.emitTenantSystemEvent('tenant.role.permissions.updated', user.tenantId, {
      tenantId: user.tenantId,
      roleId,
      roleCode: role.code,
      permissions: dto.permissionCodes,
      affectedUserCount: affectedUsers.length,
      revokedSessionCount: totalRevoked
    });

    return {
      roleId,
      permissions: dto.permissionCodes,
      affectedUserCount: affectedUsers.length,
      revokedSessionCount: totalRevoked
    };
  }

  /**
   * Lightweight list of tenant users with the count of their active role
   * assignments — used by the settings UI to pick a user to manage.
   */
  async listTenantUsers(user: AuthenticatedUser) {
    const users = await this.prisma.user.findMany({
      where: { tenantId: user.tenantId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        lastLoginAt: true,
        branchRoles: {
          where: { tenantId: user.tenantId, activeTo: null },
          select: {
            isPrimary: true,
            role: { select: { id: true, code: true, name: true } },
            branch: { select: { id: true, code: true, name: true } }
          }
        }
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      status: u.status,
      lastLoginAt: u.lastLoginAt,
      activeAssignmentCount: u.branchRoles.length,
      primaryRole:
        u.branchRoles.find((r) => r.isPrimary)?.role.name ??
        u.branchRoles[0]?.role.name ??
        null,
      branches: Array.from(
        new Map(
          u.branchRoles.map((r) => [
            r.branch.id,
            { id: r.branch.id, code: r.branch.code, name: r.branch.name }
          ])
        ).values()
      )
    }));
  }

  async listUserRoles(user: AuthenticatedUser, targetUserId: string) {
    const target = await this.assertUserBelongsToTenant(user.tenantId, targetUserId);
    const assignments = await this.prisma.userBranchRole.findMany({
      where: { userId: targetUserId, tenantId: user.tenantId, activeTo: null },
      include: {
        role: true,
        branch: { select: { id: true, code: true, name: true } }
      },
      orderBy: { createdAt: 'asc' }
    });

    return {
      userId: target.id,
      email: target.email,
      assignments: assignments.map((a) => ({
        id: a.id,
        branchId: a.branchId,
        branchCode: a.branch.code,
        branchName: a.branch.name,
        roleId: a.roleId,
        roleCode: a.role.code,
        roleName: a.role.name,
        isPrimary: a.isPrimary,
        activeFrom: a.activeFrom
      }))
    };
  }

  async assignUserRoles(
    user: AuthenticatedUser,
    targetUserId: string,
    dto: AssignUserRolesDto
  ) {
    if (targetUserId === user.userId) {
      // Prevent the manager from accidentally locking themselves out by
      // removing their own administrative roles in a single operation.
      const wouldLoseRoles = dto.assignments.length === 0;
      if (wouldLoseRoles) {
        throw new ForbiddenException(
          'You cannot remove all of your own role assignments'
        );
      }
    }

    await this.assertUserBelongsToTenant(user.tenantId, targetUserId);

    const branches = await this.prisma.branch.findMany({
      where: { tenantId: user.tenantId, id: { in: dto.assignments.map((a) => a.branchId) } }
    });
    if (branches.length !== new Set(dto.assignments.map((a) => a.branchId)).size) {
      throw new BadRequestException('One or more branches do not belong to this tenant');
    }

    const roles = await this.prisma.role.findMany({
      where: {
        id: { in: dto.assignments.map((a) => a.roleId) },
        OR: [{ tenantId: user.tenantId }, { tenantId: null, isSystem: true }]
      }
    });
    if (roles.length !== new Set(dto.assignments.map((a) => a.roleId)).size) {
      throw new BadRequestException('One or more roles do not belong to this tenant');
    }

    const previous = await this.prisma.userBranchRole.findMany({
      where: { userId: targetUserId, tenantId: user.tenantId, activeTo: null }
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.userBranchRole.updateMany({
        where: { userId: targetUserId, tenantId: user.tenantId, activeTo: null },
        data: { activeTo: new Date() }
      });
      if (dto.assignments.length > 0) {
        await tx.userBranchRole.createMany({
          data: dto.assignments.map((a) => ({
            userId: targetUserId,
            tenantId: user.tenantId,
            branchId: a.branchId,
            roleId: a.roleId,
            isPrimary: a.isPrimary ?? false
          }))
        });
      }
    });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'system.user.roles.updated',
      entityType: 'user',
      entityId: targetUserId,
      oldValuesJson: {
        assignments: previous.map((p) => ({
          branchId: p.branchId,
          roleId: p.roleId,
          isPrimary: p.isPrimary
        }))
      },
      newValuesJson: { assignments: dto.assignments }
    });

    const revocation = await this.sessions.revokeAllSessionsForUser(
      targetUserId,
      user.tenantId,
      { reason: 'rbac.user.roles.changed' }
    );

    this.realtime.emitTenantSystemEvent('tenant.user.roles.updated', user.tenantId, {
      tenantId: user.tenantId,
      userId: targetUserId,
      revokedSessionCount: revocation.count
    });

    return {
      userId: targetUserId,
      assignments: dto.assignments,
      revokedSessionCount: revocation.count
    };
  }

  private async assertWritableRole(tenantId: string, roleId: string) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    if (role.tenantId !== tenantId) {
      throw new ForbiddenException('Role belongs to a different tenant');
    }
    if (role.isSystem) {
      throw new ForbiddenException('System roles cannot be modified');
    }
    return role;
  }

  private async assertUserBelongsToTenant(tenantId: string, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.tenantId !== tenantId) {
      throw new ForbiddenException('User belongs to a different tenant');
    }
    return user;
  }
}
