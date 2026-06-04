import { Injectable } from '@nestjs/common';
import { TenantScopedPrismaService } from '../tenant-scoped-prisma.service';

/**
 * Repository to manage database access for the Payment model.
 * All queries are strictly scoped by tenantId.
 */
@Injectable()
export class PaymentRepository {
  constructor(private readonly scopedDb: TenantScopedPrismaService) {}

  async findMany(tenantId: string, args: any = {}) {
    return this.scopedDb.findManyByTenant('payment', tenantId, args);
  }

  async findFirst(tenantId: string, args: any = {}) {
    return this.scopedDb.findUniqueByTenant('payment', tenantId, args);
  }

  async create(tenantId: string, args: any = {}) {
    return this.scopedDb.createForTenant('payment', tenantId, args);
  }

  async update(tenantId: string, args: any = {}) {
    return this.scopedDb.updateByTenant('payment', tenantId, args);
  }

  async delete(tenantId: string, args: any = {}) {
    return this.scopedDb.deleteByTenant('payment', tenantId, args);
  }
}
