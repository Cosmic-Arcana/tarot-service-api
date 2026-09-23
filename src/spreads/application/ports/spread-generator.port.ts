import type { SpreadCard } from '../../domain/spread';

export const SPREAD_GENERATOR = Symbol('SPREAD_GENERATOR');

// TODO(product): the spread shape, card set and prediction format are undefined. ai-service-api
// will back this port; until then only the stub exists.
export interface GeneratedSpread {
  cards: SpreadCard[];
  prediction: string;
}

export interface SpreadGeneratorPort {
  generate(question: string): Promise<GeneratedSpread>;
}
