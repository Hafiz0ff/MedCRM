import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ReceptionController } from './reception.controller';
import { ReceptionService } from './reception.service';
import { SmartSchedulingModule } from '../smart-scheduling/smart-scheduling.module';

@Module({
  imports: [
    JwtModule.register({}),
    forwardRef(() => SmartSchedulingModule)
  ],
  controllers: [ReceptionController],
  providers: [ReceptionService],
  exports: [ReceptionService]
})
export class ReceptionModule {}
