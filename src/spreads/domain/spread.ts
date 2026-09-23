export interface SpreadCard {
  positionKey: string;
  cardId: string;
  reversed: boolean;
}

export interface Spread {
  id: string;
  userId: string;
  question: string;
  idempotencyKey: string;
  cards: SpreadCard[];
  prediction: string;
  createdAt: Date;
}
