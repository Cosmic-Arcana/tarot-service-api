import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { randomUUID } from 'node:crypto';
import { getCorrelationId } from '../../../common/correlation/correlation.storage';
import { IdempotencyKeyConflictError } from '../../domain/idempotency-key-conflict.error';
import type { Spread } from '../../domain/spread';
import { SPREAD_GENERATOR, type SpreadGeneratorPort } from '../ports/spread-generator.port';
import { SPREAD_REPOSITORY, type SpreadRepositoryPort } from '../ports/spread-repository.port';
import { LiveSpreadsHub } from '../../infrastructure/live-spreads.hub';
import { spreadCreatedMessage } from '../spread-created.message';
import { CreateSpreadCommand, type CreateSpreadResult } from './create-spread.command';

@CommandHandler(CreateSpreadCommand)
export class CreateSpreadHandler implements ICommandHandler<CreateSpreadCommand> {
  private readonly logger = new Logger(CreateSpreadHandler.name);

  constructor(
    @Inject(SPREAD_REPOSITORY) private readonly spreads: SpreadRepositoryPort,
    @Inject(SPREAD_GENERATOR) private readonly generator: SpreadGeneratorPort,
    private readonly liveSpreads: LiveSpreadsHub,
  ) {}

  async execute(command: CreateSpreadCommand): Promise<CreateSpreadResult> {
    const existing = await this.spreads.findByIdempotencyKey(command.idempotencyKey);
    if (existing) {
      return this.replay(existing, command);
    }

    // Generation runs outside the transaction: it will be a slow AI call and must not hold a
    // connection. Two concurrent first requests can both generate; the unique key keeps one.
    const askedAt = new Date();
    const generated = await this.generator.generate({
      question: command.question,
      userId: command.userId,
      askedAt: askedAt.toISOString(),
    });
    const spread: Spread = {
      id: randomUUID(),
      userId: command.userId,
      question: command.question,
      idempotencyKey: command.idempotencyKey,
      cards: generated.cards,
      prediction: generated.prediction,
      createdAt: askedAt,
    };
    const correlationId = getCorrelationId() ?? randomUUID();

    const inserted = await this.spreads.insertWithOutboxMessage(
      spread,
      spreadCreatedMessage(spread, correlationId),
    );
    if (!inserted) {
      const winner = await this.spreads.findByIdempotencyKey(command.idempotencyKey);
      if (!winner) {
        throw new Error('idempotency key conflict without a stored spread');
      }
      return this.replay(winner, command);
    }

    this.liveSpreads.broadcastDrawn(spread);
    this.logger.log('create spread completed', {
      spreadId: spread.id,
      idempotencyKey: command.idempotencyKey,
      outcome: 'created',
    });
    return { spread, replayed: false };
  }

  private replay(existing: Spread, command: CreateSpreadCommand): CreateSpreadResult {
    if (existing.userId !== command.userId || existing.question !== command.question) {
      throw new IdempotencyKeyConflictError();
    }
    this.logger.log('create spread completed', {
      spreadId: existing.id,
      idempotencyKey: command.idempotencyKey,
      outcome: 'replayed',
    });
    return { spread: existing, replayed: true };
  }
}
