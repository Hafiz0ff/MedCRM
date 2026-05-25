import { Module } from '@nestjs/common';
import { OutboxDispatchWorker } from './outbox-dispatch.worker';
import { OutboxRelayWorker } from './outbox-relay.worker';

@Module({
  providers: [OutboxRelayWorker, OutboxDispatchWorker],
})
export class IntegrationsModule {}
