import { Module } from '@nestjs/common';
import { PatientCrmController } from './patient-crm.controller';
import { PatientCrmService } from './patient-crm.service';

@Module({
  controllers: [PatientCrmController],
  providers: [PatientCrmService],
  exports: [PatientCrmService],
})
export class PatientCrmModule {}
