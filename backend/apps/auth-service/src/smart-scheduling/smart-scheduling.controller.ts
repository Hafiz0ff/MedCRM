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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleEnabledGuard } from '../auth/guards/module-enabled.guard';
import { RbacGuard } from '../auth/guards/rbac.guard';
import {
  AppointmentListQuery,
  CreateAppointmentDto,
  ReserveSlotDto,
  UpdateAppointmentDto,
  appointmentListQuerySchema,
  createAppointmentSchema,
  reserveSlotSchema,
  updateAppointmentSchema,
  CreateWaitingListDto,
  UpdateWaitingListDto,
  ResourceBufferDto,
  PublicSlotsQueryDto,
  OnlineBookingReserveDto,
  OnlineBookingConfirmDto,
  createWaitingListSchema,
  updateWaitingListSchema,
  resourceBufferSchema,
  publicSlotsQuerySchema,
  onlineBookingReserveSchema,
  onlineBookingConfirmSchema,
  RescheduleDto,
  rescheduleSchema,
  CreateRecurringDto,
  createRecurringSchema,
  WeekAvailabilityQuery,
  weekAvailabilityQuerySchema,
  RoomUtilizationQuery,
  roomUtilizationQuerySchema,
} from './dto/appointment.schemas';
import { SmartSchedulingService } from './smart-scheduling.service';

@ApiTags('appointments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ModuleEnabledGuard, RbacGuard)
@RequireModule('smart-scheduling')
@Controller()
export class SmartSchedulingController {
  constructor(private readonly scheduling: SmartSchedulingService) {}

  @Get('appointments')
  @RequirePermissions('scheduling.appointments.read')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(appointmentListQuerySchema)) query: AppointmentListQuery,
  ) {
    return this.scheduling.list(user, query);
  }

  @Post('appointments')
  @RequirePermissions('scheduling.appointments.create')
  @UsePipes(new ZodValidationPipe(createAppointmentSchema))
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAppointmentDto) {
    return this.scheduling.create(user, dto);
  }

  @Patch('appointments/:id')
  @RequirePermissions('scheduling.appointments.update')
  @UsePipes(new ZodValidationPipe(updateAppointmentSchema))
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentDto,
  ) {
    return this.scheduling.update(user, id, dto);
  }

  @Post('appointments/:id/confirm')
  @RequirePermissions('scheduling.appointments.update')
  confirm(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.scheduling.transition(user, id, 'CONFIRMED');
  }

  @Post('appointments/:id/check-in')
  @RequirePermissions('reception.visit.checkin')
  checkIn(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.scheduling.transition(user, id, 'CHECKED_IN');
  }

  @Post('appointments/:id/cancel')
  @RequirePermissions('scheduling.appointments.cancel')
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.scheduling.transition(user, id, 'CANCELLED', body.reason);
  }

  @Post('appointments/:id/start')
  @RequirePermissions('scheduling.appointments.update')
  @ApiOperation({ summary: 'Start appointment (transition to IN_PROGRESS)' })
  start(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.scheduling.transition(user, id, 'IN_PROGRESS');
  }

  @Post('appointments/:id/complete')
  @RequirePermissions('scheduling.appointments.update')
  @ApiOperation({ summary: 'Complete appointment' })
  complete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.scheduling.transition(user, id, 'COMPLETED');
  }

  @Post('appointments/:id/no-show')
  @RequirePermissions('scheduling.appointments.update')
  @ApiOperation({ summary: 'Mark as no-show' })
  noShow(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.scheduling.transition(user, id, 'NO_SHOW');
  }

  @Post('appointments/:id/reschedule')
  @RequirePermissions('scheduling.appointments.update')
  @ApiOperation({ summary: 'Reschedule appointment to new time' })
  reschedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(rescheduleSchema)) dto: RescheduleDto,
  ) {
    return this.scheduling.reschedule(user, id, dto);
  }

  @Post('appointments/recurring')
  @RequirePermissions('scheduling.appointments.create')
  @ApiOperation({ summary: 'Create recurring appointment series' })
  @UsePipes(new ZodValidationPipe(createRecurringSchema))
  createRecurring(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRecurringDto) {
    return this.scheduling.createRecurring(user, dto);
  }

  @Get('availability/week')
  @RequirePermissions('scheduling.availability.read')
  @ApiOperation({ summary: 'Get 7-day availability grid' })
  weekAvailability(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(weekAvailabilityQuerySchema)) query: WeekAvailabilityQuery,
  ) {
    return this.scheduling.getWeekAvailability(user, query);
  }

  @Get('rooms/utilization')
  @RequirePermissions('scheduling.availability.read')
  @ApiOperation({ summary: 'Get room utilization statistics' })
  roomUtilization(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(roomUtilizationQuerySchema)) query: RoomUtilizationQuery,
  ) {
    return this.scheduling.getRoomUtilization(user, query);
  }

  @Get('availability')
  @RequirePermissions('scheduling.availability.read')
  availability(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(appointmentListQuerySchema)) query: AppointmentListQuery,
  ) {
    return this.scheduling.availability(user, query);
  }

  @Post('slots/reserve')
  @RequirePermissions('scheduling.appointments.create')
  @UsePipes(new ZodValidationPipe(reserveSlotSchema))
  reserve(@CurrentUser() user: AuthenticatedUser, @Body() dto: ReserveSlotDto) {
    return this.scheduling.reserveSlot(user, dto);
  }

  @Get('services')
  @RequirePermissions('scheduling.availability.read')
  services(@CurrentUser() user: AuthenticatedUser) {
    return this.scheduling.services(user);
  }

  @Get('doctors')
  @RequirePermissions('scheduling.availability.read')
  doctors(@CurrentUser() user: AuthenticatedUser) {
    return this.scheduling.doctors(user);
  }

  // Waiting List Endpoints
  @Get('waiting-list')
  @RequirePermissions('scheduling.appointments.read')
  @ApiOperation({ summary: 'List active waitlist items ordered by priority' })
  listWaitingList(@CurrentUser() user: AuthenticatedUser) {
    return this.scheduling.listWaitingList(user);
  }

  @Post('waiting-list')
  @RequirePermissions('scheduling.appointments.create')
  @ApiOperation({ summary: 'Add a new patient to the waiting list' })
  @UsePipes(new ZodValidationPipe(createWaitingListSchema))
  createWaitingList(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateWaitingListDto) {
    return this.scheduling.createWaitingList(user, dto);
  }

  @Patch('waiting-list/:id')
  @RequirePermissions('scheduling.appointments.update')
  @ApiOperation({ summary: 'Update patient waitlist preferences or status' })
  @UsePipes(new ZodValidationPipe(updateWaitingListSchema))
  updateWaitingList(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateWaitingListDto,
  ) {
    return this.scheduling.updateWaitingList(user, id, dto);
  }

  @Delete('waiting-list/:id')
  @RequirePermissions('scheduling.appointments.cancel')
  @ApiOperation({ summary: 'Remove patient from the waiting list' })
  deleteWaitingList(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.scheduling.deleteWaitingList(user, id);
  }

  // Resource Buffers Configuration
  @Get('resource-buffers')
  @RequirePermissions('scheduling.appointments.read')
  @ApiOperation({ summary: 'List all resource buffer definitions' })
  listResourceBuffers(@CurrentUser() user: AuthenticatedUser) {
    return this.scheduling.listResourceBuffers(user);
  }

  @Post('resource-buffers')
  @RequirePermissions('scheduling.appointments.update')
  @ApiOperation({ summary: 'Configure clean-up/prep time buffers for a resource' })
  @UsePipes(new ZodValidationPipe(resourceBufferSchema))
  upsertResourceBuffer(@CurrentUser() user: AuthenticatedUser, @Body() dto: ResourceBufferDto) {
    return this.scheduling.upsertResourceBuffer(user, dto);
  }

  @Delete('resource-buffers/:id')
  @RequirePermissions('scheduling.appointments.update')
  @ApiOperation({ summary: 'Delete resource buffer configuration' })
  deleteResourceBuffer(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.scheduling.deleteResourceBuffer(user, id);
  }

  // Public Booking / Widget Endpoints
  @Get('availability/public-slots')
  @RequirePermissions('scheduling.availability.read')
  @ApiOperation({ summary: 'Browse available calendar slots for widgets' })
  getPublicSlots(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(publicSlotsQuerySchema)) query: PublicSlotsQueryDto,
  ) {
    return this.scheduling.getPublicSlots(user, query);
  }

  @Post('online-booking/reserve')
  @RequirePermissions('scheduling.appointments.create')
  @ApiOperation({ summary: 'Hold slot temporarily (10 mins lock) for widget self-registration' })
  @UsePipes(new ZodValidationPipe(onlineBookingReserveSchema))
  onlineBookingReserve(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: OnlineBookingReserveDto,
  ) {
    return this.scheduling.onlineBookingReserve(user, dto);
  }

  @Post('online-booking/confirm')
  @RequirePermissions('scheduling.appointments.create')
  @ApiOperation({ summary: 'Confirm temporary hold using OTP verification' })
  @UsePipes(new ZodValidationPipe(onlineBookingConfirmSchema))
  onlineBookingConfirm(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: OnlineBookingConfirmDto,
  ) {
    return this.scheduling.onlineBookingConfirm(user, dto);
  }
}
