import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { SpreadCardEntity } from './spread-card.entity';

@Entity({ name: 'spread' })
export class SpreadEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column('uuid', { name: 'user_id' })
  userId: string;

  @Column('text')
  question: string;

  @Column('text')
  prediction: string;

  @Column('varchar', { name: 'idempotency_key', length: 128 })
  idempotencyKey: string;

  @Column('timestamptz', { name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => SpreadCardEntity, (card) => card.spread)
  cards: SpreadCardEntity[];
}
