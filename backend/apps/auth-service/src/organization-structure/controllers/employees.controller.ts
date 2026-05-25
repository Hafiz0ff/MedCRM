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
import {
  EmployeeDto,
  EmployeeSchema,
  EmployeePositionDto,
  EmployeePositionSchema,
} from '../dto/organization-structure.schemas';
import { EmployeesService } from '../services/employees.service';

@ApiTags('employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ModuleEnabledGuard, RbacGuard)
@RequireModule('organization-structure')
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  @RequirePermissions('organization.employees.read')
  list(@CurrentUser() user: AuthenticatedUser, @Query('branchId') branchId?: string) {
    return this.employees.list(user, branchId);
  }

  @Get(':id')
  @RequirePermissions('organization.employees.read')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.employees.get(user, id);
  }

  @Post()
  @RequirePermissions('organization.employees.manage')
  @UsePipes(new ZodValidationPipe(EmployeeSchema))
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: EmployeeDto) {
    return this.employees.create(user, dto);
  }

  @Patch(':id')
  @RequirePermissions('organization.employees.manage')
  @UsePipes(new ZodValidationPipe(EmployeeSchema))
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: EmployeeDto,
  ) {
    return this.employees.update(user, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('organization.employees.manage')
  delete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.employees.delete(user, id);
  }

  // Job/Position Assignments
  @Get(':id/positions')
  @RequirePermissions('organization.employees.read')
  listPositions(@CurrentUser() user: AuthenticatedUser, @Param('id') employeeId: string) {
    return this.employees.listPositions(user, employeeId);
  }

  @Post('positions')
  @RequirePermissions('organization.employees.manage')
  @UsePipes(new ZodValidationPipe(EmployeePositionSchema))
  assignPosition(@CurrentUser() user: AuthenticatedUser, @Body() dto: EmployeePositionDto) {
    return this.employees.assignPosition(user, dto);
  }

  @Delete('positions/:id')
  @RequirePermissions('organization.employees.manage')
  removePosition(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') positionAssignmentId: string,
  ) {
    return this.employees.removePosition(user, positionAssignmentId);
  }
}
