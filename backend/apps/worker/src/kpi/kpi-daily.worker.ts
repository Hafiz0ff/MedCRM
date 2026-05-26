import { REDIS_CLIENT } from '@core/cache/redis.module';
import { PrismaService } from '@core/database/prisma.service';
import { QueueNames } from '@core/queue/queue-names';
import { QueueService } from '@core/queue/queue.module';
import { Injectable, OnModuleInit, Logger, Inject } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Worker, Job, type ConnectionOptions } from 'bullmq';
import Redis from 'ioredis';

@Injectable()
export class KpiDailyWorker implements OnModuleInit {
  private readonly logger = new Logger(KpiDailyWorker.name);
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
      QueueNames.KPI_DAILY_AGGREGATE_TRIGGER,
      async (job: Job) => {
        await this.aggregateDailyMetrics();
      },
      { connection: connection as unknown as ConnectionOptions, concurrency: 1 },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Daily KPI trigger job failed: ${err.message}`);
    });

    const queue = this.queueService.getQueue(QueueNames.KPI_DAILY_AGGREGATE_TRIGGER);

    // Clear old repeatable schedules
    const schedulers = await queue.getRepeatableJobs();
    for (const s of schedulers) {
      await queue.removeRepeatableByKey(s.key);
    }

    // Run every day at 01:00 AM
    await queue.add(
      'aggregate-kpi',
      {},
      {
        repeat: { pattern: '0 1 * * *' },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );

    this.logger.log('Daily KPI Worker initialized. Scheduled daily 01:00 AM aggregations.');
  }

  /**
   * Run calculations and aggregate metrics.
   */
  async aggregateDailyMetrics(): Promise<void> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const activeTenants = await this.prisma.tenant.findMany({
      where: { status: 'active' },
    });

    for (const tenant of activeTenants) {
      try {
        this.logger.log(`Running daily financial aggregation for tenant ${tenant.id}...`);

        // Compute total revenue of all invoices paid yesterday
        const invoicePayments = await this.prisma.payment.findMany({
          where: {
            tenantId: tenant.id,
            createdAt: {
              gte: yesterday,
              lt: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000),
            },
          },
        });

        const totalRevenue = invoicePayments.reduce((sum, p) => sum + Number(p.amount), 0);
        const refundPayments = await this.prisma.refund.findMany({
          where: {
            tenantId: tenant.id,
            refundedAt: {
              gte: yesterday,
              lt: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000),
            },
          },
        });
        const totalRefunds = refundPayments.reduce((sum, r) => sum + Number(r.refundAmount), 0);

        // Count invoices to calculate average check
        const totalInvoicesCount = await this.prisma.invoice.count({
          where: {
            tenantId: tenant.id,
            createdAt: {
              gte: yesterday,
              lt: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000),
            },
          },
        });

        const averageCheck = totalInvoicesCount > 0 ? totalRevenue / totalInvoicesCount : 0;

        // Perform safe idempotent upsert
        await this.prisma.financialDailyAggregate.upsert({
          where: {
            tenantId_branchId_aggregationDate: {
              tenantId: tenant.id,
              branchId: null as any, // scoped at tenant-level
              aggregationDate: yesterday,
            },
          },
          update: {
            totalRevenue: new Prisma.Decimal(totalRevenue),
            totalRefunds: new Prisma.Decimal(totalRefunds),
            averageCheck: new Prisma.Decimal(averageCheck),
          },
          create: {
            tenantId: tenant.id,
            branchId: null as any,
            aggregationDate: yesterday,
            totalRevenue: new Prisma.Decimal(totalRevenue),
            totalProfit: new Prisma.Decimal(totalRevenue - totalRefunds),
            totalExpenses: new Prisma.Decimal(0),
            totalRefunds: new Prisma.Decimal(totalRefunds),
            averageCheck: new Prisma.Decimal(averageCheck),
            outstandingDebt: new Prisma.Decimal(0),
          },
        });

        this.logger.log(
          `Daily aggregation successfully committed for tenant ${tenant.id}. Revenue: ${totalRevenue}`,
        );
      } catch (err: any) {
        this.logger.error(`Daily aggregation failed for tenant ${tenant.id}: ${err.message}`);
      }
    }
  }
}
