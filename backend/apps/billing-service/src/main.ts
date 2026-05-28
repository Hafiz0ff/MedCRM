import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const origins = config.get<string>('CORS_ORIGINS', 'http://localhost:3002').split(',');

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: origins,
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Tenant-Id',
      'X-Tenant-Code',
      'X-Branch-Id',
      'X-Request-Id',
    ],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Setup NestJS TCP Microservice for internal RPC calls (Port 3010)
  const tcpPort = Number(config.get<string>('BILLING_SERVICE_TCP_PORT', '3010'));
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host: '0.0.0.0',
      port: tcpPort,
    },
  });

  await app.startAllMicroservices();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('MedCRM SaaS Billing Service')
    .setDescription('SaaS Subscription plans, limits, and secure Stripe / Tinkoff / Sber callbacks')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = config.get<number>('PORT', config.get<number>('BILLING_SERVICE_PORT', 3009));
  await app.listen(port, '0.0.0.0');
  console.log(`[Billing] Billing Service listening on port ${port} and TCP port ${tcpPort}`);
}

void bootstrap();
