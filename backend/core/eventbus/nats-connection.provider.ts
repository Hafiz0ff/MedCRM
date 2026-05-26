import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { connect, NatsConnection, JetStreamClient, JetStreamManager, RetentionPolicy } from 'nats';

@Injectable()
export class NatsConnectionProvider implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NatsConnectionProvider.name);
  private nc!: NatsConnection;
  private jsClient!: JetStreamClient;

  async onModuleInit() {
    const natsUrl = process.env.NATS_URL || 'nats://localhost:4222';
    this.logger.log(`Connecting to NATS at ${natsUrl}...`);
    try {
      this.nc = await connect({
        servers: natsUrl,
        reconnect: true,
        maxReconnectAttempts: -1, // retry indefinitely
        reconnectTimeWait: 2000,
      });
      this.jsClient = this.nc.jetstream();
      this.logger.log('Successfully connected to NATS.');

      await this.provisionStreams();
    } catch (err: any) {
      this.logger.error(`Failed to initialize NATS connection: ${err.message}`, err.stack);
      throw err;
    }
  }

  async onModuleDestroy() {
    if (this.nc) {
      this.logger.log('Closing NATS connection...');
      await this.nc.close();
    }
  }

  getConnection(): NatsConnection {
    return this.nc;
  }

  getJetStream(): JetStreamClient {
    return this.jsClient;
  }

  private async provisionStreams() {
    try {
      const jsm = await this.nc.jetstreamManager();
      const streams = [
        'auth',
        'scheduling',
        'finance',
        'emr',
        'communications',
        'inventory',
        'analytics',
      ];

      for (const streamName of streams) {
        try {
          await jsm.streams.info(streamName);
          this.logger.log(`Stream "${streamName}" already exists.`);
        } catch (err: any) {
          // Stream info fails if not found, we capture code/message
          const isNotFound =
            err.message?.toLowerCase().includes('not found') ||
            err.code === 404 ||
            err.api_error?.code === 10059;
          if (isNotFound) {
            this.logger.log(`Stream "${streamName}" not found. Creating...`);
            await jsm.streams.add({
              name: streamName,
              subjects: [`${streamName}.v1.>`],
              retention: RetentionPolicy.Limits,
              max_age: 30 * 24 * 60 * 60 * 1000 * 1000 * 1000, // 30 days in nanoseconds
            });
            this.logger.log(`Stream "${streamName}" created successfully.`);
          } else {
            this.logger.warn(`Error checking stream "${streamName}": ${err.message}`);
          }
        }
      }
    } catch (err: any) {
      this.logger.error(`Failed to provision NATS streams: ${err.message}`, err.stack);
    }
  }
}
