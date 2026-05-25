import { DynamicModule, Global, Module, OnApplicationShutdown, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

@Global()
@Module({})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  static forRoot(): DynamicModule {
    return {
      module: RedisModule,
      providers: [
        {
          provide: REDIS_CLIENT,
          inject: [ConfigService],
          useFactory: (config: ConfigService): Redis => {
            const url = config.get<string>('REDIS_URL', 'redis://localhost:6379');
            return new Redis(url, {
              maxRetriesPerRequest: 3,
              enableReadyCheck: true,
            });
          },
        },
      ],
      exports: [REDIS_CLIENT],
    };
  }

  async onApplicationShutdown() {
    try {
      await this.redis.quit();
    } catch {
      this.redis.disconnect();
    }
  }
}
