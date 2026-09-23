import type { OutboxMessage } from '../../../outbox/outbox-message';
import type { Spread } from '../../domain/spread';

export const SPREAD_REPOSITORY = Symbol('SPREAD_REPOSITORY');

export interface SpreadRepositoryPort {
  findById(spreadId: string): Promise<Spread | null>;
  findByIdempotencyKey(idempotencyKey: string): Promise<Spread | null>;
  /**
   * Writes the spread and its outbox message in one transaction. Returns false and writes
   * nothing when a concurrent request already took the idempotency key.
   */
  insertWithOutboxMessage(spread: Spread, message: OutboxMessage): Promise<boolean>;
}
