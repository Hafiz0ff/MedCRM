import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AnalyticsController } from './controllers/analytics.controller';
import { ClickHouseService } from './core/clickhouse.service';
import { DigestProcessor } from './core/digest.processor';
import { FactEtlProcessor } from './core/fact-etl.processor';
import { MlClient } from './core/ml.client';

@Module({
  imports: [JwtModule.register({})],
  providers: [ClickHouseService, FactEtlProcessor, MlClient, DigestProcessor],
  controllers: [AnalyticsController],
  exports: [ClickHouseService, FactEtlProcessor, MlClient],
})
export class AnalyticsModule {}
