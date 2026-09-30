import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { randomUUID } from 'node:crypto';
import { firstValueFrom, timeout } from 'rxjs';
import { getCorrelationId } from '../../common/correlation/correlation.storage';
import { elapsedMs } from '../../common/logging/elapsed-ms';
import type {
  GeneratedSpread,
  GenerateSpreadRequest,
  SpreadGeneratorPort,
} from '../application/ports/spread-generator.port';
import type { SpreadCard } from '../domain/spread';

export const AI_SERVICE_CLIENT = Symbol('AI_SERVICE_CLIENT');

/** Message patterns owned by ai-service-api. */
const DRAW_CARDS = 'ai.tarot.draw';
const INTERPRET_READING = 'ai.reading.interpret';

/** The only spread the product offers today. */
const SPREAD_ID = 'three-card';

interface DrawnCard extends SpreadCard {
  positionLabel: string;
  cardName: string;
  keywords: readonly string[];
  meaning: string;
}

interface DrawResult {
  cards: DrawnCard[];
}

interface InterpretationResult {
  text: string;
}

/**
 * Real generation: ai-service-api draws the cards and writes the reading. Two calls rather than one
 * because the draw is deterministic and cheap while the interpretation is the part that will one day
 * cost money — keeping them apart lets the interpretation be retried or swapped without redrawing.
 */
@Injectable()
export class AiSpreadGenerator implements SpreadGeneratorPort {
  private readonly logger = new Logger(AiSpreadGenerator.name);

  constructor(
    @Inject(AI_SERVICE_CLIENT) private readonly client: ClientProxy,
    private readonly timeoutMs: number,
  ) {}

  async generate({ question, userId, askedAt }: GenerateSpreadRequest): Promise<GeneratedSpread> {
    const startedAt = process.hrtime.bigint();

    try {
      const draw = await this.send<DrawResult>(DRAW_CARDS, {
        userId,
        question,
        spreadId: SPREAD_ID,
        askedAt,
      });
      const reading = await this.send<InterpretationResult>(INTERPRET_READING, {
        question,
        cards: draw.cards,
        cosmic: null,
      });

      this.logger.log('outbound call completed', {
        messagePattern: `${DRAW_CARDS}+${INTERPRET_READING}`,
        durationMs: elapsedMs(startedAt),
        outcome: 'success',
      });

      return {
        cards: draw.cards.map(({ positionKey, cardId, reversed }) => ({
          positionKey,
          cardId,
          reversed,
        })),
        prediction: reading.text,
      };
    } catch (error) {
      const { name, message } = error as Error;
      this.logger.warn('outbound call failed', {
        messagePattern: `${DRAW_CARDS}+${INTERPRET_READING}`,
        durationMs: elapsedMs(startedAt),
        outcome: 'error',
        errorName: name,
        errorMessage: message,
      });
      throw error;
    }
  }

  private send<T>(pattern: string, data: unknown): Promise<T> {
    // The transport carries no headers, so the correlation id travels inside the message.
    const envelope = {
      meta: {
        correlationId: getCorrelationId() ?? randomUUID(),
        issuedAt: new Date().toISOString(),
        origin: 'tarot-service-api',
      },
      data,
    };
    return firstValueFrom(this.client.send<T>(pattern, envelope).pipe(timeout(this.timeoutMs)));
  }
}
