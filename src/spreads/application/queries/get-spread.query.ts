import { Query } from '@nestjs/cqrs';
import type { Spread } from '../../domain/spread';

export class GetSpreadQuery extends Query<Spread | null> {
  constructor(readonly spreadId: string) {
    super();
  }
}
