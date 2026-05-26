import { JwtStrategy } from '@core/security/jwt.strategy';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { RealtimeGateway } from './realtime.gateway';
import { RemindersService } from './reminders.service';
import { SmartSchedulingController } from './smart-scheduling.controller';
import { SmartSchedulingRpcController } from './smart-scheduling.rpc.controller';
import { SmartSchedulingService } from './smart-scheduling.service';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), JwtModule.register({})],
  controllers: [SmartSchedulingController, SmartSchedulingRpcController],
  providers: [SmartSchedulingService, RealtimeGateway, RemindersService, JwtStrategy],
  exports: [SmartSchedulingService, RealtimeGateway],
})
export class SmartSchedulingModule {}
