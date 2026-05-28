import { PrismaService } from '@core/database/prisma.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class IdMapperService {
  constructor(private readonly prisma: PrismaService) {}

  async mapId(
    tenantId: string,
    providerId: string,
    entityType: string,
    internalId: string,
    externalId: string,
  ): Promise<any> {
    return this.prisma.externalIdMap.upsert({
      where: {
        providerId_entityType_externalId: {
          providerId,
          entityType,
          externalId,
        },
      },
      create: {
        tenantId,
        providerId,
        entityType,
        internalId,
        externalId,
      },
      update: {
        internalId,
      },
    });
  }

  async getExternalId(
    providerId: string,
    entityType: string,
    internalId: string,
  ): Promise<string | null> {
    const map = await this.prisma.externalIdMap.findFirst({
      where: {
        providerId,
        entityType,
        internalId,
      },
    });
    return map ? map.externalId : null;
  }

  async getInternalId(
    providerId: string,
    entityType: string,
    externalId: string,
  ): Promise<string | null> {
    const map = await this.prisma.externalIdMap.findUnique({
      where: {
        providerId_entityType_externalId: {
          providerId,
          entityType,
          externalId,
        },
      },
    });
    return map ? map.internalId : null;
  }
}
