import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { TenantContextValue } from './tenant-context';

@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<TenantContextValue>();

  run<T>(context: Partial<TenantContextValue>, callback: () => T): T {
    return this.storage.run(
      {
        requestId: context.requestId ?? randomUUID(),
        tenantId: context.tenantId,
        tenantCode: context.tenantCode,
        branchId: context.branchId,
        userId: context.userId,
      },
      callback,
    );
  }

  get(): TenantContextValue {
    return this.storage.getStore() ?? { requestId: randomUUID() };
  }

  setTenantId(tenantId: string): void {
    const store = this.storage.getStore();
    if (store) {
      store.tenantId = tenantId;
    }
  }

  setUserId(userId: string): void {
    const store = this.storage.getStore();
    if (store) {
      store.userId = userId;
    }
  }
}
