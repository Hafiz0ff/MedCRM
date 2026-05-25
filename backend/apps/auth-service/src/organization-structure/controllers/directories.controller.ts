import { ZodValidationPipe } from '@core/common/zod-validation.pipe';
import { CurrentUser } from '@core/security/current-user.decorator';
import { AuthenticatedUser } from '@core/security/jwt-payload';
import { RequireModule } from '@core/security/modules.decorator';
import { RequirePermissions } from '@core/security/permissions.decorator';
import { Body, Controller, Delete, Get, Param, Post, UseGuards, UsePipes } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ModuleEnabledGuard } from '../../auth/guards/module-enabled.guard';
import { RbacGuard } from '../../auth/guards/rbac.guard';
import {
  SpecialtyDto,
  SpecialtySchema,
  PositionDto,
  PositionSchema,
  RoomTypeDto,
  RoomTypeSchema,
  EquipmentCategoryDto,
  EquipmentCategorySchema,
} from '../dto/organization-structure.schemas';
import { DirectoriesService } from '../services/directories.service';

@ApiTags('directories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ModuleEnabledGuard, RbacGuard)
@RequireModule('organization-structure')
@Controller('directories')
export class DirectoriesController {
  constructor(private readonly directories: DirectoriesService) {}

  // Specialties
  @Get('specialties')
  listSpecialties() {
    return this.directories.listSpecialties();
  }

  @Post('specialties')
  @RequirePermissions('users.manage') // Require admin permissions to modify directories
  @UsePipes(new ZodValidationPipe(SpecialtySchema))
  createSpecialty(@Body() dto: SpecialtyDto) {
    return this.directories.createSpecialty(dto);
  }

  @Delete('specialties/:id')
  @RequirePermissions('users.manage')
  deleteSpecialty(@Param('id') id: string) {
    return this.directories.deleteSpecialty(id);
  }

  // Positions
  @Get('positions')
  listPositions(@CurrentUser() user: AuthenticatedUser) {
    return this.directories.listPositions(user);
  }

  @Post('positions')
  @RequirePermissions('users.manage')
  @UsePipes(new ZodValidationPipe(PositionSchema))
  createPosition(@CurrentUser() user: AuthenticatedUser, @Body() dto: PositionDto) {
    return this.directories.createPosition(user, dto);
  }

  @Delete('positions/:id')
  @RequirePermissions('users.manage')
  deletePosition(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.directories.deletePosition(user, id);
  }

  // Room Types
  @Get('room-types')
  listRoomTypes(@CurrentUser() user: AuthenticatedUser) {
    return this.directories.listRoomTypes(user);
  }

  @Post('room-types')
  @RequirePermissions('users.manage')
  @UsePipes(new ZodValidationPipe(RoomTypeSchema))
  createRoomType(@CurrentUser() user: AuthenticatedUser, @Body() dto: RoomTypeDto) {
    return this.directories.createRoomType(user, dto);
  }

  @Delete('room-types/:id')
  @RequirePermissions('users.manage')
  deleteRoomType(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.directories.deleteRoomType(user, id);
  }

  // Equipment Categories
  @Get('equipment-categories')
  listEquipmentCategories(@CurrentUser() user: AuthenticatedUser) {
    return this.directories.listEquipmentCategories(user);
  }

  @Post('equipment-categories')
  @RequirePermissions('users.manage')
  @UsePipes(new ZodValidationPipe(EquipmentCategorySchema))
  createEquipmentCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: EquipmentCategoryDto,
  ) {
    return this.directories.createEquipmentCategory(user, dto);
  }

  @Delete('equipment-categories/:id')
  @RequirePermissions('users.manage')
  deleteEquipmentCategory(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.directories.deleteEquipmentCategory(user, id);
  }
}
