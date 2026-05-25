import { ZodValidationPipe } from '@core/common/zod-validation.pipe';
import { CurrentUser } from '@core/security/current-user.decorator';
import { AuthenticatedUser } from '@core/security/jwt-payload';
import { RequireModule } from '@core/security/modules.decorator';
import { RequirePermissions } from '@core/security/permissions.decorator';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ModuleEnabledGuard } from '../../auth/guards/module-enabled.guard';
import { RbacGuard } from '../../auth/guards/rbac.guard';
import { EquipmentDto, EquipmentSchema } from '../dto/organization-structure.schemas';
import { EquipmentService } from '../services/equipment.service';

@ApiTags('equipment')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ModuleEnabledGuard, RbacGuard)
@RequireModule('organization-structure')
@Controller('equipment')
export class EquipmentController {
  constructor(private readonly equipment: EquipmentService) {}

  @Get()
  @RequirePermissions('organization.branches.read')
  list(@CurrentUser() user: AuthenticatedUser, @Query('branchId') branchId?: string) {
    return this.equipment.list(user, branchId);
  }

  @Get(':id')
  @RequirePermissions('organization.branches.read')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.equipment.get(user, id);
  }

  @Post()
  @RequirePermissions('organization.branches.manage')
  @UsePipes(new ZodValidationPipe(EquipmentSchema))
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: EquipmentDto) {
    return this.equipment.create(user, dto);
  }

  @Patch(':id')
  @RequirePermissions('organization.branches.manage')
  @UsePipes(new ZodValidationPipe(EquipmentSchema))
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: EquipmentDto,
  ) {
    return this.equipment.update(user, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('organization.branches.manage')
  delete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.equipment.delete(user, id);
  }
}
