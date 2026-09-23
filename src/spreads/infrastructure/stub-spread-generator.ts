import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type {
  GeneratedSpread,
  SpreadGeneratorPort,
} from '../application/ports/spread-generator.port';

/** Deterministic placeholder until ai-service-api backs the port. Holds no tarot logic. */
@Injectable()
export class StubSpreadGenerator implements SpreadGeneratorPort {
  generate(question: string): Promise<GeneratedSpread> {
    const digest = createHash('sha256').update(question).digest('hex');
    return Promise.resolve({
      cards: [
        {
          positionKey: 'stub',
          cardId: `stub-${digest.slice(0, 8)}`,
          reversed: parseInt(digest[8], 16) % 2 === 1,
        },
      ],
      prediction: `stub prediction ${digest.slice(0, 12)}`,
    });
  }
}
