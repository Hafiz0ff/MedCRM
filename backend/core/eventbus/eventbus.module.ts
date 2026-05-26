import { Global, Module } from '@nestjs/common';
import { IdempotencyService } from './idempotency.service';
import { NatsConnectionProvider } from './nats-connection.provider';
import { NatsConsumer } from './nats.consumer';
import { NatsPublisher } from './nats.publisher';

@Global()
@Module({
  providers: [NatsConnectionProvider, NatsPublisher, NatsConsumer, IdempotencyService],
  exports: [NatsConnectionProvider, NatsPublisher, NatsConsumer, IdempotencyService],
})
export class EventBusModule {}
