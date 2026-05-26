import { PrismaService } from '@core/database/prisma.service';
import { SchedulingPrismaService } from '@core/database/scheduling-prisma.service';
import { AuthenticatedUser } from '@core/security/jwt-payload';
import { Injectable, NotFoundException } from '@nestjs/common';
import {
  SpecialtyDto,
  PositionDto,
  RoomTypeDto,
  EquipmentCategoryDto,
} from '../dto/organization-structure.schemas';

@Injectable()
export class DirectoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schedulingPrisma: SchedulingPrismaService,
  ) {}

  // Specialties
  async listSpecialties() {
    return this.prisma.specialty.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async createSpecialty(dto: SpecialtyDto) {
    return this.prisma.specialty.create({
      data: {
        code: dto.code,
        name: dto.name,
        internationalCode: dto.internationalCode,
        isSystem: dto.isSystem,
      },
    });
  }

  async deleteSpecialty(id: string) {
    const specialty = await this.prisma.specialty.findUnique({ where: { id } });
    if (!specialty) throw new NotFoundException('Specialty not found');
    if (specialty.isSystem) throw new Error('Cannot delete system specialty');
    return this.prisma.specialty.delete({ where: { id } });
  }

  // Positions
  async listPositions(user: AuthenticatedUser) {
    return this.prisma.position.findMany({
      where: { OR: [{ tenantId: null }, { tenantId: user.tenantId }] },
      orderBy: { name: 'asc' },
    });
  }

  async createPosition(user: AuthenticatedUser, dto: PositionDto) {
    return this.prisma.position.create({
      data: {
        tenantId: user.tenantId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        isMedicalStaff: dto.isMedicalStaff,
        isSystem: dto.isSystem,
        isActive: dto.isActive,
      },
    });
  }

  async deletePosition(user: AuthenticatedUser, id: string) {
    const position = await this.prisma.position.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!position) throw new NotFoundException('Position not found');
    if (position.isSystem) throw new Error('Cannot delete system position');
    return this.prisma.position.delete({ where: { id } });
  }

  // Room Types
  async listRoomTypes(user: AuthenticatedUser) {
    return this.schedulingPrisma.roomType.findMany({
      where: { OR: [{ tenantId: null }, { tenantId: user.tenantId }] },
      orderBy: { name: 'asc' },
    });
  }

  async createRoomType(user: AuthenticatedUser, dto: RoomTypeDto) {
    return this.schedulingPrisma.roomType.create({
      data: {
        tenantId: user.tenantId,
        code: dto.code,
        name: dto.name,
        color: dto.color,
        isSystem: dto.isSystem,
      },
    });
  }

  async deleteRoomType(user: AuthenticatedUser, id: string) {
    const type = await this.schedulingPrisma.roomType.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!type) throw new NotFoundException('Room type not found');
    if (type.isSystem) throw new Error('Cannot delete system room type');
    return this.schedulingPrisma.roomType.delete({ where: { id } });
  }

  // Equipment Categories
  async listEquipmentCategories(user: AuthenticatedUser) {
    return this.schedulingPrisma.equipmentCategory.findMany({
      where: { OR: [{ tenantId: null }, { tenantId: user.tenantId }] },
      orderBy: { name: 'asc' },
    });
  }

  async createEquipmentCategory(user: AuthenticatedUser, dto: EquipmentCategoryDto) {
    return this.schedulingPrisma.equipmentCategory.create({
      data: {
        tenantId: user.tenantId,
        code: dto.code,
        name: dto.name,
        isSystem: dto.isSystem,
      },
    });
  }

  async deleteEquipmentCategory(user: AuthenticatedUser, id: string) {
    const category = await this.schedulingPrisma.equipmentCategory.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!category) throw new NotFoundException('Equipment category not found');
    if (category.isSystem) throw new Error('Cannot delete system category');
    return this.schedulingPrisma.equipmentCategory.delete({ where: { id } });
  }
}
