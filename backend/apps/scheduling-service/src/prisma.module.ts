import { TenancyModule } from '@core/tenancy/tenancy.module';
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  imports: [TenancyModule],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
