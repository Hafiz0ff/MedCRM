import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentPortalUser } from '../auth/current-portal-user.decorator';
import { AuthenticatedPortalUser } from '../auth/patient-jwt-payload';
import { PatientJwtAuthGuard } from '../auth/patient-jwt.guard';
import { PortalVisitsService } from './portal-visits.service';

@ApiTags('patient-portal-visits')
@Controller('portal/v1/visits')
@ApiBearerAuth()
@UseGuards(PatientJwtAuthGuard)
export class PortalVisitsController {
  constructor(private readonly visits: PortalVisitsService) {}

  @Get('history')
  @ApiOperation({ summary: 'Get past visits history with pagination' })
  getHistory(
    @CurrentPortalUser() user: AuthenticatedPortalUser,
    @Query('tenantCode') tenantCode: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.visits.getVisitsHistory(
      user,
      tenantCode,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get(':tenantCode/:appointmentId')
  @ApiOperation({ summary: 'Get appointment detail' })
  getDetail(
    @CurrentPortalUser() user: AuthenticatedPortalUser,
    @Param('tenantCode') tenantCode: string,
    @Param('appointmentId') appointmentId: string,
  ) {
    return this.visits.getAppointmentDetail(user, tenantCode, appointmentId);
  }
}
