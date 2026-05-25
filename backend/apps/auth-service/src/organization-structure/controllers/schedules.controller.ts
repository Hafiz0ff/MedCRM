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
  WorkingScheduleDto,
  WorkingScheduleSchema,
  ScheduleExceptionDto,
  ScheduleExceptionSchema,
} from '../dto/organization-structure.schemas';
import { SchedulesService } from '../services/schedules.service';

@ApiTags('schedules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ModuleEnabledGuard, RbacGuard)
@RequireModule('organization-structure')
@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedules: SchedulesService) {}

  // Working Schedules
  @Get('working')
  @RequirePermissions('organization.branches.read')
  listWorkingSchedules(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityType') entityType: string,
    @Query('entityId') entityId: string,
  ) {
    return this.schedules.listWorkingSchedules(user, entityType, entityId);
  }

  @Post('working')
  @RequirePermissions('organization.branches.manage')
  @UsePipes(new ZodValidationPipe(WorkingScheduleSchema))
  createWorkingSchedule(@CurrentUser() user: AuthenticatedUser, @Body() dto: WorkingScheduleDto) {
    return this.schedules.createWorkingSchedule(user, dto);
  }

  @Patch('working/:id')
  @RequirePermissions('organization.branches.manage')
  @UsePipes(new ZodValidationPipe(WorkingScheduleSchema))
  updateWorkingSchedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: WorkingScheduleDto,
  ) {
    return this.schedules.updateWorkingSchedule(user, id, dto);
  }

  @Delete('working/:id')
  @RequirePermissions('organization.branches.manage')
  deleteWorkingSchedule(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.schedules.deleteWorkingSchedule(user, id);
  }

  // Schedule Exceptions
  @Get('exceptions')
  @RequirePermissions('organization.branches.read')
  listExceptions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityType') entityType: string,
    @Query('entityId') entityId: string,
  ) {
    return this.schedules.listExceptions(user, entityType, entityId);
  }

  @Post('exceptions')
  @RequirePermissions('organization.branches.manage')
  @UsePipes(new ZodValidationPipe(ScheduleExceptionSchema))
  createException(@CurrentUser() user: AuthenticatedUser, @Body() dto: ScheduleExceptionDto) {
    return this.schedules.createException(user, dto);
  }

  @Patch('exceptions/:id')
  @RequirePermissions('organization.branches.manage')
  @UsePipes(new ZodValidationPipe(ScheduleExceptionSchema))
  updateException(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ScheduleExceptionDto,
  ) {
    return this.schedules.updateException(user, id, dto);
  }

  @Delete('exceptions/:id')
  @RequirePermissions('organization.branches.manage')
  deleteException(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.schedules.deleteException(user, id);
  }
}
