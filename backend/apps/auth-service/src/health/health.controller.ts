import { PrismaService } from '@core/database/prisma.service';
import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('live')
  healthLive() {
    return { status: 'ok', service: 'auth-service', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  async healthReady() {
    await this.prisma.$queryRaw`select 1`;
    return {
      status: 'ok',
      service: 'auth-service',
      database: 'connected',
      timestamp: new Date().toISOString(),
    };
  }
}
