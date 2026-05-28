import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';

@Module({
  controllers: [BillingController],
  providers: [],
})
export class BillingModule {}
