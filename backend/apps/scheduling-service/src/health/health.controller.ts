import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('live')
  healthLive() {
    return { status: 'ok', service: 'scheduling-service', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  async healthReady() {
    await this.prisma.$queryRaw`select 1`;
    return {
      status: 'ok',
      service: 'scheduling-service',
      database: 'connected',
      timestamp: new Date().toISOString(),
    };
  }
}
