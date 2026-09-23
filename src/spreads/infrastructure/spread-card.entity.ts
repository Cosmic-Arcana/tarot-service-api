import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { SpreadEntity } from './spread.entity';

@Entity({ name: 'spread_card' })
export class SpreadCardEntity {
  @PrimaryColumn('uuid', { name: 'spread_id' })
  spreadId: string;

  @PrimaryColumn('smallint')
  ordinal: number;

  @Column('varchar', { name: 'position_key', length: 64 })
  positionKey: string;

  @Column('varchar', { name: 'card_id', length: 64 })
  cardId: string;

  @Column('boolean')
  reversed: boolean;

  @ManyToOne(() => SpreadEntity, (spread) => spread.cards, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'spread_id' })
  spread?: SpreadEntity;
}
