import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { SpreadDetailsV1 } from '@cosmic-arcana/sdk';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { createTestApp, resetDatabase } from './support/test-app';

describe('Feature: the spreads HTTP api', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const userId = randomUUID();
  const body = { userId, question: 'will the move work out?' };

  const post = (idempotencyKey?: string) => {
    const call = request(app.getHttpServer() as App)
      .post('/spreads')
      .send(body);
    return idempotencyKey ? call.set('idempotency-key', idempotencyKey) : call;
  };

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
  });

  beforeEach(async () => {
    await resetDatabase(dataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  it('Given a new idempotency key, When posting a spread, Then it is created and readable by id', async () => {
    const created = await post(randomUUID()).expect(201);
    const spread = created.body as SpreadDetailsV1;

    expect(created.headers['idempotency-replayed']).toBe('false');
    expect(spread).toMatchObject({ userId, question: body.question });
    expect(spread.cards).toHaveLength(3);
    expect(spread.cards.map((card) => card.positionKey)).toEqual(['past', 'present', 'future']);

    const read = await request(app.getHttpServer() as App)
      .get(`/spreads/${spread.spreadId}`)
      .expect(200);
    expect(read.body).toEqual(spread);
  });

  it('Given a replayed idempotency key, When posting again, Then the stored spread is returned', async () => {
    const key = randomUUID();
    const created = await post(key).expect(201);
    const replayed = await post(key).expect(200);

    expect(replayed.headers['idempotency-replayed']).toBe('true');
    expect(replayed.body).toEqual(created.body);
  });

  it('Given no idempotency key, When posting a spread, Then the request is rejected', async () => {
    await post().expect(400);
  });

  it('Given an unknown spread id, When reading it, Then the response is 404', async () => {
    await request(app.getHttpServer() as App)
      .get(`/spreads/${randomUUID()}`)
      .expect(404);
  });
});
