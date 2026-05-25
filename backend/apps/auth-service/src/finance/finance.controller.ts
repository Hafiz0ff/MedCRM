import { Body, Controller, Get, Param, Post, Query, UseGuards, UsePipes } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@core/security/current-user.decorator';
import { AuthenticatedUser } from '@core/security/jwt-payload';
import { RequirePermissions } from '@core/security/permissions.decorator';
import { RequireModule } from '@core/security/modules.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleEnabledGuard } from '../auth/guards/module-enabled.guard';
import { RbacGuard } from '../auth/guards/rbac.guard';
import { ZodValidationPipe } from '@core/common/zod-validation.pipe';
import { FinanceService } from './finance.service';
import {
  OpenShiftSchema,
  OpenShiftDto,
  CloseShiftSchema,
  CloseShiftDto,
  CreatePaymentSchema,
  CreatePaymentDto,
  CreateRefundSchema,
  CreateRefundDto,
  WalletTopUpSchema,
  WalletTopUpDto,
  CreatePayrollRuleSchema,
  CreatePayrollRuleDto,
  CalculatePayrollSchema,
  CalculatePayrollDto
} from './dto/finance.dto';

@ApiTags('finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ModuleEnabledGuard, RbacGuard)
@RequireModule('finance-billing')
@Controller('finance')
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get('summary')
  @RequirePermissions('finance.invoice.read')
  getSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.finance.getSummary(user);
  }

  @Get('invoices')
  @RequirePermissions('finance.invoice.read')
  listInvoices(
    @CurrentUser() user: AuthenticatedUser,
    @Query('patientId') patientId?: string,
    @Query('status') status?: string,
    @Query('paymentMethod') paymentMethod?: string
  ) {
    return this.finance.listInvoices(user, { patientId, status, paymentMethod });
  }

  @Get('payments')
  @RequirePermissions('finance.invoice.read')
  listPayments(@CurrentUser() user: AuthenticatedUser) {
    return this.finance.listPayments(user);
  }

  @Post('shifts/open')
  @RequirePermissions('finance.shift.manage')
  @UsePipes(new ZodValidationPipe(OpenShiftSchema))
  openShift(@CurrentUser() user: AuthenticatedUser, @Body() dto: OpenShiftDto) {
    return this.finance.openShift(user, dto);
  }

  @Post('shifts/close/:id')
  @RequirePermissions('finance.shift.manage')
  @UsePipes(new ZodValidationPipe(CloseShiftSchema))
  closeShift(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CloseShiftDto
  ) {
    return this.finance.closeShift(user, id, dto);
  }

  @Get('shifts/active')
  @RequirePermissions('finance.shift.manage')
  getActiveShift(@CurrentUser() user: AuthenticatedUser) {
    return this.finance.getActiveShift(user);
  }

  @Post('invoices/:id/payments')
  @RequirePermissions('finance.payment.create')
  @UsePipes(new ZodValidationPipe(CreatePaymentSchema))
  addPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') invoiceId: string,
    @Body() dto: CreatePaymentDto
  ) {
    return this.finance.addPayment(user, invoiceId, dto);
  }

  @Post('invoices/:id/refunds')
  @RequirePermissions('finance.refund.manage')
  @UsePipes(new ZodValidationPipe(CreateRefundSchema))
  refundPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') invoiceId: string,
    @Body() dto: CreateRefundDto
  ) {
    return this.finance.refundPayment(user, invoiceId, dto);
  }

  @Post('wallets/topup')
  @RequirePermissions('finance.payment.create')
  @UsePipes(new ZodValidationPipe(WalletTopUpSchema))
  topUpWallet(@CurrentUser() user: AuthenticatedUser, @Body() dto: WalletTopUpDto) {
    return this.finance.topUpWallet(user, dto);
  }

  @Get('wallets/patient/:patientId')
  @RequirePermissions('finance.invoice.read')
  getPatientWallet(@CurrentUser() user: AuthenticatedUser, @Param('patientId') patientId: string) {
    return this.finance.getPatientWallet(user, patientId);
  }

  @Post('payroll/rules')
  @RequirePermissions('finance.payroll.manage')
  @UsePipes(new ZodValidationPipe(CreatePayrollRuleSchema))
  createPayrollRule(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePayrollRuleDto) {
    return this.finance.createPayrollRule(user, dto);
  }

  @Get('payroll/rules')
  @RequirePermissions('finance.payroll.manage')
  listPayrollRules(@CurrentUser() user: AuthenticatedUser) {
    return this.finance.listPayrollRules(user);
  }

  @Post('payroll/calculate')
  @RequirePermissions('finance.payroll.manage')
  @UsePipes(new ZodValidationPipe(CalculatePayrollSchema))
  calculatePayroll(@CurrentUser() user: AuthenticatedUser, @Body() dto: CalculatePayrollDto) {
    return this.finance.calculatePayroll(user, dto);
  }

  @Get('billing/subscription')
  @RequirePermissions('finance.billing.manage')
  getSubscription(@CurrentUser() user: AuthenticatedUser) {
    return this.finance.getSubscription(user);
  }

  @Post('billing/subscription/plan')
  @RequirePermissions('finance.billing.manage')
  setSubscription(@CurrentUser() user: AuthenticatedUser, @Body('planCode') planCode: string) {
    return this.finance.setSubscription(user.tenantId, planCode);
  }

  // Gateway Simulation (Local RT Providers webhook)
  @Post('payments/webhooks/:gateway')
  @RequirePermissions('finance.payment.create')
  handleGatewayWebhook(@Param('gateway') gateway: string, @Body() payload: any) {
    return this.finance.handleGatewayWebhook(gateway, payload);
  }
}
