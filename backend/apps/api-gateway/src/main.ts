import { REDIS_CLIENT } from '@core/cache/redis.module';
import { validateEnv } from '@core/common/env-validation';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import express from 'express';
import helmet from 'helmet';
import Redis from 'ioredis';
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
import { createGatewayAuthMiddleware } from './security/gateway-auth.middleware';
import { GatewayJwtVerifierService } from './security/gateway-jwt-verifier.service';
import { createInternalDocsMiddleware } from './security/internal-docs.middleware';

async function bootstrap(): Promise<void> {
  validateEnv();
  const publicApp = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = publicApp.get(ConfigService);

  const isProd = config.get<string>('NODE_ENV') === 'production';
  const privateHost = config.get<string>('API_GATEWAY_INTERNAL_HOST', '127.0.0.1');
  const allowPublic = config.get<string>('ALLOW_PUBLIC_INTERNAL_GATEWAY') === 'true';

  if (isProd && privateHost === '0.0.0.0' && !allowPublic) {
    throw new Error(
      'Fatal: API_GATEWAY_INTERNAL_HOST cannot be set to 0.0.0.0 in production without ALLOW_PUBLIC_INTERNAL_GATEWAY=true',
    );
  }

  const redis = publicApp.get<Redis>(REDIS_CLIENT);
  const origins = config.get<string>('CORS_ORIGINS', 'http://localhost:3002').split(',');

  // 1. PUBLIC GATEWAY (Port 3000)
  publicApp.use(requestCorrelationMiddleware);
  publicApp.use(express.json());
  publicApp.use(
    createRateLimitMiddleware(
      {
        windowMs: Number(config.get<string>('GATEWAY_RATE_LIMIT_WINDOW_MS', '60000')),
        maxByPolicy: {
          auth: Number(config.get<string>('GATEWAY_RATE_LIMIT_AUTH_MAX', '20')),
          public: Number(config.get<string>('GATEWAY_RATE_LIMIT_PUBLIC_MAX', '300')),
          internal: Number(config.get<string>('GATEWAY_RATE_LIMIT_INTERNAL_MAX', '1000')),
          websocket: Number(config.get<string>('GATEWAY_RATE_LIMIT_WEBSOCKET_MAX', '120')),
        },
      },
      redis,
    ),
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

  const verifier = publicApp.get(GatewayJwtVerifierService);

  // Bind only public, compatibility, and websocket routes
  for (const route of [...publicRoutes, ...compatibilityRoutes, ...websocketRoutes]) {
    publicApp.use(
      route.gatewayPrefix,
      createGatewayAuthMiddleware(route, verifier),
      createGatewayProxy(config, route),
    );
  }

  const publicPort = config.get<number>('PORT', config.get<number>('API_GATEWAY_PORT', 3000));
  await publicApp.listen(publicPort, '0.0.0.0');
  console.log(`[Gateway] Public API Gateway listening on port ${publicPort}`);

  // 2. PRIVATE GATEWAY (Port 3010)
  const privateApp = await NestFactory.create(AppModule, { bufferLogs: true });
  const privateRedis = privateApp.get<Redis>(REDIS_CLIENT);
  privateApp.use(requestCorrelationMiddleware);
  privateApp.use(express.json());
  privateApp.use(
    createRateLimitMiddleware(
      {
        windowMs: Number(config.get<string>('GATEWAY_RATE_LIMIT_WINDOW_MS', '60000')),
        maxByPolicy: {
          auth: Number(config.get<string>('GATEWAY_RATE_LIMIT_AUTH_MAX', '20')),
          public: Number(config.get<string>('GATEWAY_RATE_LIMIT_PUBLIC_MAX', '300')),
          internal: Number(config.get<string>('GATEWAY_RATE_LIMIT_INTERNAL_MAX', '1000')),
          websocket: Number(config.get<string>('GATEWAY_RATE_LIMIT_WEBSOCKET_MAX', '120')),
        },
      },
      privateRedis,
    ),
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

  const privateVerifier = privateApp.get(GatewayJwtVerifierService);
  const docsMiddleware = createInternalDocsMiddleware(config, privateVerifier);

  // Bind internal docs middleware to Swagger and aggregated JSON endpoints
  privateApp.use('/docs', docsMiddleware);
  privateApp.use('/docs-json', docsMiddleware);
  privateApp.use('/gateway/openapi/aggregated', docsMiddleware);

  // Bind only internal routes
  for (const route of internalRoutes) {
    privateApp.use(
      route.gatewayPrefix,
      createGatewayAuthMiddleware(route, privateVerifier),
      createGatewayProxy(config, route),
    );
  }

  // Setup Swagger Aggregated UI strictly on the Private Gateway
  if (config.get('NODE_ENV') !== 'production' || config.get('ENABLE_SWAGGER') === 'true') {
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
  }

  const privatePort = config.get<number>('API_GATEWAY_INTERNAL_PORT', 3010);
  await privateApp.listen(privatePort, privateHost);
  console.log(
    `[Gateway] Private/Internal API Gateway listening on host ${privateHost} port ${privatePort}`,
  );
}

void bootstrap();
