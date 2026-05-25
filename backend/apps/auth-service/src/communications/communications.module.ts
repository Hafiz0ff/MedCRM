import { Module } from '@nestjs/common';
import { SmartSchedulingModule } from '../smart-scheduling/smart-scheduling.module';
import { CommunicationsController } from './communications.controller';
import { CommunicationsService } from './communications.service';

@Module({
  imports: [SmartSchedulingModule],
  controllers: [CommunicationsController],
  providers: [CommunicationsService],
  exports: [CommunicationsService],
})
export class CommunicationsModule {}
