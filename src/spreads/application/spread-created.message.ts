import { randomUUID } from 'node:crypto';
import { SPREAD_CREATED_EVENT, type SpreadCreatedV1 } from '@cosmic-arcana/sdk';
import type { OutboxMessage } from '../../outbox/outbox-message';
import type { Spread } from '../domain/spread';

export const spreadCreatedMessage = (spread: Spread, correlationId: string): OutboxMessage => {
  const event: SpreadCreatedV1 = {
    version: 1,
    eventId: randomUUID(),
    spreadId: spread.id,
    userId: spread.userId,
    occurredAt: spread.createdAt.toISOString(),
  };

  return {
    id: event.eventId,
    aggregateType: 'spread',
    aggregateId: spread.id,
    eventType: SPREAD_CREATED_EVENT,
    payload: event,
    correlationId,
    createdAt: spread.createdAt,
  };
};
