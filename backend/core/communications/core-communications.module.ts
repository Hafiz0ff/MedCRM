import { Global, Module } from '@nestjs/common';
import { ChannelProviderRegistry } from './channel-provider.registry';
import { ChatbotProcessor } from './chatbot-processor';
import { SmsRuAdapter } from './providers/sms.ru.adapter';
import { TelegramBotAdapter } from './providers/telegram.bot.adapter';

@Global()
@Module({
  providers: [SmsRuAdapter, TelegramBotAdapter, ChannelProviderRegistry, ChatbotProcessor],
  exports: [ChannelProviderRegistry, ChatbotProcessor],
})
export class CoreCommunicationsModule {}
