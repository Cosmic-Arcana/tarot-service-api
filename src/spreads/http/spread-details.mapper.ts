import type { SpreadDetailsV1 } from '@cosmic-arcana/sdk';
import type { Spread } from '../domain/spread';

export const toSpreadDetailsV1 = (spread: Spread): SpreadDetailsV1 => ({
  spreadId: spread.id,
  userId: spread.userId,
  question: spread.question,
  cards: spread.cards.map(({ positionKey, cardId, reversed }) => ({
    positionKey,
    cardId,
    reversed,
  })),
  prediction: spread.prediction,
  createdAt: spread.createdAt.toISOString(),
});
