import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Service that wraps database queries to strictly enforce tenantId scoping.
 * Helps prevent cross-tenant database leaks at the application layer.
 */
@Injectable()
export class TenantScopedPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Finds multiple records scoped by tenantId.
   *
   * @param model Name of the model (e.g. 'patient').
   * @param tenantId Target tenant ID.
   * @param args Standard Prisma query arguments.
   */
  async findManyByTenant(model: string, tenantId: string, args: any = {}): Promise<any[]> {
    const where = { ...args.where, tenantId };
    return (this.prisma as any)[model].findMany({ ...args, where });
  }

  /**
   * Finds a single record scoped by tenantId.
   * Uses findFirst internally instead of findUnique to allow filtering by tenantId.
   *
   * @param model Name of the model.
   * @param tenantId Target tenant ID.
   * @param args Standard Prisma query arguments.
   */
  async findUniqueByTenant(model: string, tenantId: string, args: any = {}): Promise<any | null> {
    const where = { ...args.where, tenantId };
    return (this.prisma as any)[model].findFirst({ ...args, where });
  }

  /**
   * Creates a record scoped by tenantId.
   *
   * @param model Name of the model.
   * @param tenantId Target tenant ID.
   * @param args Standard Prisma query arguments.
   */
  async createForTenant(model: string, tenantId: string, args: any = {}): Promise<any> {
    const data = { ...args.data, tenantId };
    return (this.prisma as any)[model].create({ ...args, data });
  }

  /**
   * Updates records matching a condition, scoped by tenantId.
   * Uses updateMany to allow filtering by tenantId safely.
   *
   * @param model Name of the model.
   * @param tenantId Target tenant ID.
   * @param args Standard Prisma query arguments.
   */
  async updateByTenant(model: string, tenantId: string, args: any = {}): Promise<any> {
    const where = { ...args.where, tenantId };
    return (this.prisma as any)[model].updateMany({ ...args, where });
  }

  /**
   * Deletes records matching a condition, scoped by tenantId.
   * Uses deleteMany to prevent unauthorized deletions.
   *
   * @param model Name of the model.
   * @param tenantId Target tenant ID.
   * @param args Standard Prisma query arguments.
   */
  async deleteByTenant(model: string, tenantId: string, args: any = {}): Promise<any> {
    const where = { ...args.where, tenantId };
    return (this.prisma as any)[model].deleteMany({ ...args, where });
  }
}
