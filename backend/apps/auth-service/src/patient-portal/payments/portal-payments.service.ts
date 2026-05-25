import { PrismaService } from '@core/database/prisma.service';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedPortalUser } from '../auth/patient-jwt-payload';
import { PaymentRegistryService } from './payment-registry.service';

@Injectable()
export class PortalPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentRegistry: PaymentRegistryService,
  ) {}

  private async resolveGrant(accountId: string, tenantCode: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { code: tenantCode } });
    if (!tenant) throw new NotFoundException('Clinic not found');

    const grant = await this.prisma.patientPortalGrant.findFirst({
      where: { accountId, tenantId: tenant.id, state: 'ACTIVE' },
    });
    if (!grant) throw new ForbiddenException('You are not connected to this clinic');

    return { tenant, grant };
  }

  async listInvoices(portalUser: AuthenticatedPortalUser, tenantCode: string) {
    const { tenant, grant } = await this.resolveGrant(portalUser.accountId, tenantCode);

    return this.prisma.invoice.findMany({
      where: {
        tenantId: tenant.id,
        patientId: grant.patientId,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
      },
    });
  }

  async initiatePayment(
    portalUser: AuthenticatedPortalUser,
    tenantCode: string,
    invoiceId: string,
    providerCode: string,
  ) {
    const { tenant, grant } = await this.resolveGrant(portalUser.accountId, tenantCode);

    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId: tenant.id, patientId: grant.patientId },
    });

    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === 'PAID') throw new BadRequestException('Invoice is already paid');
    if (invoice.dueAmount.lte(0)) throw new BadRequestException('No amount due');

    const provider = this.paymentRegistry.getProvider(providerCode);

    // Create Payment in PENDING status
    const payment = await this.prisma.payment.create({
      data: {
        tenantId: tenant.id,
        branchId: invoice.branchId,
        invoiceId: invoice.id,
        patientId: grant.patientId,
        paymentMethod: 'ONLINE',
        paymentProvider: providerCode,
        amount: invoice.dueAmount,
        currency: invoice.currency,
        cashierUserId: grant.patientId, // Self-paid
        status: 'PENDING',
      },
    });

    // We assume there is a frontend route to redirect back after payment
    const returnUrl = `https://portal.medcrm.app/t/${tenantCode}/payments/${payment.id}/callback`;

    const result = await provider.createPayment({
      amount: invoice.dueAmount.toNumber(),
      currency: invoice.currency,
      orderId: payment.id,
      description: `Payment for invoice ${invoice.invoiceNumber}`,
      returnUrl,
      metadata: {
        tenantId: tenant.id,
        invoiceId: invoice.id,
      },
    });

    // Update payment with provider's internal ID
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { externalTransactionId: result.paymentId },
    });

    return { payUrl: result.payUrl, paymentId: payment.id };
  }

  async handleWebhook(providerCode: string, rawBody: Buffer, headers: Record<string, string>) {
    const provider = this.paymentRegistry.getProvider(providerCode);

    // Validates signature and parses payload
    const result = await provider.handleWebhook(rawBody, headers);

    if (result.status === 'SUCCEEDED') {
      const payment = await this.prisma.payment.findUnique({
        where: { id: result.orderId },
        include: { invoice: true },
      });

      if (!payment || payment.status === 'COMPLETED') {
        return { received: true }; // Already processed or not found (maybe test webhook)
      }

      // Mark payment as completed
      await this.prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: 'COMPLETED' },
        });

        // Update invoice
        const newPaidAmount = payment.invoice.paidAmount.add(payment.amount);
        const newDueAmount = payment.invoice.totalAmount.sub(newPaidAmount);

        await tx.invoice.update({
          where: { id: payment.invoiceId },
          data: {
            paidAmount: newPaidAmount,
            dueAmount: newDueAmount.lte(0) ? 0 : newDueAmount,
            status: newDueAmount.lte(0) ? 'PAID' : 'PARTIALLY_PAID',
          },
        });
      });
    }

    return { received: true };
  }
}
