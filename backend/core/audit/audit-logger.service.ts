import { PrismaService } from '@core/database/prisma.service';
import { AuditChainService } from '@core/security/audit-chain.service';
import { TenantContextService } from '@core/tenancy/tenant-context.service';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export type AuditEventInput = {
  tenantId: string;
  branchId?: string;
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  oldValuesJson?: Prisma.InputJsonValue;
  newValuesJson?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class AuditLoggerService {
  private readonly logger = new Logger(AuditLoggerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly auditChain: AuditChainService,
  ) {}

  async log(input: AuditEventInput): Promise<void> {
    const context = this.tenantContext.get();
    const createdAt = new Date();

    // Write structured JSON log to console
    const structuredPayload = {
      timestamp: createdAt.toISOString(),
      level: 'INFO',
      requestId: context.requestId,
      correlationId: context.requestId,
      tenantId: input.tenantId,
      branchId: input.branchId,
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    };

    this.logger.log(JSON.stringify(structuredPayload));

    try {
      // Retrieve the last audit log hash to link the chain
      const lastLog = await this.prisma.auditLog.findFirst({
        orderBy: { createdAt: 'desc' },
      });
      const prevHash = lastLog ? lastLog.hash : null;

      // Compute cryptographically linked hash for the current record
      const hash = this.auditChain.computeHash(prevHash, {
        tenantId: input.tenantId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        userId: input.userId,
        requestId: context.requestId || 'system',
        createdAt,
      });

      await this.prisma.auditLog.create({
        data: {
          tenantId: input.tenantId,
          branchId: input.branchId,
          userId: input.userId,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          oldValuesJson: input.oldValuesJson ?? undefined,
          newValuesJson: input.newValuesJson ?? undefined,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          requestId: context.requestId || 'system',
          createdAt,
          prevHash,
          hash,
        },
      });
    } catch (error: any) {
      const errPayload = {
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        requestId: context.requestId,
        action: 'audit.failed',
        message: `Failed to write audit event ${input.action}: ${error.message}`,
      };
      this.logger.error(JSON.stringify(errPayload));
    }
  }

  logEvent(
    level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG',
    action: string,
    message: string,
    extra: any = {},
  ): void {
    const context = this.tenantContext.get();
    const logPayload = {
      timestamp: new Date().toISOString(),
      level,
      requestId: context.requestId,
      correlationId: context.requestId,
      action,
      message,
      ...extra,
    };
    const serialized = JSON.stringify(logPayload);
    if (level === 'ERROR') this.logger.error(serialized);
    else if (level === 'WARN') this.logger.warn(serialized);
    else if (level === 'DEBUG') this.logger.debug(serialized);
    else this.logger.log(serialized);
  }
}
