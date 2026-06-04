import { Injectable } from '@nestjs/common';
import { TenantScopedPrismaService } from '../tenant-scoped-prisma.service';

/**
 * Repository to manage database access for the Invoice model.
 * All queries are strictly scoped by tenantId.
 */
@Injectable()
export class InvoiceRepository {
  constructor(private readonly scopedDb: TenantScopedPrismaService) {}

  async findMany(tenantId: string, args: any = {}) {
    return this.scopedDb.findManyByTenant('invoice', tenantId, args);
  }

  async findFirst(tenantId: string, args: any = {}) {
    return this.scopedDb.findUniqueByTenant('invoice', tenantId, args);
  }

  async create(tenantId: string, args: any = {}) {
    return this.scopedDb.createForTenant('invoice', tenantId, args);
  }

  async update(tenantId: string, args: any = {}) {
    return this.scopedDb.updateByTenant('invoice', tenantId, args);
  }

  async delete(tenantId: string, args: any = {}) {
    return this.scopedDb.deleteByTenant('invoice', tenantId, args);
  }
}
