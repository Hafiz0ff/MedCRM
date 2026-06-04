import { Injectable } from '@nestjs/common';
import { TenantScopedPrismaService } from '../tenant-scoped-prisma.service';

/**
 * Repository to manage database access for the Encounter model.
 * All queries are strictly scoped by tenantId.
 */
@Injectable()
export class EncounterRepository {
  constructor(private readonly scopedDb: TenantScopedPrismaService) {}

  async findMany(tenantId: string, args: any = {}) {
    return this.scopedDb.findManyByTenant('encounter', tenantId, args);
  }

  async findFirst(tenantId: string, args: any = {}) {
    return this.scopedDb.findUniqueByTenant('encounter', tenantId, args);
  }

  async create(tenantId: string, args: any = {}) {
    return this.scopedDb.createForTenant('encounter', tenantId, args);
  }

  async update(tenantId: string, args: any = {}) {
    return this.scopedDb.updateByTenant('encounter', tenantId, args);
  }

  async delete(tenantId: string, args: any = {}) {
    return this.scopedDb.deleteByTenant('encounter', tenantId, args);
  }
}
