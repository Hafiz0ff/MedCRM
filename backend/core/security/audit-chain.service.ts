import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

export interface AuditLogCanonicalData {
  tenantId: string;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  userId?: string | null;
  requestId: string;
  createdAt: Date;
}

@Injectable()
export class AuditChainService {
  private readonly logger = new Logger(AuditChainService.name);
  private readonly rawPrisma = new PrismaClient();

  /**
   * Computes the SHA-256 hash of an audit log record cryptographically linked to the previous hash.
   */
  computeHash(prevHash: string | null, record: AuditLogCanonicalData): string {
    const parts = [
      prevHash || '',
      record.tenantId,
      record.action,
      record.entityType || '',
      record.entityId || '',
      record.userId || '',
      record.requestId,
      record.createdAt.toISOString(),
    ];
    const canonicalString = parts.join('|');
    return createHash('sha256').update(canonicalString).digest('hex');
  }

  /**
   * Verifies the entire audit trail integrity for a specific tenant or globally.
   * Returns a report containing verification status and details on any detected tampering.
   */
  async verifyChain(
    tenantId?: string,
  ): Promise<{ success: boolean; totalChecked: number; message: string }> {
    const logs = await this.rawPrisma.auditLog.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        hash: { not: null },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (logs.length === 0) {
      return { success: true, totalChecked: 0, message: 'No chained logs found to verify.' };
    }

    let prevHash: string | null = null;

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];

      // Check if prevHash matches our computed link
      if (log.prevHash !== prevHash) {
        return {
          success: false,
          totalChecked: i,
          message: `Tampering detected at log entry ID ${log.id}! Expected prevHash to be '${prevHash}', but found '${log.prevHash}'.`,
        };
      }

      // Recompute hash and verify
      const computedHash = this.computeHash(prevHash, {
        tenantId: log.tenantId,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        userId: log.userId,
        requestId: log.requestId,
        createdAt: log.createdAt,
      });

      if (log.hash !== computedHash) {
        return {
          success: false,
          totalChecked: i,
          message: `Tampering detected! Recomputed hash for ID ${log.id} does not match database hash. Computed: '${computedHash}', DB: '${log.hash}'.`,
        };
      }

      prevHash = log.hash;
    }

    return {
      success: true,
      totalChecked: logs.length,
      message: `Audit trail verified successfully! ${logs.length} entries checked with zero modifications.`,
    };
  }
}
