import { createHmac } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  PaymentCreateRequest,
  PaymentCreateResponse,
  PaymentProvider,
  PaymentWebhookResult,
} from '../payment-provider.interface';

@Injectable()
export class AlifAdapter implements PaymentProvider {
  readonly providerName = 'alif';

  constructor(private readonly config: ConfigService) {}

  private get merchantId() {
    return this.config.getOrThrow<string>('ALIF_MERCHANT_ID');
  }

  private get apiKey() {
    return this.config.getOrThrow<string>('ALIF_API_KEY');
  }

  private get secretKey() {
    return this.config.getOrThrow<string>('ALIF_SECRET_KEY');
  }

  private get baseUrl() {
    return this.config.get<string>('ALIF_API_URL', 'https://api.alif.tj/merchant/v1');
  }

  async createPayment(req: PaymentCreateRequest): Promise<PaymentCreateResponse> {
    const body = {
      merchant_id: this.merchantId,
      amount: req.amount,
      currency: req.currency,
      order_id: req.orderId,
      description: req.description,
      return_url: req.returnUrl,
      metadata: req.metadata,
    };

    const response = await fetch(`${this.baseUrl}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Alif payment creation failed: ${err}`);
    }

    const data = await response.json();
    return {
      paymentId: data.payment_id,
      payUrl: data.pay_url,
      status: 'CREATED',
    };
  }

  async handleWebhook(
    rawBody: Buffer,
    headers: Record<string, string>,
  ): Promise<PaymentWebhookResult> {
    const signature = headers['x-alif-signature'] ?? headers['X-Alif-Signature'];
    if (signature) {
      const expected = createHmac('sha256', this.secretKey).update(rawBody).digest('hex');
      if (expected !== signature) {
        throw new Error('Invalid Alif webhook signature');
      }
    }

    const payload = JSON.parse(rawBody.toString());
    return {
      orderId: payload.order_id ?? '',
      paymentId: payload.payment_id,
      status: this.mapStatus(payload.status),
      amount: payload.amount,
      currency: payload.currency,
    };
  }

  async refund(paymentId: string, amount?: number): Promise<{ success: boolean }> {
    const body: Record<string, unknown> = { payment_id: paymentId };
    if (amount !== undefined) {
      body.amount = amount;
    }

    const response = await fetch(`${this.baseUrl}/refunds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    return { success: response.ok };
  }

  private mapStatus(status: string): PaymentWebhookResult['status'] {
    switch (status) {
      case 'completed':
      case 'succeeded':
        return 'SUCCEEDED';
      case 'cancelled':
      case 'canceled':
        return 'CANCELLED';
      case 'refunded':
        return 'REFUNDED';
      default:
        return 'PENDING';
    }
  }
}
