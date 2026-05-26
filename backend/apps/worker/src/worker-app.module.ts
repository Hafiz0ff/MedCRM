import { AuditModule } from '@core/audit/audit.module';
import { RedisModule } from '@core/cache/redis.module';
import { PrismaModule } from '@core/database/prisma.module';
import { EventBusModule } from '@core/eventbus/eventbus.module';
import { QueueModule } from '@core/queue/queue.module';
import { TenancyModule } from '@core/tenancy/tenancy.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IntegrationsModule } from './integrations/integrations.module';
import { KpiModule } from './kpi/kpi.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule.forRoot(),
    TenancyModule,
    AuditModule,
    QueueModule,
    EventBusModule,
    IntegrationsModule,
    NotificationsModule,
    KpiModule,
  ],
})
export class WorkerAppModule {}
