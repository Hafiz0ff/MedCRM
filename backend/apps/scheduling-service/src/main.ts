import { RedisIoAdapter } from '@core/realtime/redis-io.adapter';
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

  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  // Setup NestJS TCP Microservice for internal RPC calls
  const tcpPort = Number(config.get<string>('SCHEDULING_SERVICE_TCP_PORT', '3004'));
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host: '0.0.0.0',
      port: tcpPort,
    },
  });

  await app.startAllMicroservices();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('MedCRM Smart Scheduling Service')
    .setDescription('Smart Scheduling & Resource Management API')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = config.get<number>('PORT', config.get<number>('SCHEDULING_SERVICE_PORT', 3003));
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
