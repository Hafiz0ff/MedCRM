import { AuditLoggerService } from '@core/audit/audit-logger.service';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Metadata about the incoming client request.
 */
export type RequestMetadata = {
  ipAddress?: string;
  userAgent?: string | string[];
};

/**
 * Service to handle audit logging for authentication events.
 */
@Injectable()
export class AuthAuditService {
  constructor(private readonly audit: AuditLoggerService) {}

  /**
   * Formats the User-Agent header value into a single string.
   */
  userAgent(metadata: RequestMetadata): string | undefined {
    if (!metadata.userAgent) {
      return undefined;
    }
    return Array.isArray(metadata.userAgent) ? metadata.userAgent.join(', ') : metadata.userAgent;
  }

  /**
   * Logs an authentication audit event.
   */
  async log(payload: {
    tenantId: string;
    userId?: string;
    action: string;
    ipAddress?: string;
    userAgent?: string;
    newValuesJson?: Prisma.InputJsonValue;
    oldValuesJson?: Prisma.InputJsonValue;
  }): Promise<void> {
    await this.audit.log(payload);
  }
}
