import type { INestApplication } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { getQueueToken } from '@nestjs/bullmq';
import { randomUUID } from 'node:crypto';
import type { Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import { SPREAD_CREATED_EVENT, SPREAD_CREATED_QUEUE } from '@cosmic-arcana/sdk';
import {
  getCorrelationId,
  runWithCorrelationId,
} from '../src/common/correlation/correlation.storage';
import { CreateSpreadCommand } from '../src/spreads/application/commands/create-spread.command';
import { OutboxRelay } from '../src/outbox/outbox-relay.service';
import { createTestApp, resetDatabase } from './support/test-app';

describe('Feature: the relay hands a batch to the broker in one call', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let commandBus: CommandBus;
  let relay: OutboxRelay;
  let queue: Queue;

  const createSpread = (correlationId: string) =>
    runWithCorrelationId(correlationId, () =>
      commandBus.execute(new CreateSpreadCommand(randomUUID(), 'what is next?', randomUUID())),
    );

  const outboxRows = () =>
    dataSource.query<{ id: string; status: string; correlation_id: string }[]>(
      'SELECT id, status, correlation_id FROM outbox ORDER BY created_at, id',
    );

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

  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    await app.close();
  });

  it('Given several pending rows, When the relay runs, Then they reach the broker in one call, in creation order, and are all marked published', async () => {
    for (let index = 0; index < 5; index += 1) {
      await createSpread(`corr-order-${index}-${randomUUID().slice(0, 8)}`);
    }
    const pending = await outboxRows();
    const addBulk = jest.spyOn(queue, 'addBulk');
    const addOne = jest.spyOn(queue, 'add');

    await expect(relay.relayPending()).resolves.toBe(5);

    expect(addBulk).toHaveBeenCalledTimes(1);
    expect(addOne).not.toHaveBeenCalled();
    const jobs = addBulk.mock.calls[0][0];
    expect(jobs.map((job) => job.opts?.jobId)).toEqual(pending.map((row) => row.id));
    expect(jobs.every((job) => job.name === SPREAD_CREATED_EVENT)).toBe(true);
    expect((await outboxRows()).every((row) => row.status === 'published')).toBe(true);
    await expect(queue.getJobCountByTypes('waiting')).resolves.toBe(5);
  });

  it('Given rows from different requests, When they are published together, Then each event keeps its own correlation id', async () => {
    const first = `corr-first-${randomUUID().slice(0, 8)}`;
    const second = `corr-second-${randomUUID().slice(0, 8)}`;
    await createSpread(first);
    await createSpread(second);

    await relay.relayPending();

    const rows = await outboxRows();
    const jobs = await Promise.all(rows.map((row) => queue.getJob(row.id)));
    expect(
      jobs.map((job) => (job?.data as { meta: { correlationId: string } }).meta.correlationId),
    ).toEqual([first, second]);
  });

  it('Given a batch, When it is published, Then one completion is logged per event, each under its own correlation id', async () => {
    const ids = [
      `corr-log-a-${randomUUID().slice(0, 8)}`,
      `corr-log-b-${randomUUID().slice(0, 8)}`,
    ];
    for (const id of ids) {
      await createSpread(id);
    }
    const seen: { eventId: unknown; correlationId: string | undefined }[] = [];
    jest.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown, fields?: unknown) => {
      if (message === 'outbound publish completed') {
        seen.push({
          eventId: (fields as { eventId: unknown }).eventId,
          correlationId: getCorrelationId(),
        });
      }
    });

    await relay.relayPending();

    expect(seen.map((entry) => entry.correlationId)).toEqual(ids);
    expect(seen.map((entry) => entry.eventId)).toEqual((await outboxRows()).map((row) => row.id));
  });

  it('Given the broker refuses the batch, When the relay runs, Then nothing is marked published, the failure is logged once, and the next run publishes everything', async () => {
    await createSpread(`corr-fail-${randomUUID().slice(0, 8)}`);
    await createSpread(`corr-fail-${randomUUID().slice(0, 8)}`);
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(queue, 'addBulk').mockRejectedValueOnce(new Error('redis is down'));

    await expect(relay.relayPending()).resolves.toBe(0);

    expect((await outboxRows()).map((row) => row.status)).toEqual(['pending', 'pending']);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      'outbound publish failed',
      expect.objectContaining({ outcome: 'error', batchSize: 2 }),
    );

    await expect(relay.relayPending()).resolves.toBe(2);
    expect((await outboxRows()).map((row) => row.status)).toEqual(['published', 'published']);
  });

  it('Given the broker already holds an event, When it is published again after a crash, Then the broker still holds it once', async () => {
    await createSpread(`corr-dupe-${randomUUID().slice(0, 8)}`);
    await relay.relayPending();
    await dataSource.query("UPDATE outbox SET status = 'pending', published_at = NULL");

    await expect(relay.relayPending()).resolves.toBe(1);

    await expect(queue.getJobCountByTypes('waiting')).resolves.toBe(1);
  });

  it('Given no pending rows, When the relay runs, Then the broker is not called at all', async () => {
    const addBulk = jest.spyOn(queue, 'addBulk');

    await expect(relay.relayPending()).resolves.toBe(0);

    expect(addBulk).not.toHaveBeenCalled();
  });

  it('Given a backlog larger than a batch, When the relay drains it, Then it takes one broker call per batch, not one per event', async () => {
    for (let index = 0; index < 120; index += 1) {
      await createSpread(`corr-many-${index}`);
    }
    const addBulk = jest.spyOn(queue, 'addBulk');

    let published = 0;
    for (let batch = 0; batch < 10 && published < 120; batch += 1) {
      published += await relay.relayPending();
    }

    expect(published).toBe(120);
    // The test configuration uses the default batch size of 50.
    expect(addBulk.mock.calls.length).toBeLessThanOrEqual(3);
    await expect(queue.getJobCountByTypes('waiting')).resolves.toBe(120);
  });
});
