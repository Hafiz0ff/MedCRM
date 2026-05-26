import { Injectable, Logger } from '@nestjs/common';
import { JSONCodec, AckPolicy } from 'nats';
import { EventEnvelope } from './event-envelope';
import { IdempotencyService } from './idempotency.service';
import { NatsConnectionProvider } from './nats-connection.provider';

@Injectable()
export class NatsConsumer {
  private readonly logger = new Logger(NatsConsumer.name);
  private readonly codec = JSONCodec();

  constructor(
    private readonly connectionProvider: NatsConnectionProvider,
    private readonly idempotency: IdempotencyService,
  ) {}

  /**
   * Subscribes to a JetStream subject using a pull consumer.
   */
  async subscribe<T>(
    stream: string,
    consumerName: string,
    subject: string,
    handler: (envelope: EventEnvelope<T>) => Promise<void>,
  ): Promise<void> {
    try {
      const nc = this.connectionProvider.getConnection();
      const js = this.connectionProvider.getJetStream();
      const jsm = await nc.jetstreamManager();

      this.logger.log(
        `Ensuring consumer "${consumerName}" exists on stream "${stream}" for subject "${subject}"...`,
      );

      // Ensure the pull consumer is registered in NATS JetStream
      await jsm.consumers.add(stream, {
        durable_name: consumerName,
        ack_policy: AckPolicy.Explicit,
        filter_subject: subject,
      });

      const consumer = await js.consumers.get(stream, consumerName);

      // Start the pull-consume loop in the background
      (async () => {
        const messages = await consumer.consume();
        this.logger.log(
          `Started consume loop for consumer "${consumerName}" on stream "${stream}"`,
        );

        for await (const msg of messages) {
          try {
            const envelope = this.codec.decode(msg.data) as EventEnvelope<T>;

            // Check for duplicate events
            const isDuplicate = await this.idempotency.isDuplicate(consumerName, envelope.id);
            if (isDuplicate) {
              this.logger.warn(
                `Duplicate event ignored: eventId=${envelope.id}, consumer=${consumerName}`,
              );
              msg.ack();
              continue;
            }

            this.logger.log(
              `Processing event ${envelope.id} (${envelope.eventType}) in consumer "${consumerName}"`,
            );
            await handler(envelope);

            // Mark as successfully processed and acknowledge the message
            await this.idempotency.markProcessed(consumerName, envelope.id);
            msg.ack();
          } catch (err: any) {
            this.logger.error(
              `Error handling event in consumer "${consumerName}": ${err.message}`,
              err.stack,
            );
            msg.nak(); // negative acknowledgment triggers redelivery
          }
        }
      })().catch((err: any) => {
        this.logger.error(
          `Consume loop terminated unexpectedly for consumer "${consumerName}": ${err.message}`,
          err.stack,
        );
      });
    } catch (err: any) {
      this.logger.error(
        `Failed to subscribe consumer "${consumerName}" to stream "${stream}": ${err.message}`,
        err.stack,
      );
      throw err;
    }
  }
}
