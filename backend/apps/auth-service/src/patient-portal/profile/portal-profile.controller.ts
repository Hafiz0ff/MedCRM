import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentPortalUser } from '../auth/current-portal-user.decorator';
import { AuthenticatedPortalUser } from '../auth/patient-jwt-payload';
import { PatientJwtAuthGuard } from '../auth/patient-jwt.guard';
import { PortalProfileService } from './portal-profile.service';

@ApiTags('patient-portal-profile')
@Controller('portal/v1/me')
@ApiBearerAuth()
@UseGuards(PatientJwtAuthGuard)
export class PortalProfileController {
  constructor(private readonly profile: PortalProfileService) {}

  @Get('profile/:tenantCode')
  @ApiOperation({ summary: 'Get patient profile' })
  getProfile(
    @CurrentPortalUser() user: AuthenticatedPortalUser,
    @Param('tenantCode') tenantCode: string,
  ) {
    return this.profile.getProfile(user, tenantCode);
  }

  @Get('consents/:tenantCode')
  @ApiOperation({ summary: 'Get list of active consents' })
  listConsents(
    @CurrentPortalUser() user: AuthenticatedPortalUser,
    @Param('tenantCode') tenantCode: string,
  ) {
    return this.profile.listConsents(user, tenantCode);
  }

  @Get('consents/:tenantCode/missing')
  @ApiOperation({ summary: 'Get list of required but missing consents' })
  listMissingConsents(
    @CurrentPortalUser() user: AuthenticatedPortalUser,
    @Param('tenantCode') tenantCode: string,
  ) {
    return this.profile.listMissingConsents(user, tenantCode);
  }

  @Post('consents/:tenantCode/:documentTypeId/sign')
  @ApiOperation({ summary: 'Sign a required consent digitally' })
  signConsent(
    @CurrentPortalUser() user: AuthenticatedPortalUser,
    @Param('tenantCode') tenantCode: string,
    @Param('documentTypeId') documentTypeId: string,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.profile.signConsent(user, tenantCode, documentTypeId, ipAddress, userAgent);
  }

  @Post('consents/:tenantCode/:documentId/revoke')
  @ApiOperation({ summary: 'Revoke an existing consent' })
  revokeConsent(
    @CurrentPortalUser() user: AuthenticatedPortalUser,
    @Param('tenantCode') tenantCode: string,
    @Param('documentId') documentId: string,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.profile.revokeConsent(user, tenantCode, documentId, ipAddress, userAgent);
  }
}
