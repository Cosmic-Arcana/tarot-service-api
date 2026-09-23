import type { INestApplication } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { parseSpreadCreatedV1, SPREAD_CREATED_EVENT } from '@cosmic-arcana/sdk';
import { CreateSpreadCommand } from '../src/spreads/application/commands/create-spread.command';
import {
  SPREAD_GENERATOR,
  type SpreadGeneratorPort,
} from '../src/spreads/application/ports/spread-generator.port';
import { IdempotencyKeyConflictError } from '../src/spreads/domain/idempotency-key-conflict.error';
import { countRows, createTestApp, resetDatabase } from './support/test-app';

describe('Feature: create a spread', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let commandBus: CommandBus;
  let generate: jest.SpyInstance;

  const userId = randomUUID();
  const question = 'should i take the job?';

  const createSpread = (overrides: Partial<CreateSpreadCommand> = {}) =>
    commandBus.execute(
      new CreateSpreadCommand(
        overrides.userId ?? userId,
        overrides.question ?? question,
        overrides.idempotencyKey ?? 'idempotency-key-1',
      ),
    );

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
    commandBus = app.get(CommandBus);
    generate = jest.spyOn(app.get<SpreadGeneratorPort>(SPREAD_GENERATOR), 'generate');
  });

  beforeEach(async () => {
    await resetDatabase(dataSource);
    generate.mockClear();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Given a question, When CreateSpread, Then the spread and its outbox row are written in the same transaction', async () => {
    const { spread, replayed } = await createSpread();

    expect(replayed).toBe(false);

    const [spreadRow] = await dataSource.query<[{ tx: string }]>(
      'SELECT xmin::text AS tx FROM spread WHERE id = $1',
      [spread.id],
    );
    const outboxRows = await dataSource.query<
      { id: string; tx: string; event_type: string; status: string; payload: unknown }[]
    >(
      'SELECT id, xmin::text AS tx, event_type, status, payload FROM outbox WHERE aggregate_id = $1',
      [spread.id],
    );

    expect(outboxRows).toHaveLength(1);
    // Rows written by the same transaction carry the same xmin.
    expect(outboxRows[0].tx).toBe(spreadRow.tx);
    expect(outboxRows[0].event_type).toBe(SPREAD_CREATED_EVENT);
    expect(outboxRows[0].status).toBe('pending');
    expect(parseSpreadCreatedV1(outboxRows[0].payload)).toEqual({
      version: 1,
      eventId: outboxRows[0].id,
      spreadId: spread.id,
      userId,
      occurredAt: spread.createdAt.toISOString(),
    });
  });

  it('Given the outbox write fails, When CreateSpread, Then no spread is persisted', async () => {
    await dataSource.query(
      `CREATE FUNCTION reject_outbox() RETURNS trigger LANGUAGE plpgsql AS $$
       BEGIN RAISE EXCEPTION 'outbox unavailable'; END $$`,
    );
    await dataSource.query(
      'CREATE TRIGGER reject_outbox BEFORE INSERT ON outbox FOR EACH ROW EXECUTE FUNCTION reject_outbox()',
    );

    try {
      await expect(createSpread()).rejects.toThrow('outbox unavailable');
    } finally {
      await dataSource.query('DROP TRIGGER reject_outbox ON outbox');
      await dataSource.query('DROP FUNCTION reject_outbox()');
    }

    expect(await countRows(dataSource, 'spread')).toBe(0);
    expect(await countRows(dataSource, 'spread_card')).toBe(0);
  });

  it('Given the same idempotencyKey twice, When CreateSpread twice, Then one spread exists and both calls return it', async () => {
    const first = await createSpread();
    const second = await createSpread();

    expect(second.replayed).toBe(true);
    expect(second.spread).toEqual(first.spread);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(await countRows(dataSource, 'spread')).toBe(1);
    expect(await countRows(dataSource, 'outbox')).toBe(1);
  });

  it('Given the same idempotencyKey concurrently, When CreateSpread twice, Then one spread exists', async () => {
    const results = await Promise.all([createSpread(), createSpread()]);

    expect(results[0].spread.id).toBe(results[1].spread.id);
    expect(results.map((result) => result.replayed).sort()).toEqual([false, true]);
    expect(await countRows(dataSource, 'spread')).toBe(1);
    expect(await countRows(dataSource, 'outbox')).toBe(1);
  });

  it('Given an idempotencyKey reused for a different question, When CreateSpread, Then it is rejected', async () => {
    await createSpread();

    await expect(createSpread({ question: 'something else' })).rejects.toBeInstanceOf(
      IdempotencyKeyConflictError,
    );
    expect(await countRows(dataSource, 'spread')).toBe(1);
  });
});
