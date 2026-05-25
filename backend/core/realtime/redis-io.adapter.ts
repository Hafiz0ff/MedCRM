import { INestApplicationContext, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { ServerOptions } from 'socket.io';

export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor?: ReturnType<typeof createAdapter>;

  constructor(private readonly appContext: INestApplicationContext) {
    super(appContext);
  }

  async connectToRedis(): Promise<void> {
    const config = this.appContext.get(ConfigService);
    const redisUrl = config.get<string>('REDIS_URL', 'redis://localhost:6379');
    const pubClient = new Redis(redisUrl);
    const subClient = pubClient.duplicate();
    await Promise.all([
      pubClient.connect().catch(() => undefined),
      subClient.connect().catch(() => undefined),
    ]);
    this.adapterConstructor = createAdapter(pubClient, subClient);
    this.logger.log('Socket.IO Redis adapter enabled');
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: true,
        credentials: true,
      },
    });
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
