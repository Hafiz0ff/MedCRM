import { AuditModule } from '@core/audit/audit.module';
import { RedisModule } from '@core/cache/redis.module';
import { PrismaModule } from '@core/database/prisma.module';
import { EventBusModule } from '@core/eventbus/eventbus.module';
import { TenancyModule } from '@core/tenancy/tenancy.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health/health.controller';
import { IntegrationsModule } from './integrations.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule.forRoot(),
    TenancyModule,
    AuditModule,
    EventBusModule,
    IntegrationsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
