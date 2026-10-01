import type { INestApplication } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { getQueueToken } from '@nestjs/bullmq';
import { randomUUID } from 'node:crypto';
import type { Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import {
  parseSpreadCreatedEnvelope,
  SPREAD_CREATED_EVENT,
  SPREAD_CREATED_QUEUE,
} from '@cosmic-arcana/sdk';
import { CreateSpreadCommand } from '../src/spreads/application/commands/create-spread.command';
import { OutboxRelay } from '../src/outbox/outbox-relay.service';
import { createTestApp, resetDatabase } from './support/test-app';

describe('Feature: relay the outbox to the broker', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let commandBus: CommandBus;
  let relay: OutboxRelay;
  let queue: Queue;

  const userId = randomUUID();

  const createSpread = () =>
    commandBus.execute(new CreateSpreadCommand(userId, 'what is next?', randomUUID()));

  const outboxRow = (spreadId: string) =>
    dataSource
      .query<{ id: string; correlation_id: string; status: string; published_at: Date | null }[]>(
        'SELECT id, correlation_id, status, published_at FROM outbox WHERE aggregate_id = $1',
        [spreadId],
      )
      .then((rows) => rows[0]);

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
    commandBus = app.get(CommandBus);
    relay = app.get(OutboxRelay);
    queue = app.get<Queue>(getQueueToken(SPREAD_CREATED_QUEUE));
  });

  beforeEach(async () => {
    await resetDatabase(dataSource);
    await queue.obliterate({ force: true });
  });

  afterAll(async () => {
    await app.close();
  });

  it('Given a pending outbox row, When the relay runs, Then spread.created is published and the row is marked published', async () => {
    const { spread } = await createSpread();
    const pending = await outboxRow(spread.id);

    await expect(relay.relayPending()).resolves.toBe(1);

    const job = await queue.getJob(pending.id);
    expect(job?.name).toBe(SPREAD_CREATED_EVENT);
    expect(parseSpreadCreatedEnvelope(job?.data)).toEqual({
      meta: { correlationId: pending.correlation_id, producer: 'tarot-service-api' },
      data: {
        version: 1,
        eventId: pending.id,
        spreadId: spread.id,
        userId,
        occurredAt: spread.createdAt.toISOString(),
      },
    });

    const published = await outboxRow(spread.id);
    expect(published.status).toBe('published');
    expect(published.published_at).not.toBeNull();
  });

  it('Given every row is published, When the relay runs again, Then nothing is republished', async () => {
    await createSpread();
    await relay.relayPending();

    await expect(relay.relayPending()).resolves.toBe(0);
    await expect(queue.getJobCountByTypes('waiting')).resolves.toBe(1);
  });
});

describe('Feature: the relay drains a backlog without idling between full batches', () => {
  const pollIntervalMs = 1_500;
  const batchSize = 5;
  const backlog = 23;
  let app: INestApplication;
  let dataSource: DataSource;
  const overridden = {
    OUTBOX_RELAY_ENABLED: process.env.OUTBOX_RELAY_ENABLED,
    OUTBOX_POLL_INTERVAL_MS: process.env.OUTBOX_POLL_INTERVAL_MS,
    OUTBOX_BATCH_SIZE: process.env.OUTBOX_BATCH_SIZE,
  };

  const pendingCount = () =>
    dataSource
      .query<[{ count: string }]>(
        `SELECT count(*)::text AS count FROM outbox WHERE status = 'pending'`,
      )
      .then(([{ count }]) => Number(count));

  beforeAll(async () => {
    process.env.OUTBOX_RELAY_ENABLED = 'true';
    process.env.OUTBOX_POLL_INTERVAL_MS = String(pollIntervalMs);
    process.env.OUTBOX_BATCH_SIZE = String(batchSize);
    app = await createTestApp();
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
    for (const [key, value] of Object.entries(overridden)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('Given a backlog of several batches, When the relay ticks, Then every row is published within one poll interval of the first tick', async () => {
    await resetDatabase(dataSource);
    const commandBus = app.get(CommandBus);
    for (let i = 0; i < backlog; i += 1) {
      await commandBus.execute(
        new CreateSpreadCommand(randomUUID(), `question ${i}`, randomUUID()),
      );
    }

    const deadline = Date.now() + 2 * pollIntervalMs + 500;
    while ((await pendingCount()) > 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    await expect(pendingCount()).resolves.toBe(0);
  });
});
