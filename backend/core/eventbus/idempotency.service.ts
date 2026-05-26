import { REDIS_CLIENT } from '@core/cache/redis.module';
import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class IdempotencyService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /**
   * Checks if an event has already been processed by a consumer.
   * If not, sets a key with a TTL of 7 days (604800 seconds) and returns false.
   * If the event was already processed, returns true.
   */
  async isDuplicate(consumerName: string, eventId: string): Promise<boolean> {
    const key = `idempotency:${consumerName}:${eventId}`;
    // Set if not exists (NX) with expiration (EX) of 7 days
    const result = await this.redis.set(key, '1', 'EX', 604800, 'NX');
    return result === null;
  }

  /**
   * Explicitly marks an event as processed with a TTL of 7 days.
   */
  async markProcessed(consumerName: string, eventId: string): Promise<void> {
    const key = `idempotency:${consumerName}:${eventId}`;
    await this.redis.set(key, '1', 'EX', 604800);
  }
}
