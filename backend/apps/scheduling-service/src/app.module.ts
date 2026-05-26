import { AuditModule } from '@core/audit/audit.module';
import { RedisModule } from '@core/cache/redis.module';
import { EventBusModule } from '@core/eventbus/eventbus.module';
import { TenancyModule } from '@core/tenancy/tenancy.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma.module';
import { SmartSchedulingModule } from './smart-scheduling/smart-scheduling.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule.forRoot(),
    TenancyModule,
    AuditModule,
    EventBusModule,
    SmartSchedulingModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
