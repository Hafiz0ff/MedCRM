import { Global, Module } from '@nestjs/common';
import { AuditChainService } from '../security/audit-chain.service';
import { EncryptionService } from '../security/encryption.service';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService, EncryptionService, AuditChainService],
  exports: [PrismaService, EncryptionService, AuditChainService],
})
export class PrismaModule {}
