import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import { RedisModule } from '@core/cache/redis.module';
import { PrismaModule } from '@core/database/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { EventBusModule } from './eventbus.module';
import { NatsConsumer } from './nats.consumer';
import { NatsPublisher } from './nats.publisher';

describe('EventBusModule Smoke Test', () => {
  let app: TestingModule;
  let publisher: NatsPublisher;
  let consumer: NatsConsumer;

  it('successfully bootstraps and routes events through NATS JetStream', async () => {
    // 1. Compile NestJS testing module
    app = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        RedisModule.forRoot(),
        EventBusModule,
      ],
    }).compile();

    await app.init();

    publisher = app.get(NatsPublisher);
    consumer = app.get(NatsConsumer);

    const tenantId = randomUUID();
    const testPayload = { appointmentId: randomUUID(), status: 'CONFIRMED' };
    let receivedPayload: any = null;
    let receivedTenantId: string = '';

    // 2. Subscribe to a subject in the 'scheduling' stream
    await consumer.subscribe(
      'scheduling',
      `test-consumer-${randomUUID()}`,
      'scheduling.v1.appointment.created',
      async (envelope) => {
        receivedPayload = envelope.payload;
        receivedTenantId = envelope.tenantId;
      },
    );

    // 3. Publish the test event
    await publisher.publish(
      'scheduling.v1.appointment.created',
      tenantId,
      'scheduling.v1.appointment.created',
      testPayload,
    );

    // 4. Wait for event to arrive (up to 2 seconds)
    for (let i = 0; i < 20; i++) {
      if (receivedPayload) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // 5. Assertions
    assert.ok(receivedPayload, 'Should have received the event payload');
    assert.equal(receivedTenantId, tenantId);
    assert.deepEqual(receivedPayload, testPayload);

    // Clean up
    await app.close();
    setTimeout(() => process.exit(0), 100);
  });
});
