import { Injectable, Logger } from '@nestjs/common';
import { ChannelProvider } from '../channel-provider.interface';

@Injectable()
export class TelegramBotAdapter implements ChannelProvider {
  private readonly logger = new Logger(TelegramBotAdapter.name);
  readonly channelType = 'TELEGRAM';

  async send(input: {
    to: string; // Chat ID
    subject?: string | null;
    body: string;
    meta?: Record<string, any>;
  }): Promise<{ status: 'SENT' | 'FAILED' | 'QUEUED'; externalId?: string; error?: string }> {
    const chatId = input.to;
    this.logger.log(`[Telegram Adapter] Initiating message dispatch to Chat ID: ${chatId}...`);

    const sandbox = process.env.COMMUNICATIONS_SANDBOX !== 'false';
    const botToken = process.env.TELEGRAM_BOT_TOKEN || 'sandbox_token';

    if (sandbox || botToken === 'sandbox_token') {
      this.logger.log(`[SANDBOX TELEGRAM] TO: ${chatId} | TEXT: "${input.body}"`);
      return {
        status: 'SENT',
        externalId: `tg-sandbox-${Math.random().toString(36).slice(2, 10)}`,
      };
    }

    try {
      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

      // Support optional inline keyboard buttons for interactive replies
      const replyMarkup = input.meta?.replyMarkup ? input.meta.replyMarkup : undefined;

      const bodyPayload = {
        chat_id: chatId,
        text: input.body,
        parse_mode: 'HTML',
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });

      if (!response.ok) {
        throw new Error(`Telegram API responded with status ${response.status}`);
      }

      const result = (await response.json()) as any;
      if (result.ok && result.result) {
        return {
          status: 'SENT',
          externalId: String(result.result.message_id),
        };
      }

      return {
        status: 'FAILED',
        error: result.description || 'Malformed Telegram API response',
      };
    } catch (err: any) {
      this.logger.error(`Telegram delivery failed for Chat ID ${chatId}: ${err.message}`);
      return {
        status: 'FAILED',
        error: err.message,
      };
    }
  }
}
