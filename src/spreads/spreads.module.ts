import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import type { AppConfig } from '../config/configuration';
import { SPREAD_GENERATOR } from './application/ports/spread-generator.port';
import { SPREAD_REPOSITORY } from './application/ports/spread-repository.port';
import { CreateSpreadHandler } from './application/commands/create-spread.handler';
import { GetSpreadHandler } from './application/queries/get-spread.handler';
import { AI_SERVICE_CLIENT, AiSpreadGenerator } from './infrastructure/ai-spread-generator';
import { StubSpreadGenerator } from './infrastructure/stub-spread-generator';
import { LiveSpreadsHub } from './infrastructure/live-spreads.hub';
import { TypeOrmSpreadRepository } from './infrastructure/typeorm-spread.repository';
import { SpreadsController } from './http/spreads.controller';

@Module({
  controllers: [SpreadsController],
  providers: [
    LiveSpreadsHub,
    CreateSpreadHandler,
    GetSpreadHandler,
    StubSpreadGenerator,
    { provide: SPREAD_REPOSITORY, useClass: TypeOrmSpreadRepository },
    {
      provide: AI_SERVICE_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const ai = config.getOrThrow<AppConfig['aiService']>('aiService');
        return ClientProxyFactory.create({
          transport: Transport.TCP,
          options: { host: ai.host, port: ai.port },
        });
      },
    },
    {
      // One switch decides where a reading comes from, so a developer without ai-service-api running
      // still gets a complete, deterministic flow.
      provide: SPREAD_GENERATOR,
      inject: [ConfigService, AI_SERVICE_CLIENT, StubSpreadGenerator],
      useFactory: (config: ConfigService, client: ClientProxy, stub: StubSpreadGenerator) => {
        const ai = config.getOrThrow<AppConfig['aiService']>('aiService');
        return ai.generator === 'ai-service' ? new AiSpreadGenerator(client, ai.timeoutMs) : stub;
      },
    },
  ],
})
export class SpreadsModule {}
