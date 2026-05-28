import { PrismaService } from '@core/database/prisma.service';
import { Logger } from '@nestjs/common';

export interface AdapterContext {
  tenantId: string;
  providerId: string;
  logger: Logger;
  prisma: PrismaService;
  publishDomainEvent: (subject: string, data: any) => Promise<void>;
}

export interface IntegrationAdapter<TConfig = any> {
  readonly kind: string; // e.g. LIS_HELIX, FISCAL_ATOL, FHIR_GENERIC
  validateConfig(config: any): TConfig;
  testConnection(config: TConfig, secrets: Record<string, string>): Promise<void>;
  sendOutbox?(
    message: { eventType: string; payloadJson: any; aggregateId?: string; aggregateType?: string },
    ctx: AdapterContext,
  ): Promise<{ externalId?: string }>;
  receiveInbox?(payload: any, ctx: AdapterContext): Promise<any[]>;
  buildAdminUi(): any;
}
