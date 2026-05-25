import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory-warehouse/inventory.module';
import { EmrController } from './emr.controller';
import { EmrService } from './emr.service';
import { FhirExportService } from './fhir/fhir-export.service';

@Module({
  imports: [InventoryModule],
  controllers: [EmrController],
  providers: [EmrService, FhirExportService],
  exports: [EmrService, FhirExportService],
})
export class EmrModule {}
