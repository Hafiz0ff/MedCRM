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
  RoomDto,
  RoomSchema,
  EmployeeRoomAssignmentDto,
  EmployeeRoomAssignmentSchema,
} from '../dto/organization-structure.schemas';
import { RoomsService } from '../services/rooms.service';

@ApiTags('rooms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ModuleEnabledGuard, RbacGuard)
@RequireModule('organization-structure')
@Controller('rooms')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get()
  @RequirePermissions('organization.branches.read')
  list(@CurrentUser() user: AuthenticatedUser, @Query('branchId') branchId?: string) {
    return this.rooms.list(user, branchId);
  }

  @Get(':id')
  @RequirePermissions('organization.branches.read')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.rooms.get(user, id);
  }

  @Post()
  @RequirePermissions('organization.branches.manage')
  @UsePipes(new ZodValidationPipe(RoomSchema))
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: RoomDto) {
    return this.rooms.create(user, dto);
  }

  @Patch(':id')
  @RequirePermissions('organization.branches.manage')
  @UsePipes(new ZodValidationPipe(RoomSchema))
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: RoomDto) {
    return this.rooms.update(user, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('organization.branches.manage')
  delete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.rooms.delete(user, id);
  }

  // Doctor Assignments
  @Get(':id/assignments')
  @RequirePermissions('organization.branches.read')
  listAssignments(@CurrentUser() user: AuthenticatedUser, @Param('id') roomId: string) {
    return this.rooms.listAssignments(user, roomId);
  }

  @Post('assignments')
  @RequirePermissions('organization.branches.manage')
  @UsePipes(new ZodValidationPipe(EmployeeRoomAssignmentSchema))
  assignEmployee(@CurrentUser() user: AuthenticatedUser, @Body() dto: EmployeeRoomAssignmentDto) {
    return this.rooms.assignEmployee(user, dto);
  }

  @Delete('assignments/:id')
  @RequirePermissions('organization.branches.manage')
  removeEmployeeAssignment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') assignmentId: string,
  ) {
    return this.rooms.removeEmployeeAssignment(user, assignmentId);
  }
}
