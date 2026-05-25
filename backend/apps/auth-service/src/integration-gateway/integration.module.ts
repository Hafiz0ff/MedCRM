import { Module } from '@nestjs/common';
import { IntegrationGatewayController } from './integration.controller';
import { IntegrationGatewayService } from './integration.service';

@Module({
  controllers: [IntegrationGatewayController],
  providers: [IntegrationGatewayService],
  exports: [IntegrationGatewayService],
})
export class IntegrationGatewayModule {}
