import { PrismaService } from '@core/database/prisma.service';
import { AuthenticatedUser } from '@core/security/jwt-payload';
import { Injectable, UnauthorizedException } from '@nestjs/common';

export type AuthContext = {
  branchIds: string[];
  roleIds: string[];
  permissions: string[];
  branches: Array<{ id: string; code: string; name: string }>;
};

export type BootstrapPayload = {
  tenant: {
    id: string;
    code: string;
    name: string;
    locale: string;
    subscriptionPlan: string;
    customDomain?: string | null;
    brandColor?: string | null;
    accentColor?: string | null;
    logoUrl?: string | null;
    faviconUrl?: string | null;
    region?: string | null;
  };
  enabledModules: string[];
  permissions: string[];
  branches: Array<{ id: string; code: string; name: string }>;
  featureFlags: Record<string, boolean | string | number>;
};

/**
 * Service to build the initial configuration and permission context (bootstrap) for the frontend UI.
 */
@Injectable()
export class BootstrapService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates a bootstrap payload for an authenticated user session.
   */
  async bootstrap(user: AuthenticatedUser, branchId?: string): Promise<BootstrapPayload> {
    const context = await this.buildAuthContext(user.userId, user.tenantId, branchId);
    return this.bootstrapFromIds(user.userId, user.tenantId, context);
  }

  /**
   * Resolves the user's role and permission context for the tenant and branch.
   */
  async buildAuthContext(
    userId: string,
    tenantId: string,
    branchId?: string,
  ): Promise<AuthContext> {
    const branchRoles = await this.prisma.userBranchRole.findMany({
      where: {
        userId,
        tenantId,
        activeTo: null,
        ...(branchId ? { branchId } : {}),
      },
      include: {
        branch: true,
        role: { include: { permissions: { include: { permission: true } } } },
      },
    });

    if (branchRoles.length === 0) {
      throw new UnauthorizedException('User has no active branch access');
    }

    const activeTenantModules = await this.prisma.tenantModule.findMany({
      where: { tenantId, enabled: true },
      include: { module: true },
    });

    const coreModules = await this.prisma.systemModule.findMany({
      where: { isCore: true },
    });

    const enabledModuleCodes = new Set([
      ...activeTenantModules.map((tm) => tm.module.code),
      ...coreModules.map((m) => m.code),
    ]);

    const branchIds = [...new Set(branchRoles.map((item) => item.branchId))];
    const roleIds = [...new Set(branchRoles.map((item) => item.roleId))];
    const permissions = [
      ...new Set(
        branchRoles.flatMap((item) =>
          item.role.permissions
            .filter((rp) => enabledModuleCodes.has(rp.permission.moduleCode))
            .map((rolePermission) => rolePermission.permission.code),
        ),
      ),
    ].sort();
    const branches = branchRoles.map((item) => ({
      id: item.branch.id,
      code: item.branch.code,
      name: item.branch.name,
    }));

    return { branchIds, roleIds, permissions, branches };
  }

  /**
   * Compiles the final UI bootstrap payload using resolved identifiers and contexts.
   */
  async bootstrapFromIds(
    _userId: string,
    tenantId: string,
    context: AuthContext,
  ): Promise<BootstrapPayload> {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const tenantModules = await this.prisma.tenantModule.findMany({
      where: { tenantId, enabled: true },
      include: { module: true },
    });

    return {
      tenant: {
        id: tenant.id,
        code: tenant.code,
        name: tenant.name,
        locale: tenant.defaultLocale,
        subscriptionPlan: tenant.subscriptionPlan,
        customDomain: tenant.customDomain,
        brandColor: tenant.brandColor,
        accentColor: tenant.accentColor,
        logoUrl: tenant.logoUrl,
        faviconUrl: tenant.faviconUrl,
        region: tenant.region,
      },
      enabledModules: tenantModules.map((item) => item.module.code).sort(),
      permissions: context.permissions,
      branches: context.branches,
      featureFlags: Object.fromEntries(
        tenantModules.map((item) => [`${item.module.code}.enabled`, true]),
      ),
    };
  }
}
