import { REDIS_CLIENT } from '@core/cache/redis.module';
import { PrismaService } from '@core/database/prisma.service';
import { QueueNames } from '@core/queue/queue-names';
import { QueueService } from '@core/queue/queue.module';
import { Injectable, OnModuleInit, Logger, Inject } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';

@Injectable()
export class KpiHourlyWorker implements OnModuleInit {
  private readonly logger = new Logger(KpiHourlyWorker.name);
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
      QueueNames.KPI_HOURLY_AGGREGATE_TRIGGER,
      async (job: Job) => {
        await this.aggregateHourlyMetrics();
      },
      { connection, concurrency: 1 },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Hourly KPI trigger job failed: ${err.message}`);
    });

    const queue = this.queueService.getQueue(QueueNames.KPI_HOURLY_AGGREGATE_TRIGGER);

    // Clear old repeatable schedules
    const schedulers = await queue.getRepeatableJobs();
    for (const s of schedulers) {
      await queue.removeRepeatableByKey(s.key);
    }

    // Run every hour
    await queue.add(
      'aggregate-hourly-kpi',
      {},
      {
        repeat: { every: 3600000 }, // every 1 hour
        removeOnComplete: true,
        removeOnFail: true,
      },
    );

    this.logger.log('Hourly KPI Worker initialized. Scheduled hourly repeatable aggregations.');
  }

  /**
   * Aggregate active queue and occupancy counts.
   */
  async aggregateHourlyMetrics(): Promise<void> {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const activeTenants = await this.prisma.tenant.findMany({
      where: { status: 'active' },
    });

    for (const tenant of activeTenants) {
      try {
        this.logger.log(`Running hourly queue aggregates for tenant ${tenant.id}...`);

        // 1. Calculate active checked-in patients in waiting room
        const checkedInCount = await this.prisma.appointment.count({
          where: {
            tenantId: tenant.id,
            startAt: { gte: startOfToday },
            status: 'CHECKED_IN',
          },
        });

        // 2. Calculate active in-progress appointments (doctor occupancy)
        const inProgressCount = await this.prisma.appointment.count({
          where: {
            tenantId: tenant.id,
            startAt: { gte: startOfToday },
            status: 'IN_PROGRESS',
          },
        });

        // 3. Update RealtimeMetricCache
        await this.prisma.realtimeMetricCache.upsert({
          where: {
            tenantId_metricCode: {
              tenantId: tenant.id,
              metricCode: 'waiting_room_count',
            },
          },
          update: {
            metricValue: String(checkedInCount),
            updatedAt: new Date(),
          },
          create: {
            tenantId: tenant.id,
            metricCode: 'waiting_room_count',
            metricValue: String(checkedInCount),
          },
        });

        await this.prisma.realtimeMetricCache.upsert({
          where: {
            tenantId_metricCode: {
              tenantId: tenant.id,
              metricCode: 'active_occupancy_count',
            },
          },
          update: {
            metricValue: String(inProgressCount),
            updatedAt: new Date(),
          },
          create: {
            tenantId: tenant.id,
            metricCode: 'active_occupancy_count',
            metricValue: String(inProgressCount),
          },
        });

        // 4. Publish real-time sync update via Redis Pub/Sub
        await this.redis.publish(
          `realtime-sync:${tenant.id}`,
          JSON.stringify({
            event: 'operations:update',
            tenantId: tenant.id,
            data: {
              waitingRoom: checkedInCount,
              activeOccupancy: inProgressCount,
              timestamp: new Date().toISOString(),
            },
          }),
        );

        this.logger.log(
          `Hourly aggregates successfully computed and published for tenant ${tenant.id}. Waiting: ${checkedInCount}`,
        );
      } catch (err: any) {
        this.logger.error(`Hourly aggregation failed for tenant ${tenant.id}: ${err.message}`);
      }
    }
  }
}
