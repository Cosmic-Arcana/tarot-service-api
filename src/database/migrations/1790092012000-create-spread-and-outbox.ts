import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSpreadAndOutbox1790092012000 implements MigrationInterface {
  name = 'CreateSpreadAndOutbox1790092012000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE spread (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL,
        question text NOT NULL,
        prediction text NOT NULL,
        idempotency_key varchar(128) NOT NULL,
        created_at timestamptz NOT NULL,
        CONSTRAINT spread_idempotency_key_uq UNIQUE (idempotency_key)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE spread_card (
        spread_id uuid NOT NULL REFERENCES spread (id) ON DELETE CASCADE,
        ordinal smallint NOT NULL,
        position_key varchar(64) NOT NULL,
        card_id varchar(64) NOT NULL,
        reversed boolean NOT NULL,
        PRIMARY KEY (spread_id, ordinal)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE outbox (
        id uuid PRIMARY KEY,
        aggregate_type varchar(64) NOT NULL,
        aggregate_id uuid NOT NULL,
        event_type varchar(128) NOT NULL,
        payload jsonb NOT NULL,
        correlation_id varchar(128) NOT NULL,
        status varchar(16) NOT NULL DEFAULT 'pending'
          CONSTRAINT outbox_status_ck CHECK (status IN ('pending', 'published')),
        created_at timestamptz NOT NULL DEFAULT now(),
        published_at timestamptz
      )
    `);
    await queryRunner.query(
      `CREATE INDEX outbox_pending_idx ON outbox (created_at) WHERE status = 'pending'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE outbox');
    await queryRunner.query('DROP TABLE spread_card');
    await queryRunner.query('DROP TABLE spread');
  }
}
