import { Injectable, Logger } from '@nestjs/common';
import { ChannelProvider } from '../channel-provider.interface';

@Injectable()
export class SmsRuAdapter implements ChannelProvider {
  private readonly logger = new Logger(SmsRuAdapter.name);
  readonly channelType = 'SMS';

  async send(input: {
    to: string;
    subject?: string | null;
    body: string;
    meta?: Record<string, any>;
  }): Promise<{ status: 'SENT' | 'FAILED' | 'QUEUED'; externalId?: string; error?: string }> {
    const phone = input.to.replace(/\D/g, ''); // normalize phone
    this.logger.log(`[SMS.ru Adapter] Initiating SMS dispatch to ${phone}...`);

    const sandbox = process.env.COMMUNICATIONS_SANDBOX !== 'false';
    const apiKey = process.env.SMS_API_KEY || 'sandbox_key';

    if (sandbox || apiKey === 'sandbox_key') {
      this.logger.log(`[SANDBOX SMS] TO: ${phone} | TEXT: "${input.body}"`);
      return {
        status: 'SENT',
        externalId: `sms-sandbox-${Math.random().toString(36).slice(2, 10)}`,
      };
    }

    try {
      const url = `https://sms.ru/sms/send?api_id=${apiKey}&to=${phone}&msg=${encodeURIComponent(input.body)}&json=1`;
      const response = await fetch(url, { method: 'POST' });

      if (!response.ok) {
        throw new Error(`SMS.ru responded with status ${response.status}`);
      }

      const result = (await response.json()) as any;
      if (result.status === 'OK' && result.sms && result.sms[phone]) {
        const smsResult = result.sms[phone];
        if (smsResult.status === 'OK') {
          return {
            status: 'SENT',
            externalId: smsResult.sms_id,
          };
        } else {
          return {
            status: 'FAILED',
            error: smsResult.status_text || 'Unknown SMS.ru error',
          };
        }
      }

      return {
        status: 'FAILED',
        error: result.status_text || 'Malformed SMS.ru API response',
      };
    } catch (err: any) {
      this.logger.error(`SMS.ru delivery failed for ${phone}: ${err.message}`);
      return {
        status: 'FAILED',
        error: err.message,
      };
    }
  }
}
