import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PortalPublicService } from './portal-public.service';

@ApiTags('patient-portal-public')
@Controller('portal/v1/public')
export class PortalPublicController {
  constructor(private readonly publicService: PortalPublicService) {}

  @Get('clinics')
  @ApiOperation({ summary: 'Get list of active clinics for the public directory' })
  getClinics() {
    return this.publicService.getClinics();
  }

  @Get('clinics/:tenantCode')
  @ApiOperation({ summary: 'Get clinic details' })
  getClinic(@Param('tenantCode') tenantCode: string) {
    return this.publicService.getClinicByCode(tenantCode);
  }

  @Get('clinics/:tenantCode/doctors')
  @ApiOperation({ summary: 'Get list of doctors in a clinic' })
  getDoctors(@Param('tenantCode') tenantCode: string) {
    return this.publicService.getDoctorsByClinic(tenantCode);
  }

  @Get('clinics/:tenantCode/doctors/:doctorId')
  @ApiOperation({ summary: 'Get doctor details' })
  getDoctor(@Param('tenantCode') tenantCode: string, @Param('doctorId') doctorId: string) {
    return this.publicService.getDoctorDetail(tenantCode, doctorId);
  }
}
