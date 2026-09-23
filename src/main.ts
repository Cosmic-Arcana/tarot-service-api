import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { LogLevel } from '@nestjs/common';
import { AppModule } from './app.module';
import type { AppConfig } from './config/configuration';
import { StructuredLogger } from './common/logging/structured-logger.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const config = app.get(ConfigService);
  const logger = new StructuredLogger(
    config.getOrThrow<string>('serviceName'),
    config.getOrThrow<LogLevel>('logLevel'),
  );
  app.useLogger(logger);
  app.enableShutdownHooks();

  const http = config.getOrThrow<AppConfig['http']>('http');
  await app.listen(http.port);

  logger.log('service started', {
    context: 'Bootstrap',
    httpPort: http.port,
    nodeEnv: config.getOrThrow<string>('nodeEnv'),
  });
}

void bootstrap();
