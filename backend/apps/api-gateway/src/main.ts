import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { CentralizedExceptionFilter } from './centralized-exception.filter';
import {
  publicRoutes,
  compatibilityRoutes,
  websocketRoutes,
  internalRoutes,
} from './gateway-route.config';
import { createGatewayProxy } from './proxy.factory';
import { createRateLimitMiddleware } from './rate-limit.middleware';
import { requestCorrelationMiddleware } from './request-correlation.middleware';

async function bootstrap(): Promise<void> {
  const publicApp = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = publicApp.get(ConfigService);
  const origins = config.get<string>('CORS_ORIGINS', 'http://localhost:3002').split(',');

  // 1. PUBLIC GATEWAY (Port 3000)
  publicApp.use(requestCorrelationMiddleware);
  publicApp.use(
    createRateLimitMiddleware({
      windowMs: Number(config.get<string>('GATEWAY_RATE_LIMIT_WINDOW_MS', '60000')),
      maxByPolicy: {
        auth: Number(config.get<string>('GATEWAY_RATE_LIMIT_AUTH_MAX', '20')),
        public: Number(config.get<string>('GATEWAY_RATE_LIMIT_PUBLIC_MAX', '300')),
        internal: Number(config.get<string>('GATEWAY_RATE_LIMIT_INTERNAL_MAX', '1000')),
        websocket: Number(config.get<string>('GATEWAY_RATE_LIMIT_WEBSOCKET_MAX', '120')),
      },
    }),
  );
  publicApp.use(helmet());
  publicApp.enableCors({
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
  publicApp.useGlobalFilters(new CentralizedExceptionFilter());

  // Bind only public, compatibility, and websocket routes
  for (const route of [...publicRoutes, ...compatibilityRoutes, ...websocketRoutes]) {
    publicApp.use(route.gatewayPrefix, createGatewayProxy(config, route));
  }

  const publicPort = config.get<number>('PORT', config.get<number>('API_GATEWAY_PORT', 3000));
  await publicApp.listen(publicPort, '0.0.0.0');
  console.log(`[Gateway] Public API Gateway listening on port ${publicPort}`);

  // 2. PRIVATE GATEWAY (Port 3010)
  const privateApp = await NestFactory.create(AppModule, { bufferLogs: true });
  privateApp.use(requestCorrelationMiddleware);
  privateApp.use(
    createRateLimitMiddleware({
      windowMs: Number(config.get<string>('GATEWAY_RATE_LIMIT_WINDOW_MS', '60000')),
      maxByPolicy: {
        auth: Number(config.get<string>('GATEWAY_RATE_LIMIT_AUTH_MAX', '20')),
        public: Number(config.get<string>('GATEWAY_RATE_LIMIT_PUBLIC_MAX', '300')),
        internal: Number(config.get<string>('GATEWAY_RATE_LIMIT_INTERNAL_MAX', '1000')),
        websocket: Number(config.get<string>('GATEWAY_RATE_LIMIT_WEBSOCKET_MAX', '120')),
      },
    }),
  );
  privateApp.use(helmet());
  privateApp.enableCors({
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
  privateApp.useGlobalFilters(new CentralizedExceptionFilter());

  // Bind only internal routes
  for (const route of internalRoutes) {
    privateApp.use(route.gatewayPrefix, createGatewayProxy(config, route));
  }

  // Setup Swagger Aggregated UI strictly on the Private Gateway
  const swaggerConfig = new DocumentBuilder()
    .setTitle('MedCRM API Gateway (Internal)')
    .setDescription('Gateway for MedCRM internal APIs & Documentation')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(privateApp, swaggerConfig);
  SwaggerModule.setup('docs', privateApp, document, {
    jsonDocumentUrl: 'docs-json',
    swaggerOptions: {
      urls: [
        {
          url: '/gateway/openapi/aggregated',
          name: 'Aggregated MedCRM APIs',
        },
        {
          url: '/docs-json',
          name: 'Gateway Management APIs',
        },
      ],
    },
  });

  const privatePort = config.get<number>('API_GATEWAY_INTERNAL_PORT', 3010);
  await privateApp.listen(privatePort, '0.0.0.0');
  console.log(`[Gateway] Private/Internal API Gateway listening on port ${privatePort}`);
}

void bootstrap();
