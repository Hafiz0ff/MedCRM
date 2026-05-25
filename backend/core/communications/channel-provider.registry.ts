import { Injectable, NotFoundException } from '@nestjs/common';
import { ChannelProvider } from './channel-provider.interface';
import { SmsRuAdapter } from './providers/sms.ru.adapter';
import { TelegramBotAdapter } from './providers/telegram.bot.adapter';

@Injectable()
export class ChannelProviderRegistry {
  private readonly providers = new Map<string, ChannelProvider>();

  constructor(
    private readonly smsRu: SmsRuAdapter,
    private readonly telegramBot: TelegramBotAdapter,
  ) {
    this.providers.set('SMS', this.smsRu);
    this.providers.set('TELEGRAM', this.telegramBot);
  }

  get(channelType: string): ChannelProvider {
    const provider = this.providers.get(channelType.toUpperCase());
    if (!provider) {
      throw new NotFoundException(
        `No communications channel provider registered for type: ${channelType}`,
      );
    }
    return provider;
  }
}
