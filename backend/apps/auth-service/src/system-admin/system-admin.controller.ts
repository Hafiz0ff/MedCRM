import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
  UsePipes
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@core/security/current-user.decorator';
import { AuthenticatedUser } from '@core/security/jwt-payload';
import { RequirePermissions } from '@core/security/permissions.decorator';
import { ZodValidationPipe } from '@core/common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RbacGuard } from '../auth/guards/rbac.guard';
import { TenantSettingsService } from './tenant-settings.service';
import { RoleManagementService } from './role-management.service';
import { IntegrationCredentialsService } from './integration-credentials.service';
import { AuditLogService } from './audit-log.service';
import {
  UpdateTenantModuleDto,
  UpdateTenantModuleSchema,
  UpdateTenantProfileDto,
  UpdateTenantProfileSchema
} from './dto/tenant-settings.dto';
import {
  AssignUserRolesDto,
  AssignUserRolesSchema,
  CreateRoleDto,
  CreateRoleSchema,
  SetRolePermissionsDto,
  SetRolePermissionsSchema,
  UpdateRoleDto,
  UpdateRoleSchema
} from './dto/role-management.dto';
import {
  CreateIntegrationProviderDto,
  CreateIntegrationProviderSchema,
  UpdateIntegrationProviderDto,
  UpdateIntegrationProviderSchema
} from './dto/integration-credentials.dto';
import { AuditLogQueryDto, AuditLogQuerySchema } from './dto/audit-log.dto';

@ApiTags('system-admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('system')
export class SystemAdminController {
  constructor(
    private readonly settings: TenantSettingsService,
    private readonly roles: RoleManagementService,
    private readonly integrations: IntegrationCredentialsService,
    private readonly auditLog: AuditLogService
  ) {}

  // Tenant profile & modules ------------------------------------------------

  @Get('tenant')
  @RequirePermissions('system.settings.read')
  getTenantProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.settings.getTenantProfile(user);
  }

  @Patch('tenant')
  @RequirePermissions('system.settings.manage')
  @UsePipes(new ZodValidationPipe(UpdateTenantProfileSchema))
  updateTenantProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateTenantProfileDto
  ) {
    return this.settings.updateTenantProfile(user, dto);
  }

  @Get('modules')
  @RequirePermissions('system.settings.read')
  listTenantModules(@CurrentUser() user: AuthenticatedUser) {
    return this.settings.listTenantModules(user);
  }

  @Patch('modules/:moduleCode')
  @RequirePermissions('system.settings.manage')
  @UsePipes(new ZodValidationPipe(UpdateTenantModuleSchema))
  updateTenantModule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('moduleCode') moduleCode: string,
    @Body() dto: UpdateTenantModuleDto
  ) {
    return this.settings.updateTenantModule(user, moduleCode, dto);
  }

  // Roles & permissions -----------------------------------------------------

  @Get('permissions')
  @RequirePermissions('system.settings.read')
  listPermissions() {
    return this.roles.listPermissions();
  }

  @Get('roles')
  @RequirePermissions('system.settings.read')
  listRoles(@CurrentUser() user: AuthenticatedUser) {
    return this.roles.listRoles(user);
  }

  @Post('roles')
  @RequirePermissions('roles.manage')
  @UsePipes(new ZodValidationPipe(CreateRoleSchema))
  createRole(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRoleDto) {
    return this.roles.createRole(user, dto);
  }

  @Patch('roles/:roleId')
  @RequirePermissions('roles.manage')
  @UsePipes(new ZodValidationPipe(UpdateRoleSchema))
  updateRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roleId') roleId: string,
    @Body() dto: UpdateRoleDto
  ) {
    return this.roles.updateRole(user, roleId, dto);
  }

  @Delete('roles/:roleId')
  @RequirePermissions('roles.manage')
  deleteRole(@CurrentUser() user: AuthenticatedUser, @Param('roleId') roleId: string) {
    return this.roles.deleteRole(user, roleId);
  }

  @Put('roles/:roleId/permissions')
  @RequirePermissions('roles.manage')
  @UsePipes(new ZodValidationPipe(SetRolePermissionsSchema))
  setRolePermissions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roleId') roleId: string,
    @Body() dto: SetRolePermissionsDto
  ) {
    return this.roles.setRolePermissions(user, roleId, dto);
  }

  @Get('users/:userId/roles')
  @RequirePermissions('users.read')
  listUserRoles(@CurrentUser() user: AuthenticatedUser, @Param('userId') userId: string) {
    return this.roles.listUserRoles(user, userId);
  }

  @Put('users/:userId/roles')
  @RequirePermissions('users.manage')
  @UsePipes(new ZodValidationPipe(AssignUserRolesSchema))
  assignUserRoles(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() dto: AssignUserRolesDto
  ) {
    return this.roles.assignUserRoles(user, userId, dto);
  }

  // Integration providers ---------------------------------------------------

  @Get('integrations')
  @RequirePermissions('integration.gateway.manage')
  listIntegrations(@CurrentUser() user: AuthenticatedUser) {
    return this.integrations.listProviders(user);
  }

  @Post('integrations')
  @RequirePermissions('integration.gateway.manage')
  @UsePipes(new ZodValidationPipe(CreateIntegrationProviderSchema))
  createIntegration(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateIntegrationProviderDto
  ) {
    return this.integrations.createProvider(user, dto);
  }

  @Patch('integrations/:providerId')
  @RequirePermissions('integration.gateway.manage')
  @UsePipes(new ZodValidationPipe(UpdateIntegrationProviderSchema))
  updateIntegration(
    @CurrentUser() user: AuthenticatedUser,
    @Param('providerId') providerId: string,
    @Body() dto: UpdateIntegrationProviderDto
  ) {
    return this.integrations.updateProvider(user, providerId, dto);
  }

  @Post('integrations/:providerId/rotate-key')
  @RequirePermissions('integration.gateway.manage')
  rotateIntegrationKey(
    @CurrentUser() user: AuthenticatedUser,
    @Param('providerId') providerId: string
  ) {
    return this.integrations.rotateApiKey(user, providerId);
  }

  @Delete('integrations/:providerId')
  @RequirePermissions('integration.gateway.manage')
  deleteIntegration(
    @CurrentUser() user: AuthenticatedUser,
    @Param('providerId') providerId: string
  ) {
    return this.integrations.deleteProvider(user, providerId);
  }

  // Audit log ---------------------------------------------------------------

  @Get('audit-logs')
  @RequirePermissions('system.audit.read')
  listAuditLogs(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(AuditLogQuerySchema)) query: AuditLogQueryDto
  ) {
    return this.auditLog.list(user, query);
  }
}
