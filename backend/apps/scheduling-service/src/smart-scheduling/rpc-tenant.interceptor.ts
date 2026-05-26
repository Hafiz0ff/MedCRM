import { TenantContextService } from '@core/tenancy/tenant-context.service';
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class RpcTenantInterceptor implements NestInterceptor {
  constructor(private readonly tenantContext: TenantContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const data = context.switchToRpc().getData();

    // Extract tenantId and userId from various possible payload formats
    const tenantId = data?.user?.tenantId || data?.tenantId || data?.where?.tenantId;
    const userId = data?.user?.userId || data?.changedBy || data?.userId;

    if (tenantId) {
      return new Observable((subscriber) => {
        this.tenantContext.run({ tenantId, userId }, () => {
          next.handle().subscribe(subscriber);
        });
      });
    }

    return next.handle();
  }
}
