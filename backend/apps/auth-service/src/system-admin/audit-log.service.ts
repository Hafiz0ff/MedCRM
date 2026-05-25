import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@core/database/prisma.service';
import { AuthenticatedUser } from '@core/security/jwt-payload';
import { AuditLogQueryDto } from './dto/audit-log.dto';

/**
 * Read-only access to the audit_logs table, scoped to the caller's tenant.
 * Supports filtering by action / actor / entity / branch / date range with
 * keyset-friendly pagination via page+pageSize.
 */
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthenticatedUser, query: AuditLogQueryDto) {
    const where: Prisma.AuditLogWhereInput = {
      tenantId: user.tenantId,
      ...(query.action ? { action: query.action } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {})
            }
          }
        : {})
    };

    const page = query.page;
    const pageSize = query.pageSize;
    const skip = (page - 1) * pageSize;

    const [total, items] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          user: { select: { id: true, email: true } }
        }
      })
    ]);

    return {
      page,
      pageSize,
      total,
      items: items.map((row) => ({
        id: row.id,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        userId: row.userId,
        userEmail: row.user?.email ?? null,
        branchId: row.branchId,
        ipAddress: row.ipAddress,
        userAgent: row.userAgent,
        requestId: row.requestId,
        oldValuesJson: row.oldValuesJson,
        newValuesJson: row.newValuesJson,
        createdAt: row.createdAt
      }))
    };
  }
}
