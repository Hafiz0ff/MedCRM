import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  PaymentCreateRequest,
  PaymentCreateResponse,
  PaymentProvider,
  PaymentWebhookResult,
} from '../payment-provider.interface';

@Injectable()
export class YooKassaAdapter implements PaymentProvider {
  readonly providerName = 'yookassa';

  constructor(private readonly config: ConfigService) {}

  private get shopId() {
    return this.config.getOrThrow<string>('YOOKASSA_SHOP_ID');
  }

  private get secretKey() {
    return this.config.getOrThrow<string>('YOOKASSA_SECRET_KEY');
  }

  private buildAuthHeader(): string {
    return `Basic ${Buffer.from(`${this.shopId}:${this.secretKey}`).toString('base64')}`;
  }

  async createPayment(req: PaymentCreateRequest): Promise<PaymentCreateResponse> {
    const idempotencyKey = `${req.orderId}-${Date.now()}`;
    const body = {
      amount: { value: req.amount.toFixed(2), currency: req.currency },
      confirmation: { type: 'redirect', return_url: req.returnUrl },
      capture: true,
      description: req.description,
      metadata: { order_id: req.orderId, ...req.metadata },
    };

    const response = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotence-Key': idempotencyKey,
        Authorization: this.buildAuthHeader(),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`YooKassa payment creation failed: ${err}`);
    }

    const data = await response.json();
    return {
      paymentId: data.id,
      payUrl: data.confirmation.confirmation_url,
      status: 'CREATED',
    };
  }

  async handleWebhook(
    rawBody: Buffer,
    _headers: Record<string, string>,
  ): Promise<PaymentWebhookResult> {
    const payload = JSON.parse(rawBody.toString());
    const payment = payload.object;

    return {
      orderId: payment.metadata?.order_id ?? '',
      paymentId: payment.id,
      status: this.mapStatus(payment.status),
      amount: parseFloat(payment.amount.value),
      currency: payment.amount.currency,
    };
  }

  async refund(paymentId: string, amount?: number): Promise<{ success: boolean }> {
    const paymentRes = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
      headers: { Authorization: this.buildAuthHeader() },
    });
    const paymentData = await paymentRes.json();

    const refundBody = {
      payment_id: paymentId,
      amount: {
        value: amount ? amount.toFixed(2) : paymentData.amount.value,
        currency: paymentData.amount.currency,
      },
    };

    const response = await fetch('https://api.yookassa.ru/v3/refunds', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotence-Key': `refund-${paymentId}-${Date.now()}`,
        Authorization: this.buildAuthHeader(),
      },
      body: JSON.stringify(refundBody),
    });

    return { success: response.ok };
  }

  private mapStatus(status: string): PaymentWebhookResult['status'] {
    switch (status) {
      case 'succeeded':
        return 'SUCCEEDED';
      case 'canceled':
        return 'CANCELLED';
      case 'refunded':
        return 'REFUNDED';
      default:
        return 'PENDING';
    }
  }
}
