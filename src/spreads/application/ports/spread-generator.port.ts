import type { SpreadCard } from '../../domain/spread';

export const SPREAD_GENERATOR = Symbol('SPREAD_GENERATOR');

/** One 3-card spread: past / present / future, plus the reading written for it. */
export interface GeneratedSpread {
  cards: SpreadCard[];
  prediction: string;
}

/**
 * Who the reading is for travels with the request: ai-service-api seeds the draw from the user, the
 * question and the day, so a retry replays the same cards instead of drawing new ones.
 */
export interface GenerateSpreadRequest {
  question: string;
  userId: string;
  askedAt: string;
}

export interface SpreadGeneratorPort {
  generate(request: GenerateSpreadRequest): Promise<GeneratedSpread>;
}
