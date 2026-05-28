import { AuditModule } from '@core/audit/audit.module';
import { RedisModule } from '@core/cache/redis.module';
import { PrismaModule } from '@core/database/prisma.module';
import { EventBusModule } from '@core/eventbus/eventbus.module';
import { JwtStrategy } from '@core/security/jwt.strategy';
import { TenancyModule } from '@core/tenancy/tenancy.module';
import { TenantContextService } from '@core/tenancy/tenant-context.service';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { BillingModule } from './billing/billing.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule.forRoot(),
    TenancyModule,
    AuditModule,
    EventBusModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_ACCESS_TTL', '15m') as JwtSignOptions['expiresIn'],
        },
      }),
    }),
    BillingModule,
  ],
  controllers: [HealthController],
  providers: [JwtStrategy, TenantContextService],
})
export class AppModule {}
