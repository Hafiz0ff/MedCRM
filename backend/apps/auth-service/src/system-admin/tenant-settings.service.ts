import { AuditLoggerService } from '@core/audit/audit-logger.service';
import { PrismaService } from '@core/database/prisma.service';
import { AuthenticatedUser } from '@core/security/jwt-payload';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RealtimeGateway } from '../smart-scheduling/realtime.gateway';
import { UpdateTenantModuleDto, UpdateTenantProfileDto } from './dto/tenant-settings.dto';

/**
 * Tenant-scoped configuration: organisation profile (name/timezone/locale)
 * plus per-module feature-flag / configuration JSON. Every mutation is
 * audited and broadcast to the tenant Socket.IO room so connected clients
 * pick up new settings without a manual refresh.
 */
@Injectable()
export class TenantSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLoggerService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async getTenantProfile(user: AuthenticatedUser) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return {
      id: tenant.id,
      code: tenant.code,
      name: tenant.name,
      subscriptionPlan: tenant.subscriptionPlan,
      defaultLocale: tenant.defaultLocale,
      timezone: tenant.timezone,
      status: tenant.status,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }

  async updateTenantProfile(user: AuthenticatedUser, dto: UpdateTenantProfileDto) {
    const existing = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Tenant not found');
    }

    const updated = await this.prisma.tenant.update({
      where: { id: user.tenantId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.defaultLocale !== undefined ? { defaultLocale: dto.defaultLocale } : {}),
        ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
      },
    });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'system.tenant.profile.updated',
      entityType: 'tenant',
      entityId: user.tenantId,
      oldValuesJson: {
        name: existing.name,
        defaultLocale: existing.defaultLocale,
        timezone: existing.timezone,
      },
      newValuesJson: {
        name: updated.name,
        defaultLocale: updated.defaultLocale,
        timezone: updated.timezone,
      },
    });

    this.realtime.emitTenantSystemEvent('tenant.profile.updated', user.tenantId, {
      tenantId: user.tenantId,
      profile: {
        name: updated.name,
        defaultLocale: updated.defaultLocale,
        timezone: updated.timezone,
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      defaultLocale: updated.defaultLocale,
      timezone: updated.timezone,
      updatedAt: updated.updatedAt,
    };
  }

  async listTenantModules(user: AuthenticatedUser) {
    const rows = await this.prisma.tenantModule.findMany({
      where: { tenantId: user.tenantId },
      include: { module: true },
      orderBy: { module: { code: 'asc' } },
    });

    return rows.map((row) => ({
      moduleId: row.moduleId,
      moduleCode: row.module.code,
      moduleName: row.module.name,
      isCore: row.module.isCore,
      enabled: row.enabled,
      activatedAt: row.activatedAt,
      configuration: row.configurationJson ?? {},
    }));
  }

  async updateTenantModule(
    user: AuthenticatedUser,
    moduleCode: string,
    dto: UpdateTenantModuleDto,
  ) {
    const module = await this.prisma.systemModule.findUnique({
      where: { code: moduleCode },
    });
    if (!module) {
      throw new NotFoundException(`System module "${moduleCode}" not found`);
    }
    if (module.isCore && dto.enabled === false) {
      throw new ForbiddenException('Core modules cannot be disabled');
    }

    const existing = await this.prisma.tenantModule.findUnique({
      where: { tenantId_moduleId: { tenantId: user.tenantId, moduleId: module.id } },
    });

    const nextEnabled = dto.enabled ?? existing?.enabled ?? false;
    const nextConfiguration: Prisma.InputJsonValue = (dto.configuration ??
      (existing?.configurationJson as Prisma.InputJsonValue | null) ??
      {}) as Prisma.InputJsonValue;

    const upserted = await this.prisma.tenantModule.upsert({
      where: { tenantId_moduleId: { tenantId: user.tenantId, moduleId: module.id } },
      create: {
        tenantId: user.tenantId,
        moduleId: module.id,
        enabled: nextEnabled,
        configurationJson: nextConfiguration,
        activatedAt: nextEnabled ? new Date() : null,
      },
      update: {
        enabled: nextEnabled,
        configurationJson: nextConfiguration,
        ...(existing && !existing.enabled && nextEnabled ? { activatedAt: new Date() } : {}),
      },
    });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'system.tenant.module.updated',
      entityType: 'tenant_module',
      entityId: module.id,
      oldValuesJson: existing
        ? {
            enabled: existing.enabled,
            configuration: existing.configurationJson as Prisma.InputJsonValue,
          }
        : { enabled: false, configuration: {} },
      newValuesJson: {
        moduleCode: module.code,
        enabled: upserted.enabled,
        configuration: upserted.configurationJson as Prisma.InputJsonValue,
      },
    });

    this.realtime.emitTenantSystemEvent('tenant.module.updated', user.tenantId, {
      tenantId: user.tenantId,
      moduleCode: module.code,
      enabled: upserted.enabled,
      configuration: upserted.configurationJson,
    });

    return {
      moduleId: module.id,
      moduleCode: module.code,
      enabled: upserted.enabled,
      configuration: upserted.configurationJson ?? {},
    };
  }
}
