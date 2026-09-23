import { Inject } from '@nestjs/common';
import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import type { Spread } from '../../domain/spread';
import { SPREAD_REPOSITORY, type SpreadRepositoryPort } from '../ports/spread-repository.port';
import { GetSpreadQuery } from './get-spread.query';

@QueryHandler(GetSpreadQuery)
export class GetSpreadHandler implements IQueryHandler<GetSpreadQuery> {
  constructor(@Inject(SPREAD_REPOSITORY) private readonly spreads: SpreadRepositoryPort) {}

  execute(query: GetSpreadQuery): Promise<Spread | null> {
    return this.spreads.findById(query.spreadId);
  }
}
