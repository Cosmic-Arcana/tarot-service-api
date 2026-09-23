import type { EntityManager } from 'typeorm';
import { OutboxEntity } from './outbox.entity';

export interface OutboxMessage {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: object;
  correlationId: string;
  createdAt: Date;
}

/** Must run on the same EntityManager as the aggregate write, so both commit or neither does. */
export const appendToOutbox = async (
  manager: EntityManager,
  message: OutboxMessage,
): Promise<void> => {
  await manager.insert(OutboxEntity, { ...message, status: 'pending', publishedAt: null });
};
