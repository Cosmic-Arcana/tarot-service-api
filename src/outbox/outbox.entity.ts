import { Column, Entity, PrimaryColumn } from 'typeorm';

export type OutboxStatus = 'pending' | 'published';

@Entity({ name: 'outbox' })
export class OutboxEntity {
  /** Doubles as the published event's eventId and the BullMQ jobId. */
  @PrimaryColumn('uuid')
  id: string;

  @Column('varchar', { name: 'aggregate_type', length: 64 })
  aggregateType: string;

  @Column('uuid', { name: 'aggregate_id' })
  aggregateId: string;

  @Column('varchar', { name: 'event_type', length: 128 })
  eventType: string;

  @Column('jsonb')
  payload: object;

  @Column('varchar', { name: 'correlation_id', length: 128 })
  correlationId: string;

  @Column('varchar', { length: 16 })
  status: OutboxStatus;

  @Column('timestamptz', { name: 'created_at' })
  createdAt: Date;

  @Column('timestamptz', { name: 'published_at', nullable: true })
  publishedAt: Date | null;
}
