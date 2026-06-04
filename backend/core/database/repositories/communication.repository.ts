import { Injectable } from '@nestjs/common';
import { TenantScopedPrismaService } from '../tenant-scoped-prisma.service';

/**
 * Repository to manage database access for the Communication model.
 * All queries are strictly scoped by tenantId.
 */
@Injectable()
export class CommunicationRepository {
  constructor(private readonly scopedDb: TenantScopedPrismaService) {}

  async findMany(tenantId: string, args: any = {}) {
    return this.scopedDb.findManyByTenant('communication', tenantId, args);
  }

  async findFirst(tenantId: string, args: any = {}) {
    return this.scopedDb.findUniqueByTenant('communication', tenantId, args);
  }

  async create(tenantId: string, args: any = {}) {
    return this.scopedDb.createForTenant('communication', tenantId, args);
  }

  async update(tenantId: string, args: any = {}) {
    return this.scopedDb.updateByTenant('communication', tenantId, args);
  }

  async delete(tenantId: string, args: any = {}) {
    return this.scopedDb.deleteByTenant('communication', tenantId, args);
  }
}
