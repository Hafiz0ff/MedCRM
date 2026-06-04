import { Injectable } from '@nestjs/common';
import { TenantScopedPrismaService } from '../tenant-scoped-prisma.service';

/**
 * Repository to manage database access for the Warehouse model.
 * All queries are strictly scoped by tenantId.
 */
@Injectable()
export class WarehouseRepository {
  constructor(private readonly scopedDb: TenantScopedPrismaService) {}

  async findMany(tenantId: string, args: any = {}) {
    return this.scopedDb.findManyByTenant('warehouse', tenantId, args);
  }

  async findFirst(tenantId: string, args: any = {}) {
    return this.scopedDb.findUniqueByTenant('warehouse', tenantId, args);
  }

  async create(tenantId: string, args: any = {}) {
    return this.scopedDb.createForTenant('warehouse', tenantId, args);
  }

  async update(tenantId: string, args: any = {}) {
    return this.scopedDb.updateByTenant('warehouse', tenantId, args);
  }

  async delete(tenantId: string, args: any = {}) {
    return this.scopedDb.deleteByTenant('warehouse', tenantId, args);
  }
}
