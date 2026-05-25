import { REDIS_CLIENT } from '@core/cache/redis.module';
import { PrismaService } from '@core/database/prisma.service';
import { QueueNames } from '@core/queue/queue-names';
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';

type OutboxPayload = {
  eventId: string;
  tenantId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payloadJson: Record<string, any>;
};

@Injectable()
export class OutboxDispatchWorker implements OnModuleInit {
  private readonly logger = new Logger(OutboxDispatchWorker.name);
  private worker!: Worker<OutboxPayload>;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    const connection = this.redis.duplicate({ maxRetriesPerRequest: null });

    this.worker = new Worker<OutboxPayload>(
      QueueNames.INTEGRATIONS_OUTBOX,
      async (job: Job<OutboxPayload>) => {
        await this.processDispatch(job);
      },
      { connection, concurrency: 20 },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.warn(`Outbox job ${job?.id} failed: ${err.message}`);
    });
  }

  private async processDispatch(job: Job<OutboxPayload>): Promise<void> {
    const { eventId, tenantId, eventType, aggregateType, aggregateId, payloadJson } = job.data;
    const startTime = Date.now();

    try {
      const outbox = await this.prisma.integrationOutbox.findUnique({
        where: { id: eventId },
      });

      if (!outbox || outbox.state === 'DONE') {
        return;
      }

      // Simulate sending outbound webhook/HL7/FHIR event
      // Log outbound action in integration_logs
      await this.prisma.integrationLog.create({
        data: {
          tenantId,
          direction: 'OUTBOUND',
          requestPayload: {
            eventType,
            aggregateType,
            aggregateId,
            payload: payloadJson,
          } as any,
          responsePayload: { success: true, message: 'Sandbox dispatch successful' } as any,
          statusCode: 200,
          executionTimeMs: Date.now() - startTime,
          correlationId: eventId,
        },
      });

      // Update DB outbox record to DONE
      await this.prisma.integrationOutbox.update({
        where: { id: eventId },
        data: {
          state: 'DONE',
          processedAt: new Date(),
        },
      });

      this.logger.log(`Outbox event ${eventId} (${eventType}) successfully dispatched.`);
    } catch (err: any) {
      const attempts = job.attemptsMade + 1;
      const state = attempts >= 5 ? 'FAILED' : 'IN_PROGRESS';

      await this.prisma.integrationOutbox.update({
        where: { id: eventId },
        data: {
          attemptCount: attempts,
          lastError: err.message,
          state,
          processedAt: state === 'FAILED' ? new Date() : null,
        },
      });

      throw err; // Re-throw to trigger BullMQ retry logic
    }
  }
}
