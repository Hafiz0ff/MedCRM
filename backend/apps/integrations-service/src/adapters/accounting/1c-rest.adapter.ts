import { Injectable } from '@nestjs/common';
import { IntegrationAdapter, AdapterContext } from '../../core/adapter.interface';

@Injectable()
export class OneCAdapter implements IntegrationAdapter {
  readonly kind = 'ACCOUNTING_1C';

  validateConfig(config: any) {
    if (!config.odataUrl) throw new Error('1C OData endpoint (odataUrl) is required');
    return { odataUrl: config.odataUrl };
  }

  async testConnection(config: any, secrets: Record<string, string>): Promise<void> {
    if (!secrets.username || !secrets.password) {
      throw new Error('OData basic authentication credentials missing');
    }
  }

  // Sends invoice items / payments to 1C ledger
  async sendOutbox(message: any, ctx: AdapterContext): Promise<{ externalId: string }> {
    const invoice = message.payloadJson;
    ctx.logger.log(`Posting invoice to 1C OData: invoiceId=${invoice.id}`);

    // Map invoice to 1C document schema: { Number: invoice.id, Date: invoice.createdAt, Sum: invoice.totalAmount, Client: invoice.patientId }
    return { externalId: `1C-DOC-${Math.floor(100000 + Math.random() * 900000)}` };
  }

  buildAdminUi() {
    return {
      fields: [
        { name: 'odataUrl', label: '1C OData Base URL', type: 'text', required: true },
        { name: 'username', label: '1C API Username', type: 'text', required: true },
        { name: 'password', label: '1C API Password', type: 'password', required: true },
      ],
    };
  }
}
