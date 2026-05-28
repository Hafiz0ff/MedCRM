import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory-warehouse/inventory.module';
import { CdsEngine } from './cds/cds.engine';
import { EmrController } from './emr.controller';
import { EmrService } from './emr.service';
import { FhirExportService } from './fhir/fhir-export.service';

@Module({
  imports: [InventoryModule],
  controllers: [EmrController],
  providers: [EmrService, FhirExportService, CdsEngine],
  exports: [EmrService, FhirExportService, CdsEngine],
})
export class EmrModule {}
