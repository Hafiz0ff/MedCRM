import { Module } from '@nestjs/common';
import { BusinessIntelligenceController } from './bi.controller';
import { BusinessIntelligenceService } from './bi.service';

@Module({
  controllers: [BusinessIntelligenceController],
  providers: [BusinessIntelligenceService],
  exports: [BusinessIntelligenceService],
})
export class BusinessIntelligenceModule {}
