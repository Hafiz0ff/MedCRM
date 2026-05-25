import { ZodValidationPipe } from '@core/common/zod-validation.pipe';
import { CurrentUser } from '@core/security/current-user.decorator';
import { AuthenticatedUser } from '@core/security/jwt-payload';
import { RequireModule } from '@core/security/modules.decorator';
import { RequirePermissions } from '@core/security/permissions.decorator';
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  UsePipes,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleEnabledGuard } from '../auth/guards/module-enabled.guard';
import { RbacGuard } from '../auth/guards/rbac.guard';
import { BusinessIntelligenceService } from './bi.service';
import {
  AnalyticsFilterSchema,
  AnalyticsFilterDto,
  CreateScheduledReportSchema,
  CreateScheduledReportDto,
  RecalculateMetricsSchema,
  RecalculateMetricsDto,
} from './dto/bi.dto';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ModuleEnabledGuard, RbacGuard)
@RequireModule('business-intelligence')
@Controller('analytics')
export class BusinessIntelligenceController {
  constructor(private readonly bi: BusinessIntelligenceService) {}

  // 1. Financial Analytics Board
  @Get('financial')
  @RequirePermissions('analytics.financial.view')
  getFinancialBoard(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(AnalyticsFilterSchema)) filters: AnalyticsFilterDto,
  ) {
    return this.bi.getFinancialBoard(user.tenantId, filters);
  }

  // 2. Marketing ROI Funnel
  @Get('marketing')
  @RequirePermissions('analytics.marketing.view')
  getMarketingAnalytics(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(AnalyticsFilterSchema)) filters: AnalyticsFilterDto,
  ) {
    return this.bi.getMarketingAnalytics(user.tenantId, filters);
  }

  // 3. Operational Clinic Load and Retentions
  @Get('operations')
  @RequirePermissions('analytics.operations.view')
  getOperationalMetrics(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(AnalyticsFilterSchema)) filters: AnalyticsFilterDto,
  ) {
    return this.bi.getOperationalMetrics(user.tenantId, filters);
  }

  // 4. Doctor KPI performance Metrics
  @Get('doctors')
  @RequirePermissions('analytics.operations.view')
  getDoctorKpis(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(AnalyticsFilterSchema)) filters: AnalyticsFilterDto,
  ) {
    return this.bi.getDoctorKpis(user.tenantId, filters);
  }

  // 5. Fast Realtime dashboard K-V metrics cache
  @Get('realtime')
  @RequirePermissions('analytics.financial.view')
  getRealtimeMetrics(@CurrentUser() user: AuthenticatedUser) {
    return this.bi.getRealtimeMetrics(user.tenantId);
  }

  // 6. Scheduled exports configuration
  @Post('reports/schedule')
  @RequirePermissions('analytics.reports.manage')
  @UsePipes(new ZodValidationPipe(CreateScheduledReportSchema))
  createScheduledReport(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateScheduledReportDto,
  ) {
    return this.bi.createScheduledReport(user, dto);
  }

  @Post('reports/:id/generate')
  @RequirePermissions('analytics.reports.manage')
  triggerScheduledReportGeneration(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.bi.triggerScheduledReportGeneration(user.tenantId, id);
  }

  // 7. Manual Recalculation Trigger for ETL pipelines
  @Post('recalculate')
  @RequirePermissions('analytics.reports.manage')
  @UsePipes(new ZodValidationPipe(RecalculateMetricsSchema))
  recalculateMetrics(@CurrentUser() user: AuthenticatedUser, @Body() dto: RecalculateMetricsDto) {
    return this.bi.syncOltpToDwh(user.tenantId, dto);
  }
}
