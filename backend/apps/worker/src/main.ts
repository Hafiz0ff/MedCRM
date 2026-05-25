import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerAppModule } from './worker-app.module';

async function bootstrap() {
  const logger = new Logger('WorkerBootstrap');
  logger.log('Starting MedCRM background worker process...');

  const app = await NestFactory.createApplicationContext(WorkerAppModule);
  app.enableShutdownHooks();

  const shutdown = async (signal: string) => {
    logger.log(`Received signal ${signal}, shutting down background worker context...`);
    await app.close();
    logger.log('Worker process terminated cleanly.');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  logger.log('Worker context initialized successfully. Awaiting jobs...');
}

bootstrap().catch((err) => {
  console.error('Fatal error during worker bootstrap:', err);
  process.exit(1);
});
