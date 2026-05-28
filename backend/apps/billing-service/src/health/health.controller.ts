import { PrismaService } from '@core/database/prisma.service';
import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe endpoint' })
  healthLive() {
    return { status: 'ok', service: 'billing-service', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe endpoint checking DB connection' })
  async healthReady() {
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      status: 'ok',
      service: 'billing-service',
      database: 'connected',
      timestamp: new Date().toISOString(),
    };
  }
}
