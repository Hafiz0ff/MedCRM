import { Module } from '@nestjs/common';
import { EmrService } from './emr.service';
import { EmrController } from './emr.controller';
import { FhirExportService } from './fhir/fhir-export.service';
import { InventoryModule } from '../inventory-warehouse/inventory.module';

@Module({
  imports: [InventoryModule],
  controllers: [EmrController],
  providers: [EmrService, FhirExportService],
  exports: [EmrService, FhirExportService]
})
export class EmrModule {}
