export interface PaymentCreateRequest {
  amount: number;
  currency: string;
  description: string;
  orderId: string;
  returnUrl: string;
  metadata?: Record<string, string>;
}

export interface PaymentCreateResponse {
  paymentId: string;
  payUrl: string;
  status: 'PENDING' | 'CREATED';
}

export interface PaymentWebhookResult {
  orderId: string;
  paymentId: string;
  status: 'SUCCEEDED' | 'CANCELLED' | 'REFUNDED' | 'PENDING';
  amount: number;
  currency: string;
}

export interface PaymentProvider {
  readonly providerName: string;
  createPayment(req: PaymentCreateRequest): Promise<PaymentCreateResponse>;
  handleWebhook(rawBody: Buffer, headers: Record<string, string>): Promise<PaymentWebhookResult>;
  refund(paymentId: string, amount?: number): Promise<{ success: boolean }>;
}
