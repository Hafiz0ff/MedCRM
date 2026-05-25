import { Module } from '@nestjs/common';
import { SmartSchedulingModule } from '../smart-scheduling/smart-scheduling.module';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';

@Module({
  imports: [SmartSchedulingModule],
  controllers: [FinanceController],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
