import { AuditLoggerService } from '@core/audit/audit-logger.service';
import { PrismaService } from '@core/database/prisma.service';
import { AuthenticatedUser } from '@core/security/jwt-payload';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EquipmentDto } from '../dto/organization-structure.schemas';

@Injectable()
export class EquipmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLoggerService,
  ) {}

  async list(user: AuthenticatedUser, branchId?: string) {
    if (branchId) this.assertBranchAccess(user, branchId);

    return this.prisma.equipment.findMany({
      where: {
        tenantId: user.tenantId,
        branchId: branchId ? branchId : { in: user.branchIds },
      },
      include: {
        category: true,
        room: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async get(user: AuthenticatedUser, id: string) {
    const equipment = await this.prisma.equipment.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        category: true,
        room: true,
        roomEquipments: {
          include: { room: true },
          orderBy: { installedAt: 'desc' },
        },
      },
    });

    if (!equipment) throw new NotFoundException('Equipment not found');
    this.assertBranchAccess(user, equipment.branchId);

    return equipment;
  }

  async create(user: AuthenticatedUser, dto: EquipmentDto) {
    this.assertBranchAccess(user, dto.branchId);
    if (dto.roomId) {
      const room = await this.prisma.room.findFirst({
        where: { id: dto.roomId, tenantId: user.tenantId },
      });
      if (!room) throw new NotFoundException('Target room not found');
    }

    const equipment = await this.prisma.equipment.create({
      data: {
        tenantId: user.tenantId,
        branchId: dto.branchId,
        roomId: dto.roomId,
        categoryId: dto.categoryId,
        inventoryNumber: dto.inventoryNumber,
        serialNumber: dto.serialNumber,
        name: dto.name,
        manufacturer: dto.manufacturer,
        model: dto.model,
        purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
        maintenanceDate: dto.maintenanceDate ? new Date(dto.maintenanceDate) : null,
        calibrationDate: dto.calibrationDate ? new Date(dto.calibrationDate) : null,
        status: dto.status,
        isSharedResource: dto.isSharedResource,
      },
    });

    if (dto.roomId) {
      await this.prisma.roomEquipment.create({
        data: {
          roomId: dto.roomId,
          equipmentId: equipment.id,
          installedAt: new Date(),
        },
      });
    }

    await this.audit.log({
      tenantId: user.tenantId,
      branchId: dto.branchId,
      userId: user.userId,
      action: 'equipment.created',
      entityType: 'equipment',
      entityId: equipment.id,
      newValuesJson: equipment,
    });

    return this.get(user, equipment.id);
  }

  async update(user: AuthenticatedUser, id: string, dto: EquipmentDto) {
    const current = await this.get(user, id); // Asserts branch access

    this.assertBranchAccess(user, dto.branchId);
    if (dto.roomId) {
      const room = await this.prisma.room.findFirst({
        where: { id: dto.roomId, tenantId: user.tenantId },
      });
      if (!room) throw new NotFoundException('Target room not found');
    }

    const equipment = await this.prisma.equipment.update({
      where: { id },
      data: {
        branchId: dto.branchId,
        roomId: dto.roomId,
        categoryId: dto.categoryId,
        inventoryNumber: dto.inventoryNumber,
        serialNumber: dto.serialNumber,
        name: dto.name,
        manufacturer: dto.manufacturer,
        model: dto.model,
        purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
        maintenanceDate: dto.maintenanceDate ? new Date(dto.maintenanceDate) : null,
        calibrationDate: dto.calibrationDate ? new Date(dto.calibrationDate) : null,
        status: dto.status,
        isSharedResource: dto.isSharedResource,
      },
    });

    // Sync room history tracking
    if (dto.roomId !== current.roomId) {
      if (current.roomId) {
        await this.prisma.roomEquipment.updateMany({
          where: { roomId: current.roomId, equipmentId: id, removedAt: null },
          data: { removedAt: new Date() },
        });
      }
      if (dto.roomId) {
        await this.prisma.roomEquipment.create({
          data: {
            roomId: dto.roomId,
            equipmentId: id,
            installedAt: new Date(),
          },
        });
      }
    }

    await this.audit.log({
      tenantId: user.tenantId,
      branchId: dto.branchId,
      userId: user.userId,
      action: 'equipment.updated',
      entityType: 'equipment',
      entityId: equipment.id,
      oldValuesJson: current,
      newValuesJson: equipment,
    });

    return this.get(user, equipment.id);
  }

  async delete(user: AuthenticatedUser, id: string) {
    const equipment = await this.get(user, id);

    await this.prisma.equipment.delete({ where: { id } });

    await this.audit.log({
      tenantId: user.tenantId,
      branchId: equipment.branchId,
      userId: user.userId,
      action: 'equipment.deleted',
      entityType: 'equipment',
      entityId: equipment.id,
    });

    return { success: true };
  }

  private assertBranchAccess(user: AuthenticatedUser, branchId: string): void {
    if (!user.branchIds.includes(branchId)) {
      throw new ForbiddenException('Branch access denied');
    }
  }
}
