import { PrismaService } from '@core/database/prisma.service';
import { AuthenticatedUser } from '@core/security/jwt-payload';
import { REQUIRED_MODULE_KEY } from '@core/security/modules.decorator';
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class ModuleEnabledGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredModule = this.reflector.getAllAndOverride<string>(REQUIRED_MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredModule || requiredModule === 'auth') {
      return true;
    }

    const request = context.switchToHttp().getRequest<any>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Authenticated user context is missing');
    }

    const activeModule = await this.prisma.tenantModule.findFirst({
      where: {
        tenantId: user.tenantId,
        enabled: true,
        module: { code: requiredModule },
      },
    });

    if (!activeModule) {
      throw new ForbiddenException(`Module "${requiredModule}" is not enabled for this tenant`);
    }

    // SaaS Overdue Block Protection (Read-Only Mode)
    const subscription = await this.prisma.tenantSubscription.findFirst({
      where: { tenantId: user.tenantId },
      orderBy: { expiresAt: 'desc' },
    });

    if (subscription && subscription.subscriptionStatus === 'SUSPENDED') {
      const httpMethod = request.method;
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(httpMethod)) {
        throw new ForbiddenException(
          'Ваша подписка заблокирована в связи с задолженностью. Доступен только режим чтения (Read-Only Emergency Mode) для медицинской безопасности.',
        );
      }
    }

    return true;
  }
}
