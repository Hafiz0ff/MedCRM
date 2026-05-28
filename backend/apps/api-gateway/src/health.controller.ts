import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get('live')
  healthLive() {
    return { status: 'ok', service: 'api-gateway', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  healthReady() {
    return { status: 'ok', service: 'api-gateway', timestamp: new Date().toISOString() };
  }
}
