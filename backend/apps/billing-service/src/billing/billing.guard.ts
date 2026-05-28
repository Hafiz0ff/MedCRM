import { PrismaService } from '@core/database/prisma.service';
import { AuthenticatedUser } from '@core/security/jwt-payload';
import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class BillingGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // Read-only operations are always permitted
    const readMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (readMethods.includes(request.method.toUpperCase())) {
      return true;
    }

    // Get current authenticated user
    const user = request.user as AuthenticatedUser | undefined;
    if (!user) {
      // If endpoint is public but has write operations, let it pass or rely on authentication guards
      return true;
    }

    // Query the tenant's current subscription details
    const subscription = await this.prisma.tenantSubscription.findFirst({
      where: { tenantId: user.tenantId },
      include: { tenant: true },
    });

    // Check both tenant status and explicit subscription status
    const tenantStatus = subscription?.tenant?.status?.toUpperCase() || 'SUSPENDED';
    const subStatus = subscription?.subscriptionStatus?.toUpperCase() || 'SUSPENDED';

    const isSuspended =
      tenantStatus === 'SUSPENDED' ||
      tenantStatus === 'PAST_DUE' ||
      subStatus === 'SUSPENDED' ||
      subStatus === 'OVERDUE' ||
      subStatus === 'PAST_DUE';

    if (isSuspended) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: 'SUBSCRIPTION_SUSPENDED',
          message: `Write operations are blocked because your tenant subscription is currently ${subStatus}. Please settle outstanding invoices to restore access.`,
          details: {
            tenantId: user.tenantId,
            tenantStatus,
            subscriptionStatus: subStatus,
          },
          timestamp: new Date().toISOString(),
        },
      });
    }

    return true;
  }
}
