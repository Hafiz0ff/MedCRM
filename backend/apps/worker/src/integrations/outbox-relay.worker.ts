import { REDIS_CLIENT } from '@core/cache/redis.module';
import { PrismaService } from '@core/database/prisma.service';
import { NatsPublisher } from '@core/eventbus/nats.publisher';
import { QueueNames } from '@core/queue/queue-names';
import { QueueService } from '@core/queue/queue.module';
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';

@Injectable()
export class OutboxRelayWorker implements OnModuleInit {
  private readonly logger = new Logger(OutboxRelayWorker.name);
  private worker!: Worker;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly natsPublisher: NatsPublisher,
  ) {}

  async onModuleInit() {
    const connection = this.redis.duplicate({ maxRetriesPerRequest: null });

    // 1. Initialize the BullMQ Worker to handle the periodic relay trigger
    this.worker = new Worker(
      QueueNames.INTEGRATIONS_OUTBOX_RELAY_TRIGGER,
      async (job: Job) => {
        await this.pollAndRelay();
      },
      { connection, concurrency: 1 },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Outbox relay trigger job failed: ${err.message}`);
    });

    // 2. Schedule the repeatable relay poll job to run every 5 seconds
    const queue = this.queueService.getQueue(QueueNames.INTEGRATIONS_OUTBOX_RELAY_TRIGGER);

    // Clear old repeatable schedules to prevent duplicate active triggers
    const schedulers = await queue.getRepeatableJobs();
    for (const s of schedulers) {
      await queue.removeRepeatableByKey(s.key);
    }

    await queue.add(
      'poll-events',
      {},
      {
        repeat: { every: 5000 },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );

    this.logger.log('Outbox Relay Worker initialized successfully. Scheduled periodic 5s polling.');
  }

  /**
   * Queries pending events in the integration_outbox table and pushes them to NATS (for domain events) or BullMQ (for webhooks).
   */
  private async pollAndRelay(): Promise<void> {
    // Read up to 50 pending outbox entries
    const pendingEvents = await this.prisma.integrationOutbox.findMany({
      where: {
        state: 'PENDING',
        processedAt: null,
      },
      orderBy: { scheduledAt: 'asc' },
      take: 50,
    });

    if (pendingEvents.length === 0) {
      return;
    }

    this.logger.log(`Found ${pendingEvents.length} pending outbox events. Relaying...`);

    for (const event of pendingEvents) {
      try {
        const isDomainEvent =
          /^(auth|scheduling|finance|emr|communications|inventory|analytics)\.v1\./.test(
            event.eventType,
          );

        if (isDomainEvent) {
          // Route domain events to NATS JetStream
          await this.natsPublisher.publish(
            event.eventType,
            event.tenantId,
            event.eventType,
            event.payloadJson,
            { correlationId: event.id },
          );

          await this.prisma.integrationOutbox.update({
            where: { id: event.id },
            data: {
              state: 'DONE',
              processedAt: new Date(),
            },
          });
          this.logger.log(
            `Successfully relayed domain event ${event.id} (${event.eventType}) to NATS`,
          );
        } else {
          // Route external integrations through the existing BullMQ/webhook relay
          await this.queueService.addJob(
            QueueNames.INTEGRATIONS_OUTBOX,
            event.eventType,
            {
              eventId: event.id,
              tenantId: event.tenantId,
              eventType: event.eventType,
              aggregateType: event.aggregateType,
              aggregateId: event.aggregateId,
              payloadJson: event.payloadJson as any,
            },
            event.id,
          );

          // Update database record to IN_PROGRESS so it is not processed twice
          await this.prisma.integrationOutbox.update({
            where: { id: event.id },
            data: { state: 'IN_PROGRESS' },
          });
        }
      } catch (err: any) {
        this.logger.error(`Failed to relay outbox event ${event.id}: ${err.message}`);
      }
    }
  }
}
