import { REDIS_CLIENT } from '@core/cache/redis.module';
import { Global, Inject, Injectable, Module, OnApplicationShutdown } from '@nestjs/common';
import { Queue, type ConnectionOptions } from 'bullmq';
import Redis from 'ioredis';
import { QueueNames } from './queue-names';

@Injectable()
export class QueueService implements OnApplicationShutdown {
  private readonly queues = new Map<string, Queue>();
  private connection?: Redis;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private getConnection(): Redis {
    if (!this.connection) {
      // Duplicate standard ioredis connection and disable retry limits as required by BullMQ
      this.connection = this.redis.duplicate({ maxRetriesPerRequest: null });
    }
    return this.connection;
  }

  getQueue(queueName: QueueNames): Queue {
    let queue = this.queues.get(queueName);
    if (!queue) {
      queue = new Queue(queueName, {
        connection: this.getConnection() as unknown as ConnectionOptions,
        defaultJobOptions: {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 30000,
          },
          removeOnComplete: { count: 1000 },
          removeOnFail: { count: 5000 },
        },
      });
      this.queues.set(queueName, queue);
    }
    return queue;
  }

  async addJob<T>(
    queueName: QueueNames,
    jobName: string,
    payload: T,
    jobId?: string,
    delayMs?: number,
  ): Promise<any> {
    const queue = this.getQueue(queueName);
    return queue.add(jobName, payload, {
      jobId,
      ...(delayMs ? { delay: delayMs } : {}),
    });
  }

  async onApplicationShutdown() {
    // Close all instantiated queues
    for (const queue of this.queues.values()) {
      try {
        await queue.close();
      } catch (err) {
        console.error(`Failed to close queue ${queue.name}:`, err);
      }
    }
    this.queues.clear();

    // Quit duplicated connection
    if (this.connection) {
      try {
        await this.connection.quit();
      } catch {
        this.connection.disconnect();
      }
    }
  }
}

@Global()
@Module({
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
