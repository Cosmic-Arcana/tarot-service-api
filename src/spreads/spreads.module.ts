import { Module } from '@nestjs/common';
import { SPREAD_GENERATOR } from './application/ports/spread-generator.port';
import { SPREAD_REPOSITORY } from './application/ports/spread-repository.port';
import { CreateSpreadHandler } from './application/commands/create-spread.handler';
import { GetSpreadHandler } from './application/queries/get-spread.handler';
import { StubSpreadGenerator } from './infrastructure/stub-spread-generator';
import { TypeOrmSpreadRepository } from './infrastructure/typeorm-spread.repository';
import { SpreadsController } from './http/spreads.controller';

@Module({
  controllers: [SpreadsController],
  providers: [
    CreateSpreadHandler,
    GetSpreadHandler,
    { provide: SPREAD_REPOSITORY, useClass: TypeOrmSpreadRepository },
    { provide: SPREAD_GENERATOR, useClass: StubSpreadGenerator },
  ],
})
export class SpreadsModule {}
