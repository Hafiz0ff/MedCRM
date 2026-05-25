import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentPortalUser } from '../auth/current-portal-user.decorator';
import { AuthenticatedPortalUser } from '../auth/patient-jwt-payload';
import { PatientJwtAuthGuard } from '../auth/patient-jwt.guard';
import { PortalPaymentsService } from './portal-payments.service';

@ApiTags('patient-portal-payments')
@Controller('portal/v1/payments')
export class PortalPaymentsController {
  constructor(private readonly payments: PortalPaymentsService) {}

  @Get('invoices/:tenantCode')
  @ApiBearerAuth()
  @UseGuards(PatientJwtAuthGuard)
  @ApiOperation({ summary: 'List patient invoices' })
  listInvoices(
    @CurrentPortalUser() user: AuthenticatedPortalUser,
    @Param('tenantCode') tenantCode: string,
  ) {
    return this.payments.listInvoices(user, tenantCode);
  }

  @Post('invoices/:tenantCode/:invoiceId/pay/:providerCode')
  @ApiBearerAuth()
  @UseGuards(PatientJwtAuthGuard)
  @ApiOperation({ summary: 'Initiate a payment for an invoice' })
  initiatePayment(
    @CurrentPortalUser() user: AuthenticatedPortalUser,
    @Param('tenantCode') tenantCode: string,
    @Param('invoiceId') invoiceId: string,
    @Param('providerCode') providerCode: string,
  ) {
    return this.payments.initiatePayment(user, tenantCode, invoiceId, providerCode);
  }

  @Post('webhooks/:providerCode')
  @ApiOperation({ summary: 'Payment provider webhook handler' })
  handleWebhook(@Param('providerCode') providerCode: string, @Req() req: Request) {
    // Note: To read rawBody properly, Express must be configured with raw body parser for this route.
    // Assuming NestJS setup exposes req.rawBody or we read it differently.
    // For MVP, we pass req.body buffer if available, or bufferized req.body string.
    const rawBody = (req as any).rawBody || Buffer.from(JSON.stringify(req.body));
    const headers = req.headers as Record<string, string>;

    return this.payments.handleWebhook(providerCode, rawBody, headers);
  }
}
