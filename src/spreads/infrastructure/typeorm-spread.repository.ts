import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, type FindOptionsWhere } from 'typeorm';
import { appendToOutbox, type OutboxMessage } from '../../outbox/outbox-message';
import type { SpreadRepositoryPort } from '../application/ports/spread-repository.port';
import type { Spread } from '../domain/spread';
import { SpreadCardEntity } from './spread-card.entity';
import { SpreadEntity } from './spread.entity';

@Injectable()
export class TypeOrmSpreadRepository implements SpreadRepositoryPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  findById(spreadId: string): Promise<Spread | null> {
    return this.findOne({ id: spreadId });
  }

  findByIdempotencyKey(idempotencyKey: string): Promise<Spread | null> {
    return this.findOne({ idempotencyKey });
  }

  insertWithOutboxMessage(spread: Spread, message: OutboxMessage): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const result = await manager
        .createQueryBuilder()
        .insert()
        .into(SpreadEntity)
        .values({
          id: spread.id,
          userId: spread.userId,
          question: spread.question,
          prediction: spread.prediction,
          idempotencyKey: spread.idempotencyKey,
          createdAt: spread.createdAt,
        })
        .orIgnore()
        .returning('id')
        .execute();

      if ((result.raw as unknown[]).length === 0) {
        return false;
      }

      if (spread.cards.length > 0) {
        await manager.insert(
          SpreadCardEntity,
          spread.cards.map((card, ordinal) => ({ spreadId: spread.id, ordinal, ...card })),
        );
      }
      await appendToOutbox(manager, message);
      return true;
    });
  }

  private async findOne(where: FindOptionsWhere<SpreadEntity>): Promise<Spread | null> {
    const entity = await this.dataSource.getRepository(SpreadEntity).findOne({
      where,
      relations: { cards: true },
      order: { cards: { ordinal: 'ASC' } },
    });
    return entity ? toSpread(entity) : null;
  }
}

const toSpread = (entity: SpreadEntity): Spread => ({
  id: entity.id,
  userId: entity.userId,
  question: entity.question,
  idempotencyKey: entity.idempotencyKey,
  cards: entity.cards.map(({ positionKey, cardId, reversed }) => ({
    positionKey,
    cardId,
    reversed,
  })),
  prediction: entity.prediction,
  createdAt: entity.createdAt,
});
