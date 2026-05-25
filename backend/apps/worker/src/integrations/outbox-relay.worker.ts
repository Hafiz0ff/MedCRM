import { REDIS_CLIENT } from '@core/cache/redis.module';
import { PrismaService } from '@core/database/prisma.service';
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
   * Queries pending events in the integration_outbox table and pushes them into BullMQ.
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

    this.logger.log(`Found ${pendingEvents.length} pending outbox events. Relaying to queue...`);

    for (const event of pendingEvents) {
      try {
        // Enqueue individual dispatch job in integrations.outbox queue
        // Use stable jobId = event.id to guarantee deduplication / idempotency
        await this.queueService.addJob(
          QueueNames.INTEGRATIONS_OUTBOX,
          event.eventType,
          {
            eventId: event.id,
            tenantId: event.tenantId,
            eventType: event.eventType,
            aggregateType: event.aggregateType,
            aggregateId: event.aggregateId,
            payloadJson: event.payloadJson,
          },
          event.id,
        );

        // Update database record to IN_PROGRESS so it is not processed twice
        await this.prisma.integrationOutbox.update({
          where: { id: event.id },
          data: { state: 'IN_PROGRESS' },
        });
      } catch (err: any) {
        this.logger.error(`Failed to relay outbox event ${event.id}: ${err.message}`);
      }
    }
  }
}
