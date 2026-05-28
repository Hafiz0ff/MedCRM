import { Injectable } from '@nestjs/common';
import { IntegrationAdapter, AdapterContext } from '../../core/adapter.interface';

@Injectable()
export class HelixAdapter implements IntegrationAdapter {
  readonly kind = 'LIS_HELIX';

  validateConfig(config: any) {
    if (!config.apiKey || !config.baseUrl) {
      throw new Error('Helix configuration must include apiKey and baseUrl');
    }
    return { baseUrl: config.baseUrl, partnerId: config.partnerId };
  }

  async testConnection(config: any, secrets: Record<string, string>): Promise<void> {
    if (!secrets.apiKey && !config.apiKey) {
      throw new Error('No API key provided for Helix test connection');
    }
  }

  async sendOutbox(message: any, ctx: AdapterContext): Promise<{ externalId: string }> {
    // message.payloadJson contains LabOrder info
    const payload = message.payloadJson;
    ctx.logger.log(`Sending lab order to Helix: orderId=${payload.id}`);

    // Call Helix API simulated post
    const externalId = `HELIX-${Date.now()}`;

    // Update order status in EMR
    await ctx.prisma.labOrder.update({
      where: { id: payload.id },
      data: {
        orderStatus: 'SENT',
        externalOrderId: externalId,
      },
    });

    return { externalId };
  }

  async receiveInbox(payload: any, ctx: AdapterContext): Promise<any[]> {
    // Webhook with results: { orderId: 'HELIX-xxx', results: [{ code: 'CHO', value: '5.2', unit: 'mmol/L' }] }
    ctx.logger.log(`Helix result webhook received for order: ${payload.orderId}`);

    const order = await ctx.prisma.labOrder.findFirst({
      where: { tenantId: ctx.tenantId, externalOrderId: payload.orderId },
    });

    if (!order) {
      throw new Error(`Helix order matching externalId=${payload.orderId} not found`);
    }

    const labResult = await ctx.prisma.labResult.create({
      data: {
        tenantId: ctx.tenantId,
        patientId: order.patientId,
        encounterId: order.encounterId,
        labOrderId: order.id,
        externalResultId: payload.resultId || `RES-${Date.now()}`,
        resultStatus: 'FINAL',
        resultJson: payload.results as any,
      },
    });

    // Create clinical observations
    for (const res of payload.results) {
      await ctx.prisma.clinicalObservation.create({
        data: {
          tenantId: ctx.tenantId,
          patientId: order.patientId,
          encounterId: order.encounterId,
          observationCode: res.code,
          observationName: res.name || res.code,
          value: String(res.value),
          unit: res.unit || null,
          referenceRange: res.referenceRange || null,
          abnormalFlag: res.abnormalFlag || null,
          labResultId: labResult.id,
        },
      });
    }

    await ctx.prisma.labOrder.update({
      where: { id: order.id },
      data: {
        orderStatus: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    return [];
  }

  buildAdminUi() {
    return {
      fields: [
        { name: 'baseUrl', label: 'Helix API URL', type: 'text', required: true },
        { name: 'partnerId', label: 'Helix Partner ID', type: 'text', required: true },
        { name: 'apiKey', label: 'API Secret Key', type: 'password', required: true },
      ],
    };
  }
}

@Injectable()
export class InvitroAdapter implements IntegrationAdapter {
  readonly kind = 'LIS_INVITRO';

  validateConfig(config: any) {
    if (!config.baseUrl) throw new Error('Missing Invitro baseUrl');
    return { baseUrl: config.baseUrl };
  }

  async testConnection(config: any, secrets: Record<string, string>): Promise<void> {}

  async sendOutbox(message: any, ctx: AdapterContext): Promise<{ externalId: string }> {
    const externalId = `INVITRO-${Date.now()}`;
    await ctx.prisma.labOrder.update({
      where: { id: message.payloadJson.id },
      data: { orderStatus: 'SENT', externalOrderId: externalId },
    });
    return { externalId };
  }

  buildAdminUi() {
    return {
      fields: [
        { name: 'baseUrl', label: 'Invitro URL', type: 'text', required: true },
        { name: 'apiKey', label: 'Invitro Token', type: 'password', required: true },
      ],
    };
  }
}

@Injectable()
export class CitilabAdapter implements IntegrationAdapter {
  readonly kind = 'LIS_CITILAB';

  validateConfig(config: any) {
    return {};
  }

  async testConnection(config: any, secrets: Record<string, string>): Promise<void> {}

  async sendOutbox(message: any, ctx: AdapterContext): Promise<{ externalId: string }> {
    const externalId = `CITILAB-${Date.now()}`;
    await ctx.prisma.labOrder.update({
      where: { id: message.payloadJson.id },
      data: { orderStatus: 'SENT', externalOrderId: externalId },
    });
    return { externalId };
  }

  buildAdminUi() {
    return {
      fields: [{ name: 'apiKey', label: 'Citilab Token', type: 'password', required: true }],
    };
  }
}
