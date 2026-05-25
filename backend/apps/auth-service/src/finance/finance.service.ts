import { AuditLoggerService } from '@core/audit/audit-logger.service';
import { PrismaService } from '@core/database/prisma.service';
import { AuthenticatedUser } from '@core/security/jwt-payload';
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { RealtimeGateway } from '../smart-scheduling/realtime.gateway';
import {
  OpenShiftDto,
  CloseShiftDto,
  CreatePaymentDto,
  CreateRefundDto,
  WalletTopUpDto,
  CreatePayrollRuleDto,
  CalculatePayrollDto,
  CreateSubscriptionPlanDto,
} from './dto/finance.dto';

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLoggerService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async getSummary(user: AuthenticatedUser) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const branchFilter = { in: user.branchIds };
    const [
      activeShift,
      todayInvoices,
      pendingInvoices,
      paidInvoices,
      payments,
      refunds,
      subscription,
    ] = await Promise.all([
      this.getActiveShift(user),
      this.prisma.invoice.aggregate({
        where: {
          tenantId: user.tenantId,
          branchId: branchFilter,
          invoiceDate: { gte: startOfDay, lt: endOfDay },
        },
        _sum: { totalAmount: true, dueAmount: true, paidAmount: true },
        _count: true,
      }),
      this.prisma.invoice.aggregate({
        where: {
          tenantId: user.tenantId,
          branchId: branchFilter,
          status: { in: ['DRAFT', 'PENDING_PAYMENT', 'PARTIALLY_PAID'] },
        },
        _sum: { dueAmount: true },
        _count: true,
      }),
      this.prisma.invoice.count({
        where: {
          tenantId: user.tenantId,
          branchId: branchFilter,
          status: 'PAID',
          invoiceDate: { gte: startOfDay, lt: endOfDay },
        },
      }),
      this.prisma.payment.aggregate({
        where: {
          tenantId: user.tenantId,
          branchId: branchFilter,
          paidAt: { gte: startOfDay, lt: endOfDay },
        },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.refund.aggregate({
        where: {
          tenantId: user.tenantId,
          invoice: { branchId: branchFilter },
          refundedAt: { gte: startOfDay, lt: endOfDay },
        },
        _sum: { refundAmount: true },
        _count: true,
      }),
      this.getSubscription(user),
    ]);

    return {
      activeShift,
      today: {
        invoicesCount: todayInvoices._count,
        invoicesTotal: Number(todayInvoices._sum.totalAmount ?? 0),
        paidAmount: Number(payments._sum.amount ?? 0),
        paidCount: payments._count,
        refundedAmount: Number(refunds._sum.refundAmount ?? 0),
        refundsCount: refunds._count,
        pendingCount: pendingInvoices._count,
        pendingDueAmount: Number(pendingInvoices._sum.dueAmount ?? 0),
        fullyPaidInvoicesCount: paidInvoices,
      },
      subscription,
    };
  }

  async listInvoices(
    user: AuthenticatedUser,
    filters: { patientId?: string; status?: string; paymentMethod?: string },
  ) {
    const status = filters.status?.trim().toUpperCase();
    const paymentMethod = filters.paymentMethod?.trim().toUpperCase();

    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId: user.tenantId,
        branchId: { in: user.branchIds },
        ...(filters.patientId ? { patientId: filters.patientId } : {}),
        ...(status ? { status } : {}),
        ...(paymentMethod ? { payments: { some: { paymentMethod } } } : {}),
      },
      include: {
        patient: {
          select: {
            id: true,
            patientCode: true,
            firstName: true,
            lastName: true,
            middleName: true,
          },
        },
        branch: { select: { id: true, name: true } },
        appointment: { select: { id: true, appointmentNumber: true, startAt: true, status: true } },
        items: {
          include: {
            service: { select: { id: true, name: true, code: true } },
            performer: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        payments: { orderBy: { paidAt: 'desc' } },
        refunds: { orderBy: { refundedAt: 'desc' } },
      },
      orderBy: [{ invoiceDate: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });

    return { items: invoices, total: invoices.length };
  }

  async listPayments(user: AuthenticatedUser) {
    const payments = await this.prisma.payment.findMany({
      where: {
        tenantId: user.tenantId,
        branchId: { in: user.branchIds },
      },
      include: {
        patient: {
          select: {
            id: true,
            patientCode: true,
            firstName: true,
            lastName: true,
            middleName: true,
          },
        },
        invoice: { select: { id: true, invoiceNumber: true, status: true, totalAmount: true } },
        cashier: { select: { id: true, email: true } },
        refunds: true,
      },
      orderBy: { paidAt: 'desc' },
      take: 50,
    });

    return { items: payments, total: payments.length };
  }

  // 1. Cashier Shifts
  async openShift(user: AuthenticatedUser, dto: OpenShiftDto) {
    if (!user.branchIds.includes(dto.branchId))
      throw new ForbiddenException('Branch access denied');

    const active = await this.prisma.cashierShift.findFirst({
      where: {
        tenantId: user.tenantId,
        cashierUserId: user.userId,
        closedAt: null,
      },
    });
    if (active) throw new BadRequestException('У вас уже есть открытая кассовая смена');

    const shift = await this.prisma.cashierShift.create({
      data: {
        tenantId: user.tenantId,
        cashierUserId: user.userId,
        branchId: dto.branchId,
        openingBalance: dto.openingBalance,
      },
    });

    await this.audit.log({
      tenantId: user.tenantId,
      branchId: dto.branchId,
      userId: user.userId,
      action: 'payment.shift_opened',
      entityType: 'cashier_shift',
      entityId: shift.id,
      newValuesJson: shift,
    });

    return shift;
  }

  async closeShift(user: AuthenticatedUser, shiftId: string, dto: CloseShiftDto) {
    const shift = await this.prisma.cashierShift.findUnique({
      where: { id: shiftId },
    });
    if (!shift) throw new NotFoundException('Смена не найдена');
    if (shift.tenantId !== user.tenantId) throw new ForbiddenException();
    if (shift.closedAt) throw new BadRequestException('Смена уже закрыта');

    // Calculate expected balance: openingBalance + sum(CASH payments) - sum(CASH refunds)
    const payments = await this.prisma.payment.aggregate({
      where: {
        tenantId: user.tenantId,
        cashierUserId: shift.cashierUserId,
        branchId: shift.branchId,
        paymentMethod: 'CASH',
        paidAt: { gte: shift.openedAt },
      },
      _sum: { amount: true },
    });

    const refunds = await this.prisma.refund.aggregate({
      where: {
        tenantId: user.tenantId,
        refundedBy: shift.cashierUserId,
        refundMethod: 'CASH',
        refundedAt: { gte: shift.openedAt },
      },
      _sum: { refundAmount: true },
    });

    const cashReceived = Number(payments._sum.amount ?? 0);
    const cashRefunded = Number(refunds._sum.refundAmount ?? 0);
    const expected = Number(shift.openingBalance) + cashReceived - cashRefunded;
    const discrepancy = dto.closingBalance - expected;

    const updated = await this.prisma.cashierShift.update({
      where: { id: shiftId },
      data: {
        closedAt: new Date(),
        closingBalance: dto.closingBalance,
        discrepancyAmount: discrepancy,
      },
    });

    await this.audit.log({
      tenantId: user.tenantId,
      branchId: shift.branchId,
      userId: user.userId,
      action: 'payment.shift_closed',
      entityType: 'cashier_shift',
      entityId: shiftId,
      oldValuesJson: shift,
      newValuesJson: updated,
    });

    return updated;
  }

  async getActiveShift(user: AuthenticatedUser) {
    return this.prisma.cashierShift.findFirst({
      where: {
        tenantId: user.tenantId,
        cashierUserId: user.userId,
        branchId: { in: user.branchIds },
        closedAt: null,
      },
    });
  }

  // 2. Split Payments & Allocations
  async addPayment(user: AuthenticatedUser, invoiceId: string, dto: CreatePaymentDto) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { items: true, patient: true },
    });
    if (!invoice) throw new NotFoundException('Счет не найден');
    if (invoice.tenantId !== user.tenantId) throw new ForbiddenException();

    const allowed = ['DRAFT', 'PENDING_PAYMENT', 'PARTIALLY_PAID'];
    if (!allowed.includes(invoice.status)) {
      throw new BadRequestException(`Нельзя оплатить счет со статусом ${invoice.status}`);
    }

    const payAmount = Number(dto.amount);
    if (payAmount > Number(invoice.dueAmount)) {
      throw new BadRequestException('Сумма оплаты превышает сумму долга по счету');
    }

    // Deduct from wallet if method is WALLET or FAMILY_BALANCE
    if (dto.paymentMethod === 'WALLET') {
      const wallet = await this.prisma.patientWallet.findUnique({
        where: { patientId_walletType: { patientId: invoice.patientId, walletType: 'DEPOSIT' } },
      });
      if (!wallet || Number(wallet.balance) < payAmount) {
        throw new BadRequestException('Недостаточно средств на депозите пациента');
      }
    } else if (dto.paymentMethod === 'FAMILY_BALANCE') {
      const member = await this.prisma.familyMember.findFirst({
        where: { tenantId: user.tenantId, patientId: invoice.patientId },
        include: { familyGroup: true },
      });
      if (!member || !member.familyGroup.sharedBalanceEnabled) {
        throw new BadRequestException('У пациента нет семейной группы или отключен общий баланс');
      }
      const famWallet = await this.prisma.familyWallet.findUnique({
        where: {
          familyGroupId_walletType: { familyGroupId: member.familyGroupId, walletType: 'DEPOSIT' },
        },
      });
      if (!famWallet || Number(famWallet.balance) < payAmount) {
        throw new BadRequestException('Недостаточно средств на семейном депозите');
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Process wallet deductions
      if (dto.paymentMethod === 'WALLET') {
        const wallet = await tx.patientWallet.update({
          where: { patientId_walletType: { patientId: invoice.patientId, walletType: 'DEPOSIT' } },
          data: { balance: { decrement: payAmount } },
        });
        await tx.walletTransaction.create({
          data: {
            tenantId: user.tenantId,
            walletId: wallet.id,
            transactionType: 'PAYMENT',
            amount: payAmount,
            currency: dto.currency,
            relatedInvoiceId: invoiceId,
            performedBy: user.userId,
          },
        });
      } else if (dto.paymentMethod === 'FAMILY_BALANCE') {
        const member = await tx.familyMember.findFirst({
          where: { tenantId: user.tenantId, patientId: invoice.patientId },
        });
        const famWallet = await tx.familyWallet.update({
          where: {
            familyGroupId_walletType: {
              familyGroupId: member!.familyGroupId,
              walletType: 'DEPOSIT',
            },
          },
          data: { balance: { decrement: payAmount } },
        });
        await tx.walletTransaction.create({
          data: {
            tenantId: user.tenantId,
            familyWalletId: famWallet.id,
            transactionType: 'PAYMENT',
            amount: payAmount,
            currency: dto.currency,
            relatedInvoiceId: invoiceId,
            performedBy: user.userId,
          },
        });
      }

      // 2. Create Payment record
      const payment = await tx.payment.create({
        data: {
          tenantId: user.tenantId,
          branchId: invoice.branchId,
          invoiceId,
          patientId: invoice.patientId,
          paymentMethod: dto.paymentMethod,
          paymentProvider: dto.paymentProvider || null,
          amount: payAmount,
          currency: dto.currency,
          externalTransactionId: dto.externalTransactionId || null,
          cashierUserId: user.userId,
        },
      });

      // 3. Allocate payment to items (greedy split-payments logic)
      let remainingAllocation = payAmount;
      for (const item of invoice.items) {
        if (remainingAllocation <= 0) break;

        // Find how much was already allocated to this item
        const allocated = await tx.paymentAllocation.aggregate({
          where: { invoiceItemId: item.id },
          _sum: { allocatedAmount: true },
        });
        const alreadyAllocated = Number(allocated._sum.allocatedAmount ?? 0);
        const itemTotal = Number(item.totalAmount);
        const itemNeeded = itemTotal - alreadyAllocated;

        if (itemNeeded > 0) {
          const allocate = Math.min(remainingAllocation, itemNeeded);
          await tx.paymentAllocation.create({
            data: {
              tenantId: user.tenantId,
              paymentId: payment.id,
              invoiceItemId: item.id,
              allocatedAmount: allocate,
            },
          });
          remainingAllocation -= allocate;
        }
      }

      // 4. Update Invoice paid/due balances and status
      const totalPaid = Number(invoice.paidAmount) + payAmount;
      const totalDue = Number(invoice.totalAmount) - totalPaid;
      let newStatus = 'PARTIALLY_PAID';
      if (totalDue <= 0) {
        newStatus = 'PAID';
      }

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: totalPaid,
          dueAmount: totalDue,
          status: newStatus,
        },
      });

      // If PAID and tied to an appointment, transition the appointment status to COMPLETED
      if (newStatus === 'PAID' && invoice.appointmentId) {
        const app = await tx.appointment.findUnique({ where: { id: invoice.appointmentId } });
        if (
          app &&
          ['COMPLETED_PENDING_PAYMENT', 'CHECKED_IN', 'IN_PROGRESS'].includes(app.status)
        ) {
          await tx.appointment.update({
            where: { id: invoice.appointmentId },
            data: { status: 'COMPLETED', completedAt: new Date() },
          });
          await tx.appointmentStatusHistory.create({
            data: {
              tenantId: user.tenantId,
              appointmentId: invoice.appointmentId,
              oldStatus: app.status,
              newStatus: 'COMPLETED',
              changedBy: user.userId,
              reason: 'Оплата счета завершена',
            },
          });
          await tx.appointmentVisitState.create({
            data: {
              tenantId: user.tenantId,
              appointmentId: invoice.appointmentId,
              oldState: app.status,
              newState: 'COMPLETED',
              changedBy: user.userId,
              workstationType: 'RECEPTIONIST',
            },
          });
        }
      }

      return { payment, invoice: updatedInvoice };
    });

    this.realtime.emitAppointmentEvent(
      'payment.completed',
      user.tenantId,
      invoice.branchId,
      result.payment,
    );

    await this.audit.log({
      tenantId: user.tenantId,
      branchId: invoice.branchId,
      userId: user.userId,
      action: 'payment.created',
      entityType: 'payment',
      entityId: result.payment.id,
      newValuesJson: result,
    });

    return result;
  }

  // 3. Refunds & Safeguards
  async refundPayment(user: AuthenticatedUser, invoiceId: string, dto: CreateRefundDto) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });
    if (!invoice) throw new NotFoundException('Счет не найден');
    if (invoice.tenantId !== user.tenantId) throw new ForbiddenException();

    const payment = await this.prisma.payment.findUnique({
      where: { id: dto.paymentId },
    });
    if (!payment || payment.invoiceId !== invoiceId) {
      throw new BadRequestException('Указанный платеж не найден или не связан с этим счетом');
    }

    const refundAmount = Number(dto.refundAmount);

    // Safeguard: Check that refundAmount does not exceed already paidAmount
    if (refundAmount > Number(invoice.paidAmount)) {
      throw new BadRequestException('Сумма возврата превышает фактически оплаченную сумму');
    }

    // Safeguard: Check that refundAmount does not exceed this specific payment amount
    const alreadyRefundedAgg = await this.prisma.refund.aggregate({
      where: { paymentId: payment.id },
      _sum: { refundAmount: true },
    });
    const alreadyRefunded = Number(alreadyRefundedAgg._sum.refundAmount ?? 0);
    const maxRefundable = Number(payment.amount) - alreadyRefunded;
    if (refundAmount > maxRefundable) {
      throw new BadRequestException(
        `Нельзя вернуть больше, чем сумма транзакции (${maxRefundable} TJS)`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create Refund record
      const refund = await tx.refund.create({
        data: {
          tenantId: user.tenantId,
          invoiceId,
          paymentId: payment.id,
          refundAmount,
          refundMethod: dto.refundMethod,
          reason: dto.reason || null,
          refundedBy: user.userId,
          refundStatus: 'COMPLETED',
        },
      });

      // 2. Return to deposit if refundMethod is WALLET
      if (dto.refundMethod === 'WALLET') {
        const wallet = await tx.patientWallet.upsert({
          where: { patientId_walletType: { patientId: invoice.patientId, walletType: 'DEPOSIT' } },
          create: {
            tenantId: user.tenantId,
            patientId: invoice.patientId,
            walletType: 'DEPOSIT',
            balance: refundAmount,
          },
          update: {
            balance: { increment: refundAmount },
          },
        });
        await tx.walletTransaction.create({
          data: {
            tenantId: user.tenantId,
            walletId: wallet.id,
            transactionType: 'REFUND',
            amount: refundAmount,
            currency: payment.currency,
            relatedInvoiceId: invoiceId,
            relatedRefundId: refund.id,
            performedBy: user.userId,
          },
        });
      }

      // 3. Update Invoice paid/due balances and status
      const totalPaid = Number(invoice.paidAmount) - refundAmount;
      const totalDue = Number(invoice.totalAmount) - totalPaid;
      let newStatus = 'PARTIALLY_PAID';
      if (totalPaid <= 0) {
        newStatus = 'REFUNDED';
      }

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: totalPaid,
          dueAmount: totalDue,
          status: newStatus,
        },
      });

      return { refund, invoice: updatedInvoice };
    });

    await this.audit.log({
      tenantId: user.tenantId,
      branchId: invoice.branchId,
      userId: user.userId,
      action: 'refund.completed',
      entityType: 'refund',
      entityId: result.refund.id,
      newValuesJson: result,
    });

    return result;
  }

  // 4. Patient & Family Wallets
  async topUpWallet(user: AuthenticatedUser, dto: WalletTopUpDto) {
    const wallet = await this.prisma.patientWallet.upsert({
      where: { patientId_walletType: { patientId: dto.patientId, walletType: dto.walletType } },
      create: {
        tenantId: user.tenantId,
        patientId: dto.patientId,
        walletType: dto.walletType,
        balance: dto.amount,
        currency: dto.currency,
      },
      update: {
        balance: { increment: dto.amount },
      },
    });

    const tx = await this.prisma.walletTransaction.create({
      data: {
        tenantId: user.tenantId,
        walletId: wallet.id,
        transactionType: 'DEPOSIT_TOPUP',
        amount: dto.amount,
        currency: dto.currency,
        performedBy: user.userId,
      },
    });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'wallet.deposit_topup',
      entityType: 'patient_wallet',
      entityId: wallet.id,
      newValuesJson: { wallet, transaction: tx },
    });

    return wallet;
  }

  async getPatientWallet(user: AuthenticatedUser, patientId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient || patient.tenantId !== user.tenantId)
      throw new NotFoundException('Пациент не найден');

    return this.prisma.patientWallet.findMany({
      where: { tenantId: user.tenantId, patientId },
    });
  }

  // 5. Revenue Share Payroll
  async calculatePayroll(user: AuthenticatedUser, dto: CalculatePayrollDto) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId },
    });
    if (!employee) throw new NotFoundException('Сотрудник не найден');
    if (employee.tenantId !== user.tenantId) throw new ForbiddenException();

    // 1. Fetch active payroll rule
    const rule = await this.prisma.payrollRule.findFirst({
      where: {
        tenantId: user.tenantId,
        employeeId: dto.employeeId,
        isActive: true,
        appliesFrom: { lte: new Date() },
      },
    });
    if (!rule)
      throw new BadRequestException('У сотрудника нет активного правила начисления зарплаты');

    // 2. Fetch all paid items performed by doctor in YYYY-MM period not yet calculated
    const start = new Date(`${dto.payrollPeriod}-01`);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);

    const items = await this.prisma.invoiceItem.findMany({
      where: {
        tenantId: user.tenantId,
        performerEmployeeId: dto.employeeId,
        payrollIncluded: false,
        invoice: {
          status: 'PAID',
          createdAt: { gte: start, lt: end },
        },
      },
      include: { invoice: true },
    });

    const calculations: any[] = [];

    const result = await this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        const gross = Number(item.totalAmount);
        const matCost = rule.deductMaterialCost ? Number(item.materialCost) : 0;
        const net = Math.max(0, gross - matCost - Number(item.discountAmount));
        const payout = net * (Number(rule.percentageRate) / 100);

        const calc = await tx.payrollCalculation.create({
          data: {
            tenantId: user.tenantId,
            employeeId: dto.employeeId,
            invoiceItemId: item.id,
            sourceInvoiceId: item.invoiceId,
            grossAmount: gross,
            materialCost: matCost,
            netRevenue: net,
            payrollAmount: payout,
            payrollPeriod: dto.payrollPeriod,
            calculationStatus: 'PENDING',
            calculatedBy: user.userId,
          },
        });

        await tx.invoiceItem.update({
          where: { id: item.id },
          data: { payrollIncluded: true },
        });

        calculations.push(calc);
      }

      return calculations;
    });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'payroll.calculated',
      entityType: 'employee',
      entityId: dto.employeeId,
      newValuesJson: { period: dto.payrollPeriod, itemsCount: items.length, calculations: result },
    });

    return result;
  }

  async createPayrollRule(user: AuthenticatedUser, dto: CreatePayrollRuleDto) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: dto.employeeId,
        tenantId: user.tenantId,
        positions: { some: { branchId: { in: user.branchIds }, activeTo: null } },
      },
    });
    if (!employee) throw new NotFoundException('Сотрудник не найден');

    // Deactivate previous rules
    await this.prisma.payrollRule.updateMany({
      where: { tenantId: user.tenantId, employeeId: dto.employeeId, isActive: true },
      data: { isActive: false },
    });

    const rule = await this.prisma.payrollRule.create({
      data: {
        tenantId: user.tenantId,
        employeeId: dto.employeeId,
        payrollType: dto.payrollType,
        percentageRate: dto.percentageRate,
        fixedAmount: dto.fixedAmount,
        deductMaterialCost: dto.deductMaterialCost,
        appliesFrom: new Date(dto.appliesFrom),
        appliesTo: dto.appliesTo ? new Date(dto.appliesTo) : null,
        isActive: true,
      },
    });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'payroll.rule_created',
      entityType: 'payroll_rule',
      entityId: rule.id,
      newValuesJson: rule,
    });

    return rule;
  }

  async listPayrollRules(user: AuthenticatedUser) {
    const rules = await this.prisma.payrollRule.findMany({
      where: {
        tenantId: user.tenantId,
        employee: {
          positions: { some: { branchId: { in: user.branchIds }, activeTo: null } },
        },
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            middleName: true,
            employeeNumber: true,
          },
        },
      },
      orderBy: [{ isActive: 'desc' }, { appliesFrom: 'desc' }],
    });

    return { items: rules, total: rules.length };
  }

  // 6. SaaS Tenant Billing & Auto Restriction
  async checkLimits(tenantId: string, metricCode: string, incrementAmount = 1) {
    const metric = await this.prisma.tenantUsageMetric.findUnique({
      where: { tenantId_metricCode: { tenantId, metricCode } },
    });
    if (!metric) return true; // Limit not tracked

    if (metric.currentUsage + incrementAmount > metric.limitValue) {
      throw new BadRequestException(
        `Превышен лимит по тарифу: ${metricCode} (${metric.limitValue})`,
      );
    }

    await this.prisma.tenantUsageMetric.update({
      where: { id: metric.id },
      data: { currentUsage: { increment: incrementAmount } },
    });

    return true;
  }

  async getSubscription(user: AuthenticatedUser) {
    return this.prisma.tenantSubscription.findFirst({
      where: { tenantId: user.tenantId },
      include: { subscriptionPlan: true },
    });
  }

  async setSubscription(tenantId: string, planCode: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { code: planCode },
    });
    if (!plan) throw new NotFoundException('Тарифный план не найден');

    const startedAt = new Date();
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    const subscription = await this.prisma.tenantSubscription.create({
      data: {
        tenantId,
        subscriptionPlanId: plan.id,
        subscriptionStatus: 'ACTIVE',
        startedAt,
        expiresAt,
      },
    });

    // Populate default metrics
    const limits = plan.limitsJson as Record<string, number>;
    for (const [metricCode, limitValue] of Object.entries(limits)) {
      await this.prisma.tenantUsageMetric.upsert({
        where: { tenantId_metricCode: { tenantId, metricCode } },
        create: {
          tenantId,
          metricCode,
          currentUsage: 0,
          limitValue,
        },
        update: {
          limitValue,
        },
      });
    }

    return subscription;
  }

  // Gateway Simulation (Alif/Corti Milli webhook)
  async handleGatewayWebhook(gatewayCode: string, payload: any) {
    const invoiceId = payload.invoiceId;
    const amount = Number(payload.amount);
    const txId = payload.transactionId;

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { items: true },
    });
    if (!invoice) throw new NotFoundException('Счет не найден');

    // Simulate authentication / signature verification
    const gateway = await this.prisma.paymentGateway.findFirst({
      where: { tenantId: invoice.tenantId, code: gatewayCode, isActive: true },
    });
    if (!gateway) throw new BadRequestException('Активный платежный шлюз не найден');

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Log Gateway transaction
      const gatewayTx = await tx.gatewayTransaction.create({
        data: {
          tenantId: invoice.tenantId,
          gatewayId: gateway.id,
          invoiceId,
          externalTransactionId: txId,
          requestPayload: payload,
          responsePayload: { ok: true, status: 'SUCCESS' },
          transactionStatus: 'SUCCESS',
        },
      });

      // 2. Add split payment under platform user session
      const cashier = await tx.user.findFirst({
        where: { tenantId: invoice.tenantId, isSuperAdmin: false },
      });

      const payment = await tx.payment.create({
        data: {
          tenantId: invoice.tenantId,
          branchId: invoice.branchId,
          invoiceId,
          patientId: invoice.patientId,
          paymentMethod: 'ONLINE_GATEWAY',
          paymentProvider: gatewayCode.toUpperCase(),
          amount,
          currency: invoice.currency,
          externalTransactionId: txId,
          cashierUserId: cashier!.id,
        },
      });

      // Allocate
      let remaining = amount;
      for (const item of invoice.items) {
        if (remaining <= 0) break;
        const allocated = await tx.paymentAllocation.aggregate({
          where: { invoiceItemId: item.id },
          _sum: { allocatedAmount: true },
        });
        const alreadyAllocated = Number(allocated._sum.allocatedAmount ?? 0);
        const itemTotal = Number(item.totalAmount);
        const itemNeeded = itemTotal - alreadyAllocated;

        if (itemNeeded > 0) {
          const allocate = Math.min(remaining, itemNeeded);
          await tx.paymentAllocation.create({
            data: {
              tenantId: invoice.tenantId,
              paymentId: payment.id,
              invoiceItemId: item.id,
              allocatedAmount: allocate,
            },
          });
          remaining -= allocate;
        }
      }

      const totalPaid = Number(invoice.paidAmount) + amount;
      const totalDue = Number(invoice.totalAmount) - totalPaid;
      let newStatus = 'PARTIALLY_PAID';
      if (totalDue <= 0) {
        newStatus = 'PAID';
      }

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: totalPaid,
          dueAmount: totalDue,
          status: newStatus,
        },
      });

      return { payment, invoice: updatedInvoice };
    });

    this.realtime.emitAppointmentEvent(
      'payment.completed',
      invoice.tenantId,
      invoice.branchId,
      result.payment,
    );
    return { ok: true, message: 'Платеж успешно обработан платежным шлюзом' };
  }
}
