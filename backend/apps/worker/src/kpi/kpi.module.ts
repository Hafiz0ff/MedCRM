import { Module } from '@nestjs/common';
import { KpiDailyWorker } from './kpi-daily.worker';
import { KpiHourlyWorker } from './kpi-hourly.worker';

@Module({
  providers: [KpiDailyWorker, KpiHourlyWorker],
})
export class KpiModule {}
