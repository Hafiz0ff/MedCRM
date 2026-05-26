import { TenantContextService } from '@core/tenancy/tenant-context.service';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from './generated/prisma-client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly tenantContext: TenantContextService) {
    super();

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const client = this;
    const extended = client.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            const context = tenantContext.get();
            let result: any;
            if (context.tenantId) {
              result = await client.$transaction(async (tx) => {
                await tx.$executeRawUnsafe(
                  `SELECT set_config('app.current_tenant_id', $1, true)`,
                  context.tenantId,
                );
                if (context.userId) {
                  await tx.$executeRawUnsafe(
                    `SELECT set_config('app.current_user_id', $1, true)`,
                    context.userId,
                  );
                }
                const modelNameCamel = model.charAt(0).toLowerCase() + model.slice(1);
                return (tx as any)[modelNameCamel][operation](args);
              });
            } else {
              result = await query(args);
            }
            return result;
          },
        },
      },
    });

    (extended as any).onModuleInit = async () => {
      await client.$connect();
    };
    (extended as any).onModuleDestroy = async () => {
      await client.$disconnect();
    };

    return extended as any;
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  async runWithTenant<T>(tenantId: string, callback: () => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        'select set_config($1, $2, true)',
        'app.current_tenant_id',
        tenantId,
      );
      return callback();
    });
  }
}
