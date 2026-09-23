import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { AppConfig } from '../config/configuration';
import { OutboxEntity } from '../outbox/outbox.entity';
import { SpreadCardEntity } from '../spreads/infrastructure/spread-card.entity';
import { SpreadEntity } from '../spreads/infrastructure/spread.entity';
import { CreateSpreadAndOutbox1790092012000 } from './migrations/1790092012000-create-spread-and-outbox';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const database = config.getOrThrow<AppConfig['database']>('database');
        return {
          type: 'postgres',
          url: database.url,
          entities: [SpreadEntity, SpreadCardEntity, OutboxEntity],
          migrations: [CreateSpreadAndOutbox1790092012000],
          migrationsRun: database.runMigrations,
          synchronize: false,
          // TypeORM's logger writes to the console, which bypasses the structured logger.
          logging: false,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
