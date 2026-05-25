import { ZodValidationPipe } from '@core/common/zod-validation.pipe';
import { Body, Controller, Get, Post, Query, UseGuards, UsePipes } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentPortalUser } from '../auth/current-portal-user.decorator';
import { AuthenticatedPortalUser } from '../auth/patient-jwt-payload';
import { PatientJwtAuthGuard } from '../auth/patient-jwt.guard';
import {
  PortalSlotsQueryDto,
  PortalSlotsQuerySchema,
  PortalReserveSlotDto,
  PortalReserveSlotSchema,
  PortalConfirmBookingDto,
  PortalConfirmBookingSchema,
  PortalCancelBookingDto,
  PortalCancelBookingSchema,
  PortalDoctorsQueryDto,
  PortalDoctorsQuerySchema,
  PortalSpecialtiesQueryDto,
  PortalSpecialtiesQuerySchema,
} from '../dto/portal-booking.dto';
import { PortalBookingService } from './portal-booking.service';

@ApiTags('patient-portal-booking')
@Controller('portal/v1/booking')
@ApiBearerAuth()
@UseGuards(PatientJwtAuthGuard)
export class PortalBookingController {
  constructor(private readonly booking: PortalBookingService) {}

  @Get('specialties')
  @ApiOperation({ summary: 'List bookable specialties and services' })
  getSpecialties(
    @CurrentPortalUser() user: AuthenticatedPortalUser,
    @Query(new ZodValidationPipe(PortalSpecialtiesQuerySchema)) query: PortalSpecialtiesQueryDto,
  ) {
    return this.booking.getSpecialties(user, query);
  }

  @Get('doctors')
  @ApiOperation({ summary: 'List doctors available for booking' })
  getDoctors(
    @CurrentPortalUser() user: AuthenticatedPortalUser,
    @Query(new ZodValidationPipe(PortalDoctorsQuerySchema)) query: PortalDoctorsQueryDto,
  ) {
    return this.booking.getDoctors(user, query);
  }

  @Get('slots')
  @ApiOperation({ summary: 'Get available time slots for a date' })
  getSlots(
    @CurrentPortalUser() user: AuthenticatedPortalUser,
    @Query(new ZodValidationPipe(PortalSlotsQuerySchema)) query: PortalSlotsQueryDto,
  ) {
    return this.booking.getSlots(user, query);
  }

  @Post('reserve')
  @ApiOperation({ summary: 'Hold a time slot for 10 minutes' })
  @UsePipes(new ZodValidationPipe(PortalReserveSlotSchema))
  reserve(@CurrentPortalUser() user: AuthenticatedPortalUser, @Body() dto: PortalReserveSlotDto) {
    return this.booking.reserveSlot(user, dto);
  }

  @Post('confirm')
  @ApiOperation({ summary: 'Confirm booking with OTP code' })
  @UsePipes(new ZodValidationPipe(PortalConfirmBookingSchema))
  confirm(
    @CurrentPortalUser() user: AuthenticatedPortalUser,
    @Body() dto: PortalConfirmBookingDto,
  ) {
    return this.booking.confirmBooking(user, dto);
  }

  @Post('cancel')
  @ApiOperation({ summary: 'Cancel an upcoming appointment' })
  @UsePipes(new ZodValidationPipe(PortalCancelBookingSchema))
  cancel(@CurrentPortalUser() user: AuthenticatedPortalUser, @Body() dto: PortalCancelBookingDto) {
    return this.booking.cancelBooking(user, dto);
  }

  @Get('upcoming')
  @ApiOperation({ summary: 'Get upcoming appointments' })
  upcoming(
    @CurrentPortalUser() user: AuthenticatedPortalUser,
    @Query('tenantCode') tenantCode: string,
  ) {
    return this.booking.getUpcomingAppointments(user, tenantCode);
  }
}
