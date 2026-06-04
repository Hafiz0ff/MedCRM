import { Global, Module } from '@nestjs/common';
import { AuditChainService } from '../security/audit-chain.service';
import { EncryptionService } from '../security/encryption.service';
import { TenancyModule } from '../tenancy/tenancy.module';
import { PrismaService } from './prisma.service';
import { AppointmentRepository } from './repositories/appointment.repository';
import { CommunicationRepository } from './repositories/communication.repository';
import { EncounterRepository } from './repositories/encounter.repository';
import { InventoryBalanceRepository } from './repositories/inventory-balance.repository';
import { InvoiceRepository } from './repositories/invoice.repository';
import { PatientRepository } from './repositories/patient.repository';
import { PaymentRepository } from './repositories/payment.repository';
import { WarehouseRepository } from './repositories/warehouse.repository';
import { SchedulingPrismaService } from './scheduling-prisma.service';
import { TenantScopedPrismaService } from './tenant-scoped-prisma.service';

@Global()
@Module({
  imports: [TenancyModule],
  providers: [
    PrismaService,
    SchedulingPrismaService,
    TenantScopedPrismaService,
    EncryptionService,
    AuditChainService,
    PatientRepository,
    AppointmentRepository,
    EncounterRepository,
    InvoiceRepository,
    PaymentRepository,
    WarehouseRepository,
    InventoryBalanceRepository,
    CommunicationRepository,
  ],
  exports: [
    PrismaService,
    SchedulingPrismaService,
    TenantScopedPrismaService,
    EncryptionService,
    AuditChainService,
    PatientRepository,
    AppointmentRepository,
    EncounterRepository,
    InvoiceRepository,
    PaymentRepository,
    WarehouseRepository,
    InventoryBalanceRepository,
    CommunicationRepository,
  ],
})
export class PrismaModule {}
