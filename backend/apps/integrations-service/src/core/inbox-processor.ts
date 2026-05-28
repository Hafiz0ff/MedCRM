import { PrismaService } from '@core/database/prisma.service';
import { NatsPublisher } from '@core/eventbus/nats.publisher';
import { Injectable, Logger } from '@nestjs/common';
import { AdapterRegistry } from './adapter-registry';

@Injectable()
export class InboxProcessor {
  private readonly logger = new Logger(InboxProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: AdapterRegistry,
    private readonly natsPublisher: NatsPublisher,
  ) {}

  async processInbound(
    tenantId: string,
    providerId: string,
    externalId: string,
    messageType: string,
    payloadRaw: string,
    payloadJson: any,
  ): Promise<any> {
    const startTime = Date.now();

    // 1. Check for duplicates
    const duplicate = await this.prisma.integrationInbox.findUnique({
      where: {
        providerId_externalId: {
          providerId,
          externalId,
        },
      },
    });

    if (duplicate) {
      this.logger.log(
        `Duplicate inbound message detected: providerId=${providerId}, externalId=${externalId}. Skipping.`,
      );
      return duplicate;
    }

    // 2. Create Inbox message stub
    const inboxMsg = await this.prisma.integrationInbox.create({
      data: {
        tenantId,
        providerId,
        externalId,
        messageType,
        payloadRaw,
        payloadJson: payloadJson as any,
        status: 'RECEIVED',
      },
    });

    // 3. Resolve provider & adapter
    const provider = await this.prisma.integrationProvider.findUnique({
      where: { id: providerId },
    });

    if (!provider || !provider.isActive) {
      await this.prisma.integrationInbox.update({
        where: { id: inboxMsg.id },
        data: {
          status: 'IGNORED',
          lastError: 'Provider not found or inactive',
        },
      });
      return inboxMsg;
    }

    const adapter = this.registry.get(provider.providerCode);
    if (!adapter || !adapter.receiveInbox) {
      // If no custom adapter processing is registered, mark as processed
      await this.prisma.integrationInbox.update({
        where: { id: inboxMsg.id },
        data: {
          status: 'PROCESSED',
          processedAt: new Date(),
        },
      });
      return inboxMsg;
    }

    try {
      const adapterContext = {
        tenantId,
        providerId,
        logger: new Logger(`${adapter.kind}-adapter`),
        prisma: this.prisma,
        publishDomainEvent: async (subject: string, data: any) => {
          await this.natsPublisher.publish(subject, tenantId, subject, data, {
            correlationId: inboxMsg.id,
          });
        },
      };

      // Process with adapter
      const domainEvents = await adapter.receiveInbox(payloadJson || payloadRaw, adapterContext);

      // Publish resulting domain events
      if (domainEvents && Array.isArray(domainEvents)) {
        for (const event of domainEvents) {
          await this.natsPublisher.publish(event.subject, tenantId, event.subject, event.data, {
            correlationId: inboxMsg.id,
          });
        }
      }

      await this.prisma.integrationInbox.update({
        where: { id: inboxMsg.id },
        data: {
          status: 'PROCESSED',
          processedAt: new Date(),
        },
      });

      // Log success transaction
      await this.prisma.integrationLog.create({
        data: {
          tenantId,
          providerId,
          direction: 'INBOUND',
          requestPayload: payloadJson as any,
          responsePayload: { success: true, processedAt: new Date() } as any,
          statusCode: 200,
          executionTimeMs: Date.now() - startTime,
          correlationId: inboxMsg.id,
        },
      });
    } catch (err: any) {
      this.logger.error(`Error processing inbound message: ${err.message}`, err.stack);
      await this.prisma.integrationInbox.update({
        where: { id: inboxMsg.id },
        data: {
          status: 'FAILED',
          lastError: err.message,
        },
      });

      // Log failure transaction
      await this.prisma.integrationLog.create({
        data: {
          tenantId,
          providerId,
          direction: 'INBOUND',
          requestPayload: payloadJson as any,
          responsePayload: { success: false, error: err.message } as any,
          statusCode: 500,
          executionTimeMs: Date.now() - startTime,
          correlationId: inboxMsg.id,
        },
      });
    }

    return inboxMsg;
  }
}
