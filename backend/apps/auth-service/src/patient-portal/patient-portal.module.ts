import { AuditModule } from '@core/audit/audit.module';
import { CoreCommunicationsModule } from '@core/communications/core-communications.module';
import { QueueModule } from '@core/queue/queue.module';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { SmartSchedulingModule } from '../smart-scheduling/smart-scheduling.module';
import { PatientJwtStrategy } from './auth/patient-jwt.strategy';
import { PortalAuthController } from './auth/portal-auth.controller';
import { PortalAuthService } from './auth/portal-auth.service';
import { PortalConnectService } from './auth/portal-connect.service';
import { PortalOtpService } from './auth/portal-otp.service';
import { PortalBookingController } from './booking/portal-booking.controller';
import { PortalBookingService } from './booking/portal-booking.service';
import { PortalDocumentsController } from './documents/portal-documents.controller';
import { PortalDocumentsService } from './documents/portal-documents.service';
import { PaymentRegistryService } from './payments/payment-registry.service';
import { AlifAdapter } from './payments/providers/alif.adapter';
import { YooKassaAdapter } from './payments/providers/yookassa.adapter';
import { PortalPublicController } from './public/portal-public.controller';
import { PortalPublicService } from './public/portal-public.service';
import { PortalVisitsController } from './visits/portal-visits.controller';
import { PortalVisitsService } from './visits/portal-visits.service';

@Module({
  imports: [
    ConfigModule,
    CoreCommunicationsModule,
    AuditModule,
    QueueModule,
    SmartSchedulingModule,
    PassportModule.register({ defaultStrategy: 'patient-jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('PORTAL_JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: config.get<string>(
            'PORTAL_JWT_ACCESS_TTL',
            '1h',
          ) as JwtSignOptions['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [
    PortalAuthController,
    PortalBookingController,
    PortalDocumentsController,
    PortalVisitsController,
    PortalPublicController,
  ],
  providers: [
    PortalAuthService,
    PortalOtpService,
    PortalConnectService,
    PatientJwtStrategy,
    PortalBookingService,
    PortalDocumentsService,
    PortalVisitsService,
    PortalPublicService,
    PaymentRegistryService,
    YooKassaAdapter,
    AlifAdapter,
  ],
  exports: [PortalAuthService, PortalConnectService, PortalBookingService],
})
export class PatientPortalModule {}
