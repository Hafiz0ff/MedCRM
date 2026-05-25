import { RedisModule } from '@core/cache/redis.module';
import { PrismaModule } from '@core/database/prisma.module';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { OpenApiAggregatorService } from './openapi-aggregator.service';
import { OpenApiController } from './openapi.controller';
import { TenantAwareMiddleware } from './tenant-aware.middleware';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, RedisModule.forRoot()],
  controllers: [HealthController, OpenApiController],
  providers: [OpenApiAggregatorService, TenantAwareMiddleware],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantAwareMiddleware).forRoutes('*');
  }
}
