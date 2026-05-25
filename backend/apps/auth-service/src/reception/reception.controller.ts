import { ZodValidationPipe } from '@core/common/zod-validation.pipe';
import { CurrentUser } from '@core/security/current-user.decorator';
import { AuthenticatedUser } from '@core/security/jwt-payload';
import { RequireModule } from '@core/security/modules.decorator';
import { RequirePermissions } from '@core/security/permissions.decorator';
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Patch,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleEnabledGuard } from '../auth/guards/module-enabled.guard';
import { RbacGuard } from '../auth/guards/rbac.guard';
import {
  CheckInSchema,
  CheckInDto,
  FastBookingSchema,
  FastBookingDto,
  IncomingCallSchema,
  IncomingCallDto,
  CreateInvoiceSchema,
  CreateInvoiceDto,
  PayInvoiceSchema,
  PayInvoiceDto,
} from './dto/reception.dto';
import { ReceptionService } from './reception.service';

@ApiTags('reception')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ModuleEnabledGuard, RbacGuard)
@RequireModule('receptionist-workplace')
@Controller('reception')
export class ReceptionController {
  constructor(private readonly reception: ReceptionService) {}

  @Get('dashboard')
  @RequirePermissions('reception.dashboard.read')
  getDashboard(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId?: string,
    @Query('date') date?: string,
  ) {
    return this.reception.getDashboard(user, branchId, date);
  }

  @Post('dashboard/recalculate')
  @RequirePermissions('reception.dashboard.manage')
  recalculateDashboard(
    @CurrentUser() user: AuthenticatedUser,
    @Body('branchId') branchId: string,
    @Body('date') date: string,
  ) {
    return this.reception.recalculateDashboard(user.tenantId, branchId, date);
  }

  @Post('checkin')
  @RequirePermissions('reception.visit.checkin')
  @UsePipes(new ZodValidationPipe(CheckInSchema))
  checkIn(@CurrentUser() user: AuthenticatedUser, @Body() dto: CheckInDto) {
    return this.reception.checkIn(user, dto);
  }

  @Post('visit/:id/status')
  @RequirePermissions('reception.visit.status_manage')
  transitionVisit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body('status') status: string,
    @Body('reason') reason?: string,
  ) {
    return this.reception.transitionVisit(user, id, status, reason);
  }

  @Get('queue')
  @RequirePermissions('reception.queue.read')
  getQueue(@CurrentUser() user: AuthenticatedUser, @Query('branchId') branchId: string) {
    return this.reception.getQueue(user, branchId);
  }

  @Patch('queue/:id')
  @RequirePermissions('reception.queue.manage')
  updateQueueStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body('status') status: string,
    @Body('reason') reason?: string,
  ) {
    return this.reception.updateQueueStatus(user, id, status, reason);
  }

  @Patch('queue/:id/priority')
  @RequirePermissions('reception.queue.manage')
  updateQueuePriority(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body('priority') priority: string,
  ) {
    return this.reception.updateQueuePriority(user, id, priority);
  }

  @Post('fast-booking')
  @RequirePermissions('reception.fast_booking.create')
  @UsePipes(new ZodValidationPipe(FastBookingSchema))
  fastBooking(@CurrentUser() user: AuthenticatedUser, @Body() dto: FastBookingDto) {
    return this.reception.fastBooking(user, dto);
  }

  @Post('calls/incoming')
  @RequirePermissions('reception.calls.manage')
  @UsePipes(new ZodValidationPipe(IncomingCallSchema))
  incomingCall(@CurrentUser() user: AuthenticatedUser, @Body() dto: IncomingCallDto) {
    return this.reception.incomingCall(user, dto);
  }

  @Get('calls')
  @RequirePermissions('reception.calls.read')
  searchCalls(@CurrentUser() user: AuthenticatedUser, @Query('branchId') branchId: string) {
    return this.reception.searchCalls(user, branchId);
  }

  @Get('invoices')
  @RequirePermissions('reception.invoices.read')
  getInvoices(@CurrentUser() user: AuthenticatedUser, @Query('branchId') branchId: string) {
    return this.reception.getInvoices(user, branchId);
  }

  @Post('invoices')
  @RequirePermissions('reception.invoices.prepare')
  @UsePipes(new ZodValidationPipe(CreateInvoiceSchema))
  createInvoice(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateInvoiceDto) {
    return this.reception.createInvoice(user, dto);
  }

  @Post('invoices/:id/pay')
  @RequirePermissions('reception.invoices.prepare')
  @UsePipes(new ZodValidationPipe(PayInvoiceSchema))
  payInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: PayInvoiceDto,
  ) {
    return this.reception.payInvoice(user, id, dto);
  }

  @Get('patient-preview/:patientId')
  @RequirePermissions('reception.dashboard.read')
  @ApiOperation({ summary: 'Quick patient preview for reception' })
  patientPreview(@CurrentUser() user: AuthenticatedUser, @Param('patientId') patientId: string) {
    return this.reception.getPatientPreview(user, patientId);
  }
}
