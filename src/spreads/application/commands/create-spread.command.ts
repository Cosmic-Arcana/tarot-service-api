import { Command } from '@nestjs/cqrs';
import type { Spread } from '../../domain/spread';

export interface CreateSpreadResult {
  spread: Spread;
  replayed: boolean;
}

export class CreateSpreadCommand extends Command<CreateSpreadResult> {
  constructor(
    readonly userId: string,
    readonly question: string,
    readonly idempotencyKey: string,
  ) {
    super();
  }
}
