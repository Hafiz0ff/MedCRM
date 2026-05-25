import { ZodValidationPipe } from '@core/common/zod-validation.pipe';
import { Body, Controller, Get, Post, Req, UseGuards, UsePipes } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import {
  PortalConnectDto,
  PortalConnectSchema,
  PortalConnectPinDto,
  PortalConnectPinSchema,
  PortalConnectDeeplinkDto,
  PortalConnectDeeplinkSchema,
  PortalOtpRequestDto,
  PortalOtpRequestSchema,
  PortalOtpVerifyDto,
  PortalOtpVerifySchema,
} from '../dto/portal-auth.dto';
import { CurrentPortalUser } from './current-portal-user.decorator';
import { AuthenticatedPortalUser } from './patient-jwt-payload';
import { PatientJwtAuthGuard } from './patient-jwt.guard';
import { PortalAuthService } from './portal-auth.service';
import { PortalConnectService } from './portal-connect.service';

@ApiTags('patient-portal-auth')
@Controller('portal/v1/auth')
export class PortalAuthController {
  constructor(
    private readonly auth: PortalAuthService,
    private readonly connect: PortalConnectService,
  ) {}

  @Post('otp/request')
  @ApiOperation({ summary: 'Request a one-time OTP login code' })
  @UsePipes(new ZodValidationPipe(PortalOtpRequestSchema))
  async requestOtp(@Body() dto: PortalOtpRequestDto) {
    return this.auth.requestOtp(dto.phone);
  }

  @Post('otp/verify')
  @ApiOperation({ summary: 'Verify OTP and retrieve active session tokens' })
  @UsePipes(new ZodValidationPipe(PortalOtpVerifySchema))
  async verifyOtp(@Body() dto: PortalOtpVerifyDto, @Req() request: Request) {
    return this.auth.verifyOtpAndLogin(
      dto.phone,
      dto.code,
      request.headers['user-agent'],
      request.ip,
    );
  }

  @Post('connect')
  @ApiBearerAuth()
  @UseGuards(PatientJwtAuthGuard)
  @ApiOperation({ summary: 'Link patient portal account to a clinic tenant' })
  @UsePipes(new ZodValidationPipe(PortalConnectSchema))
  async connectClinic(
    @CurrentPortalUser() user: AuthenticatedPortalUser,
    @Body() dto: PortalConnectDto,
  ) {
    return this.connect.connectToClinic(user.accountId, dto.tenantCode);
  }

  @Post('connect/pin')
  @ApiBearerAuth()
  @UseGuards(PatientJwtAuthGuard)
  @ApiOperation({ summary: 'Connect to a clinic via 6-digit PIN code' })
  @UsePipes(new ZodValidationPipe(PortalConnectPinSchema))
  async connectViaPin(
    @CurrentPortalUser() user: AuthenticatedPortalUser,
    @Body() dto: PortalConnectPinDto,
  ) {
    return this.connect.connectViaPin(user.accountId, dto.pin);
  }

  @Post('connect/deeplink')
  @ApiBearerAuth()
  @UseGuards(PatientJwtAuthGuard)
  @ApiOperation({ summary: 'Connect to a clinic via signed deeplink / QR code' })
  @UsePipes(new ZodValidationPipe(PortalConnectDeeplinkSchema))
  async connectViaDeeplink(
    @CurrentPortalUser() user: AuthenticatedPortalUser,
    @Body() dto: PortalConnectDeeplinkDto,
  ) {
    return this.connect.connectViaSignedDeeplink(
      user.accountId,
      dto.tenantCode,
      dto.patientId,
      dto.expiresAt,
      dto.signature,
    );
  }

  @Get('clinics')
  @ApiBearerAuth()
  @UseGuards(PatientJwtAuthGuard)
  @ApiOperation({ summary: 'Get list of linked clinics for the authenticated account' })
  async getConnectedClinics(@CurrentPortalUser() user: AuthenticatedPortalUser) {
    return this.connect.getConnectedClinics(user.accountId);
  }

  @Post('logout')
  @ApiBearerAuth()
  @UseGuards(PatientJwtAuthGuard)
  @ApiOperation({ summary: 'Logout and revoke active portal session' })
  async logout(@CurrentPortalUser() user: AuthenticatedPortalUser) {
    return this.auth.logout(user.sessionId);
  }
}
