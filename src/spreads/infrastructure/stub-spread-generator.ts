import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type {
  GeneratedSpread,
  SpreadGeneratorPort,
} from '../application/ports/spread-generator.port';

const POSITIONS = ['past', 'present', 'future'] as const;

/** Deterministic 3-card draw. Meanings still come from the stub prediction string. */
@Injectable()
export class StubSpreadGenerator implements SpreadGeneratorPort {
  generate(question: string): Promise<GeneratedSpread> {
    const digest = createHash('sha256').update(question).digest('hex');
    const cards = POSITIONS.map((positionKey, index) => {
      const slice = digest.slice(index * 8, index * 8 + 8);
      return {
        positionKey,
        cardId: `stub-${slice}`,
        reversed: parseInt(digest[24 + index], 16) % 2 === 1,
      };
    });
    return Promise.resolve({
      cards: [...cards],
      prediction: `stub prediction ${digest.slice(0, 12)}`,
    });
  }
}
