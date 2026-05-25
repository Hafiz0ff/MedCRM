import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RealtimeGateway } from './realtime.gateway';
import { RemindersService } from './reminders.service';
import { SmartSchedulingController } from './smart-scheduling.controller';
import { SmartSchedulingService } from './smart-scheduling.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [SmartSchedulingController],
  providers: [SmartSchedulingService, RealtimeGateway, RemindersService],
  exports: [SmartSchedulingService, RealtimeGateway],
})
export class SmartSchedulingModule {}
