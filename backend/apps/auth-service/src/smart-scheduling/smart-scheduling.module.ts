import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { RealtimeGateway } from './realtime.gateway';
import { SmartSchedulingService } from './smart-scheduling.service';

@Module({
  imports: [
    JwtModule.register({}),
    ClientsModule.registerAsync([
      {
        name: 'SCHEDULING_SERVICE',
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.get<string>('SCHEDULING_SERVICE_HOST', 'localhost'),
            port: Number(config.get<string>('SCHEDULING_SERVICE_TCP_PORT', '3004')),
          },
        }),
      },
    ]),
  ],
  providers: [SmartSchedulingService, RealtimeGateway],
  exports: [SmartSchedulingService, RealtimeGateway],
})
export class SmartSchedulingModule {}
