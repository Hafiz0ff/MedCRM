import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { JSONCodec } from 'nats';
import { EventEnvelope } from './event-envelope';
import { NatsConnectionProvider } from './nats-connection.provider';

@Injectable()
export class NatsPublisher {
  private readonly logger = new Logger(NatsPublisher.name);
  private readonly codec = JSONCodec();

  constructor(private readonly connectionProvider: NatsConnectionProvider) {}

  /**
   * Publishes a domain event wrapped in a standard EventEnvelope to NATS JetStream.
   */
  async publish<T>(
    subject: string,
    tenantId: string,
    eventType: string,
    payload: T,
    metadata?: { userId?: string; correlationId?: string },
  ): Promise<string> {
    try {
      const js = this.connectionProvider.getJetStream();

      const envelope: EventEnvelope<T> = {
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        tenantId,
        userId: metadata?.userId,
        correlationId: metadata?.correlationId,
        eventType,
        payload,
      };

      const data = this.codec.encode(envelope);
      this.logger.log(
        `Publishing event ${envelope.id} to subject "${subject}" (tenant: ${tenantId})`,
      );

      const pa = await js.publish(subject, data);
      this.logger.log(`Published event ${envelope.id} seq ${pa.seq} to stream "${pa.stream}"`);

      return envelope.id;
    } catch (err: any) {
      this.logger.error(
        `Failed to publish event to subject "${subject}": ${err.message}`,
        err.stack,
      );
      throw err;
    }
  }
}
