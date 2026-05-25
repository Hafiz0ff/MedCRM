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
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ModuleEnabledGuard } from '../../auth/guards/module-enabled.guard';
import { RbacGuard } from '../../auth/guards/rbac.guard';
import { BranchDto, BranchSchema } from '../dto/organization-structure.schemas';
import { BranchesService } from '../services/branches.service';

@ApiTags('branches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ModuleEnabledGuard, RbacGuard)
@RequireModule('organization-structure')
@Controller('branches')
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  @Get()
  @RequirePermissions('organization.branches.read')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.branches.list(user);
  }

  @Post()
  @RequirePermissions('organization.branches.manage')
  @UsePipes(new ZodValidationPipe(BranchSchema))
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: BranchDto) {
    return this.branches.create(user, dto);
  }

  @Patch(':id')
  @RequirePermissions('organization.branches.manage')
  @UsePipes(new ZodValidationPipe(BranchSchema))
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: BranchDto) {
    return this.branches.update(user, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('organization.branches.manage')
  delete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.branches.delete(user, id);
  }
}
