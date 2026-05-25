import { PrismaService } from '@core/database/prisma.service';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Injectable()
export class OutboxService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Saves an integration event to the transactional outbox table.
   * If a Prisma transaction client (tx) is provided, writes within that transaction scope.
   */
  async publish(
    tenantId: string,
    eventType: string,
    aggregateType: string,
    aggregateId: string,
    payload: Record<string, any>,
    tx?: Prisma.TransactionClient,
  ): Promise<any> {
    const client = tx || this.prisma;

    return client.integrationOutbox.create({
      data: {
        tenantId,
        eventType,
        aggregateType,
        aggregateId,
        payloadJson: payload as any,
        state: 'PENDING',
      },
    });
  }
}
