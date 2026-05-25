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
  Headers,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleEnabledGuard } from '../auth/guards/module-enabled.guard';
import { RbacGuard } from '../auth/guards/rbac.guard';
import {
  CreateLabOrderSchema,
  CreateLabOrderDto,
  SubmitLabResultSchema,
  SubmitLabResultDto,
  UploadFileMetadataSchema,
  UploadFileMetadataDto,
  CallEventWebhookSchema,
  CallEventWebhookDto,
  DeviceMeasurementSchema,
  DeviceMeasurementDto,
} from './dto/integration.dto';
import { IntegrationGatewayService } from './integration.service';

@ApiTags('integration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ModuleEnabledGuard, RbacGuard)
@RequireModule('integration-gateway')
@Controller('integration')
export class IntegrationGatewayController {
  constructor(private readonly gateway: IntegrationGatewayService) {}

  // 1. Webhook Engine Receiver Dispatcher
  @Post('webhooks/:provider/:type')
  @RequirePermissions('integration.gateway.manage')
  async handleWebhook(
    @CurrentUser() user: AuthenticatedUser,
    @Param('provider') providerCode: string,
    @Param('type') webhookType: string,
    @Headers('x-signature-sha256') signature: string,
    @Headers() headers: Record<string, string>,
    @Body() payload: any,
  ) {
    return this.gateway.handleIncomingWebhook(
      user.tenantId,
      providerCode,
      webhookType,
      headers,
      payload,
      signature,
    );
  }

  // 2. LIS Laboratory Integrations
  @Post('lab-orders')
  @RequirePermissions('integration.lab.manage')
  @UsePipes(new ZodValidationPipe(CreateLabOrderSchema))
  createLabOrder(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateLabOrderDto) {
    return this.gateway.createLabOrder(user, dto);
  }

  @Post('webhooks/lis/:provider')
  @RequirePermissions('integration.lab.manage')
  @UsePipes(new ZodValidationPipe(SubmitLabResultSchema))
  submitLabResult(
    @CurrentUser() user: AuthenticatedUser,
    @Param('provider') providerCode: string,
    @Body() dto: SubmitLabResultDto,
  ) {
    return this.gateway.submitLabResult(user.tenantId, providerCode, dto);
  }

  // 3. S3 Cloud Storage Registry (Pre-signed Upload / Download metadata)
  @Post('files/upload')
  @RequirePermissions('integration.storage.manage')
  @UsePipes(new ZodValidationPipe(UploadFileMetadataSchema))
  registerFileMetadata(@CurrentUser() user: AuthenticatedUser, @Body() dto: UploadFileMetadataDto) {
    return this.gateway.registerFileMetadata(user, dto);
  }

  @Get('files/:id/download')
  @RequirePermissions('integration.storage.manage')
  getExpiringDownloadUrl(@CurrentUser() user: AuthenticatedUser, @Param('id') fileId: string) {
    return this.gateway.getExpiringDownloadUrl(user, fileId);
  }

  // 4. IP Telephony Inbound Webhooks
  @Post('webhooks/telephony/:provider')
  @RequirePermissions('integration.telephony.manage')
  @UsePipes(new ZodValidationPipe(CallEventWebhookSchema))
  processTelephonyWebhook(
    @CurrentUser() user: AuthenticatedUser,
    @Param('provider') providerCode: string,
    @Body() dto: CallEventWebhookDto,
  ) {
    if (dto.providerCode !== providerCode) {
      throw new BadRequestException('Несоответствие кода провайдера телефонии');
    }
    return this.gateway.processTelephonyWebhook(user.tenantId, dto);
  }

  // 5. Medical Device Measurements Telemetry normalizer
  @Post('devices/measurements')
  @RequirePermissions('integration.gateway.manage')
  @UsePipes(new ZodValidationPipe(DeviceMeasurementSchema))
  recordDeviceMeasurement(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DeviceMeasurementDto,
  ) {
    return this.gateway.recordDeviceMeasurement(user, dto);
  }

  // 6. FHIR Gateway Interoperability Endpoints
  @Get('fhir/DiagnosticReport/:id')
  @RequirePermissions('integration.lab.manage')
  getDiagnosticReportFHIR(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.gateway.getDiagnosticReportFHIR(user, id);
  }

  @Get('fhir/Observation/:id')
  @RequirePermissions('integration.lab.manage')
  getObservationFHIR(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.gateway.getObservationFHIR(user, id);
  }
}
