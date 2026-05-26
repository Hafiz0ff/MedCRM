import { PrismaService } from '@core/database/prisma.service';
import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async health() {
    await this.prisma.$queryRaw`select 1`;
    return { status: 'ok', service: 'scheduling-service' };
  }
}
