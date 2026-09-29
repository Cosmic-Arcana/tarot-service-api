import type { SpreadCard } from '../../domain/spread';

export const SPREAD_GENERATOR = Symbol('SPREAD_GENERATOR');

/** One 3-card spread: past / present / future. Stub prediction until the LLM path is wired. */
export interface GeneratedSpread {
  cards: SpreadCard[];
  prediction: string;
}

export interface SpreadGeneratorPort {
  generate(question: string): Promise<GeneratedSpread>;
}
