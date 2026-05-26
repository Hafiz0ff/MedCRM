import { Global, Module } from '@nestjs/common';
import { AuditChainService } from '../security/audit-chain.service';
import { EncryptionService } from '../security/encryption.service';
import { TenancyModule } from '../tenancy/tenancy.module';
import { PrismaService } from './prisma.service';
import { SchedulingPrismaService } from './scheduling-prisma.service';

@Global()
@Module({
  imports: [TenancyModule],
  providers: [PrismaService, SchedulingPrismaService, EncryptionService, AuditChainService],
  exports: [PrismaService, SchedulingPrismaService, EncryptionService, AuditChainService],
})
export class PrismaModule {}
