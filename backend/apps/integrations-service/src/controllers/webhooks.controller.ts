import { createHash } from 'node:crypto';
import { PrismaService } from '@core/database/prisma.service';
import {
  Controller,
  Post,
  Param,
  Headers,
  Body,
  BadRequestException,
  ForbiddenException,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InboxProcessor } from '../core/inbox-processor';

@ApiTags('webhooks')
@Controller('integration/webhooks')
export class WebhooksController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inboxProcessor: InboxProcessor,
  ) {}

  @Post(':provider/:type')
  async handleGenericWebhook(
    @Param('provider') providerCode: string,
    @Param('type') webhookType: string,
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-signature-sha256') signature: string,
    @Headers() headers: Record<string, string>,
    @Body() payload: any,
  ) {
    if (!tenantId) throw new BadRequestException('Missing X-Tenant-Id header');

    const provider = await this.prisma.integrationProvider.findFirst({
      where: { tenantId, providerCode: providerCode.toUpperCase(), isActive: true },
    });
    if (!provider) throw new BadRequestException('Active integration provider not found');

    // HMAC Signature verification
    if (provider.authenticationType === 'HMAC' && signature) {
      const config = provider.configurationJson as Record<string, any>;
      const secret = config.secret || 'secret-123';
      const computedHash = createHash('sha256')
        .update(JSON.stringify(payload) + secret)
        .digest('hex');
      if (computedHash !== signature) {
        throw new ForbiddenException('Webhook signature HMAC validation failed');
      }
    }

    const externalId = payload.eventId || payload.id || `WEB-${Date.now()}`;

    return this.inboxProcessor.processInbound(
      tenantId,
      provider.id,
      externalId,
      webhookType,
      JSON.stringify(payload),
      payload,
    );
  }

  @Post('lis/:provider')
  async handleLisResult(
    @Param('provider') providerCode: string,
    @Headers('x-tenant-id') tenantId: string,
    @Body() payload: any,
  ) {
    if (!tenantId) throw new BadRequestException('Missing X-Tenant-Id header');

    const provider = await this.prisma.laboratoryProvider.findFirst({
      where: { tenantId, providerCode: providerCode.toUpperCase(), isActive: true },
    });
    if (!provider) throw new BadRequestException('Active laboratory provider not found');

    // Find the linked order
    const order = await this.prisma.labOrder.findFirst({
      where: { tenantId, externalOrderId: payload.externalOrderId },
    });
    if (!order) throw new BadRequestException(`Order ${payload.externalOrderId} not found`);

    // Complete the laboratory order and create results
    const result = await this.prisma.$transaction(async (tx) => {
      const dbResult = await tx.labResult.create({
        data: {
          tenantId,
          patientId: order.patientId,
          encounterId: order.encounterId,
          labOrderId: order.id,
          externalResultId: payload.externalResultId || `RES-${Date.now()}`,
          resultStatus: payload.resultStatus || 'FINAL',
          resultJson: payload.results as any,
        },
      });

      for (const obs of payload.results) {
        await tx.clinicalObservation.create({
          data: {
            tenantId,
            patientId: order.patientId,
            encounterId: order.encounterId,
            observationCode: obs.testCode,
            observationName: obs.testName,
            value: String(obs.value),
            unit: obs.unit || null,
            referenceRange: obs.referenceRange || null,
            abnormalFlag: obs.abnormalFlag || null,
            sourceProviderId: provider.id,
            labResultId: dbResult.id,
          },
        });
      }

      await tx.labOrder.update({
        where: { id: order.id },
        data: {
          orderStatus: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      return dbResult;
    });

    return { success: true, resultId: result.id };
  }

  @Post('telephony/:provider')
  async handleTelephony(
    @Param('provider') providerCode: string,
    @Headers('x-tenant-id') tenantId: string,
    @Body() payload: any,
  ) {
    if (!tenantId) throw new BadRequestException('Missing X-Tenant-Id header');

    const provider = await this.prisma.telephonyProvider.findFirst({
      where: { tenantId, providerCode: providerCode.toUpperCase(), isActive: true },
    });
    if (!provider) throw new BadRequestException('Active telephony provider not found');

    const phoneHash = createHash('sha256')
      .update(payload.phone.toLowerCase().replace(/[\s()+-]/g, ''))
      .digest('hex');

    const contact = await this.prisma.patientContact.findFirst({
      where: { tenantId, normalizedValueHash: phoneHash },
    });

    const callEvent = await this.prisma.callEvent.create({
      data: {
        tenantId,
        providerId: provider.id,
        callId: payload.callId || `CALL-${Date.now()}`,
        patientId: contact?.patientId || null,
        eventType: payload.eventType,
        phoneNumber: payload.phone,
        direction: payload.direction,
        durationSeconds: payload.durationSeconds || 0,
      },
    });

    return { success: true, callEventId: callEvent.id };
  }
}
