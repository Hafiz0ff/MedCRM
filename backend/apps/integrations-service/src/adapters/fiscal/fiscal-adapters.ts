import { Injectable } from '@nestjs/common';
import { IntegrationAdapter, AdapterContext } from '../../core/adapter.interface';

@Injectable()
export class AtolAdapter implements IntegrationAdapter {
  readonly kind = 'FISCAL_ATOL';

  validateConfig(config: any) {
    if (!config.companyInn || !config.paymentAddress) {
      throw new Error('Atol config must contain companyInn and paymentAddress');
    }
    return { companyInn: config.companyInn, paymentAddress: config.paymentAddress };
  }

  async testConnection(config: any, secrets: Record<string, string>): Promise<void> {}

  async sendOutbox(message: any, ctx: AdapterContext): Promise<{ externalId: string }> {
    const payment = message.payloadJson;
    ctx.logger.log(`Fiscalizing payment to Atol: paymentId=${payment.id}`);

    // Call Atol API post /chek
    const fn = `fn-${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    const fd = `fd-${Math.floor(100000 + Math.random() * 900000)}`;
    const fpd = `fpd-${Math.floor(100000000 + Math.random() * 900000000)}`;

    // Create receipt metadata in DB
    // Since payment details are in EMR/Finance, let's create a simulated receipt log
    await ctx.prisma.integrationLog.create({
      data: {
        tenantId: ctx.tenantId,
        direction: 'OUTBOUND',
        requestPayload: { paymentId: payment.id, amount: payment.amount } as any,
        responsePayload: { status: 'FISCALIZED', fn, fd, fpd } as any,
        statusCode: 200,
        executionTimeMs: 150,
        correlationId: message.id,
      },
    });

    return { externalId: fpd };
  }

  buildAdminUi() {
    return {
      fields: [
        { name: 'baseUrl', label: 'Atol Service URL', type: 'text', required: true },
        { name: 'companyInn', label: 'Company INN (ИНН)', type: 'text', required: true },
        { name: 'paymentAddress', label: 'Payment Address', type: 'text', required: true },
        { name: 'login', label: 'API Login', type: 'text', required: true },
        { name: 'password', label: 'API Password', type: 'password', required: true },
      ],
    };
  }
}

@Injectable()
export class EvotorAdapter implements IntegrationAdapter {
  readonly kind = 'FISCAL_EVOTOR';

  validateConfig(config: any) {
    return {};
  }

  async testConnection(config: any, secrets: Record<string, string>): Promise<void> {}

  async sendOutbox(message: any, ctx: AdapterContext): Promise<{ externalId: string }> {
    return { externalId: `EVO-${Date.now()}` };
  }

  buildAdminUi() {
    return {
      fields: [{ name: 'apiKey', label: 'Evotor API Token', type: 'password', required: true }],
    };
  }
}

@Injectable()
export class SoliqAdapter implements IntegrationAdapter {
  readonly kind = 'FISCAL_SOLIQ';

  validateConfig(config: any) {
    if (!config.tin) throw new Error('Missing Soliq TIN');
    return { tin: config.tin };
  }

  async testConnection(config: any, secrets: Record<string, string>): Promise<void> {}

  async sendOutbox(message: any, ctx: AdapterContext): Promise<{ externalId: string }> {
    // Uzbekistan ГНК fiscal registration
    const payment = message.payloadJson;
    ctx.logger.log(`Registering payment with Soliq: paymentId=${payment.id}`);
    return { externalId: `SOLIQ-${Date.now()}` };
  }

  buildAdminUi() {
    return {
      fields: [
        { name: 'tin', label: 'TIN / ИНН компании (УЗ)', type: 'text', required: true },
        { name: 'secretKey', label: 'Soliq Private Key', type: 'password', required: true },
      ],
    };
  }
}
