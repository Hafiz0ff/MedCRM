import { Module } from '@nestjs/common';
import { SystemAdminController } from './system-admin.controller';
import { TenantSettingsService } from './tenant-settings.service';
import { RoleManagementService } from './role-management.service';
import { IntegrationCredentialsService } from './integration-credentials.service';
import { AuditLogService } from './audit-log.service';
import { SessionInvalidatorService } from './session-invalidator.service';
import { SmartSchedulingModule } from '../smart-scheduling/smart-scheduling.module';

@Module({
  imports: [SmartSchedulingModule],
  controllers: [SystemAdminController],
  providers: [
    TenantSettingsService,
    RoleManagementService,
    IntegrationCredentialsService,
    AuditLogService,
    SessionInvalidatorService
  ],
  exports: [SessionInvalidatorService, IntegrationCredentialsService]
})
export class SystemAdminModule {}
