import { PrismaService } from '@core/database/prisma.service';
import { CurrentUser } from '@core/security/current-user.decorator';
import { JwtAuthGuard } from '@core/security/jwt-auth.guard';
import { AuthenticatedUser } from '@core/security/jwt-payload';
import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('plans')
  @ApiOperation({ summary: 'List all active subscription plans' })
  async getPlans() {
    return this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { monthlyPrice: 'asc' },
    });
  }

  @Get('usage')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current tenant billing usage metrics' })
  async getUsage(@CurrentUser() user: AuthenticatedUser) {
    return this.prisma.tenantUsageMetric.findMany({
      where: { tenantId: user.tenantId },
    });
  }

  @Post('subscribe')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Subscribe tenant to a billing plan' })
  async subscribe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { planCode: string; billingCycle: 'monthly' | 'yearly' },
  ) {
    const { planCode, billingCycle } = body;
    if (!planCode) {
      throw new BadRequestException('planCode is required');
    }

    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { code: planCode },
    });

    if (!plan || !plan.isActive) {
      throw new NotFoundException(`Active billing plan ${planCode} not found`);
    }

    const now = new Date();
    const expiresAt = new Date();
    if (billingCycle === 'yearly') {
      expiresAt.setFullYear(now.getFullYear() + 1);
    } else {
      expiresAt.setMonth(now.getMonth() + 1);
    }

    // Upsert tenant subscription
    const existing = await this.prisma.tenantSubscription.findFirst({
      where: { tenantId: user.tenantId },
    });

    let subscription;
    if (existing) {
      subscription = await this.prisma.tenantSubscription.update({
        where: { id: existing.id },
        data: {
          subscriptionPlanId: plan.id,
          subscriptionStatus: 'ACTIVE',
          startedAt: now,
          expiresAt,
          blockedAt: null,
        },
      });
    } else {
      subscription = await this.prisma.tenantSubscription.create({
        data: {
          tenantId: user.tenantId,
          subscriptionPlanId: plan.id,
          subscriptionStatus: 'ACTIVE',
          startedAt: now,
          expiresAt,
        },
      });
    }

    // Update main tenant subscriptionPlan field
    await this.prisma.tenant.update({
      where: { id: user.tenantId },
      data: { subscriptionPlan: plan.code, status: 'active' },
    });

    return {
      success: true,
      subscription,
      message: `Tenant successfully subscribed to plan ${plan.name}`,
    };
  }

  @Post('webhooks')
  @ApiOperation({ summary: 'Stripe, Tinkoff, and Sberbank billing webhook callback handler' })
  async handlePaymentWebhook(@Body() body: any, @Req() request: Request) {
    // 1. Stripe webhook parsing
    if (body.object === 'event' || body.type) {
      const type = body.type;
      const data = body.data?.object;
      const tenantId = data?.metadata?.tenantId;

      if (tenantId) {
        if (type === 'invoice.payment_succeeded' || type === 'charge.succeeded') {
          await this.updateSubscriptionStatus(tenantId, 'ACTIVE');
        } else if (type === 'invoice.payment_failed' || type === 'customer.subscription.deleted') {
          await this.updateSubscriptionStatus(tenantId, 'SUSPENDED');
        }
        return { received: true, provider: 'stripe' };
      }
    }

    // 2. Tinkoff webhook parsing
    if (body.TerminalKey && body.OrderId) {
      // Extract tenantId from OrderId or CustomFields
      const orderId: string = body.OrderId;
      const status: string = body.Status;

      // Assume OrderId contains tenantId as prefix or exact match
      let tenantId = body.CustomParams?.tenantId;
      if (!tenantId && orderId.includes('_')) {
        tenantId = orderId.split('_')[0];
      }

      if (tenantId) {
        if (status === 'CONFIRMED') {
          await this.updateSubscriptionStatus(tenantId, 'ACTIVE');
        } else if (status === 'REJECTED' || status === 'DEADLINE_EXPIRED') {
          await this.updateSubscriptionStatus(tenantId, 'OVERDUE');
        }
        return { success: 'OK', provider: 'tinkoff' };
      }
    }

    // 3. Sberbank webhook parsing
    if (body.action && body.orderNumber) {
      const action = body.action;
      const orderNumber = body.orderNumber;
      let tenantId = body.mdOrder;

      // Custom parameters parsing
      if (orderNumber.includes('_')) {
        tenantId = orderNumber.split('_')[0];
      }

      if (tenantId) {
        if (action === 'payment_succeeded' || action === 'successfully_deposited') {
          await this.updateSubscriptionStatus(tenantId, 'ACTIVE');
        } else if (action === 'payment_failed') {
          await this.updateSubscriptionStatus(tenantId, 'SUSPENDED');
        }
        return { success: true, provider: 'sberbank' };
      }
    }

    // 4. Default mock/fallback callback if no matches
    const fallbackTenantId = body.tenantId;
    const fallbackStatus = body.status;
    if (fallbackTenantId && fallbackStatus) {
      await this.updateSubscriptionStatus(fallbackTenantId, fallbackStatus);
      return { success: true, provider: 'mock' };
    }

    throw new BadRequestException('Unrecognized webhook signature/payload');
  }

  @Post('marketplace/toggle')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Toggle an integration or platform module enabled status in the tenant marketplace',
  })
  async toggleModule(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { moduleCode: string; enabled: boolean },
  ) {
    const { moduleCode, enabled } = body;
    if (!moduleCode) {
      throw new BadRequestException('moduleCode is required');
    }

    // Resolve system module
    const systemModule = await this.prisma.systemModule.findUnique({
      where: { code: moduleCode },
    });

    if (!systemModule) {
      throw new NotFoundException(`System module ${moduleCode} not found`);
    }

    // Toggle module inside TenantModule multi-tenant safely
    const tenantModule = await this.prisma.tenantModule.upsert({
      where: {
        tenantId_moduleId: {
          tenantId: user.tenantId,
          moduleId: systemModule.id,
        },
      },
      update: {
        enabled,
        activatedAt: enabled ? new Date() : null,
      },
      create: {
        tenantId: user.tenantId,
        moduleId: systemModule.id,
        enabled,
        activatedAt: enabled ? new Date() : null,
      },
      include: {
        module: true,
      },
    });

    return {
      success: true,
      tenantModule,
      message: `Module ${systemModule.name} is now ${enabled ? 'enabled' : 'disabled'}`,
    };
  }

  private async updateSubscriptionStatus(tenantId: string, status: string) {
    const normalizedStatus = status.toUpperCase();

    // Find subscription
    const subscription = await this.prisma.tenantSubscription.findFirst({
      where: { tenantId },
    });

    if (subscription) {
      await this.prisma.tenantSubscription.update({
        where: { id: subscription.id },
        data: {
          subscriptionStatus: normalizedStatus,
          blockedAt:
            normalizedStatus === 'SUSPENDED' || normalizedStatus === 'OVERDUE' ? new Date() : null,
        },
      });
    }

    // Update main tenant record
    const tenantStatus = normalizedStatus === 'ACTIVE' ? 'active' : 'suspended';
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: tenantStatus },
    });
  }
}
