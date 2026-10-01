import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { SPREAD_GENERATOR } from '../src/spreads/application/ports/spread-generator.port';
import type { SpreadGeneratorPort } from '../src/spreads/application/ports/spread-generator.port';
import { SpreadGeneratorUnavailableError } from '../src/spreads/domain/spread-generator-unavailable.error';
import { countRows, createTestApp, resetDatabase } from './support/test-app';

describe('Feature: a spread generator outage is reported as one, not as a bug', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const generate = jest.fn<ReturnType<SpreadGeneratorPort['generate']>, Parameters<SpreadGeneratorPort['generate']>>();

  const post = (idempotencyKey: string) =>
    request(app.getHttpServer() as App)
      .post('/spreads')
      .set('idempotency-key', idempotencyKey)
      .send({ userId: randomUUID(), question: 'will the move work out?' });

  beforeAll(async () => {
    app = await createTestApp((builder) =>
      builder.overrideProvider(SPREAD_GENERATOR).useValue({ generate }),
    );
    dataSource = app.get(DataSource);
  });

  beforeEach(async () => {
    await resetDatabase(dataSource);
    generate.mockReset();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    ['unreachable', 503, 'Service Unavailable'],
    ['timeout', 504, 'Gateway Timeout'],
    ['refused', 502, 'Bad Gateway'],
  ] as const)(
    'Given the generator is %s, When a spread is created, Then the answer is %i and says nothing about the cause',
    async (reason, status, error) => {
      generate.mockRejectedValue(new SpreadGeneratorUnavailableError(reason));

      const response = await post(randomUUID()).expect(status);

      expect(response.body).toEqual({
        statusCode: status,
        error,
        message: 'spread generator unavailable',
      });
    },
  );

  it('Given the generator failed, When the request ends, Then no spread and no event were saved', async () => {
    generate.mockRejectedValue(new SpreadGeneratorUnavailableError('unreachable'));

    await post(randomUUID()).expect(503);

    expect(await countRows(dataSource, 'spread')).toBe(0);
    expect(await countRows(dataSource, 'outbox')).toBe(0);
  });

  it('Given an outage, When the same idempotency key is retried after recovery, Then the spread is created', async () => {
    const key = randomUUID();
    generate.mockRejectedValueOnce(new SpreadGeneratorUnavailableError('timeout'));
    await post(key).expect(504);

    generate.mockResolvedValueOnce({
      cards: [{ positionKey: 'past', cardId: 'queen-of-swords', reversed: false }],
      prediction: 'a reading',
    });
    await post(key).expect(201);

    expect(await countRows(dataSource, 'spread')).toBe(1);
  });

  it('Given an unexpected bug in the generator, When a spread is created, Then it is still a 500', async () => {
    generate.mockRejectedValue(new TypeError('a real bug'));

    await post(randomUUID()).expect(500);
  });
});
