import { Logger } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { NEVER, of, throwError } from 'rxjs';
import { SpreadGeneratorUnavailableError } from '../domain/spread-generator-unavailable.error';
import { AiSpreadGenerator } from './ai-spread-generator';

const request = { question: 'will it work?', userId: 'user-1', askedAt: '2026-10-01T10:00:00.000Z' };

const drawn = {
  cards: [
    { positionKey: 'past', cardId: 'queen-of-swords', reversed: false, positionLabel: 'Past', cardName: 'Queen of Swords', keywords: [], meaning: '' },
  ],
};

const clientReturning = (send: ClientProxy['send']) => ({ send }) as unknown as ClientProxy;

describe('Feature: generate a spread through ai-service-api', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });
  afterEach(() => jest.restoreAllMocks());

  it('Given the ai service answers, When a spread is generated, Then the drawn cards and the interpretation come back', async () => {
    const send = jest
      .fn()
      .mockReturnValueOnce(of(drawn))
      .mockReturnValueOnce(of({ interpretation: 'a reading', fictional: true }));
    const generator = new AiSpreadGenerator(clientReturning(send), 1_000);

    const spread = await generator.generate(request);

    expect(spread).toEqual({
      cards: [{ positionKey: 'past', cardId: 'queen-of-swords', reversed: false }],
      prediction: 'a reading',
    });
  });

  it('Given the ai service cannot be reached, When a spread is generated, Then the failure is reported as unreachable', async () => {
    const refused = Object.assign(new Error('getaddrinfo ENOTFOUND ai-service-api'), { code: 'ENOTFOUND' });
    const generator = new AiSpreadGenerator(clientReturning(() => throwError(() => refused)), 1_000);

    await expect(generator.generate(request)).rejects.toMatchObject({
      name: 'SpreadGeneratorUnavailableError',
      reason: 'unreachable',
    });
  });

  it('Given the ai service never answers, When a spread is generated, Then it gives up in time and reports a timeout', async () => {
    const generator = new AiSpreadGenerator(clientReturning(() => NEVER), 30);

    await expect(generator.generate(request)).rejects.toMatchObject({ reason: 'timeout' });
  });

  it('Given the ai service answers with an error, When a spread is generated, Then it is reported as a refusal', async () => {
    const generator = new AiSpreadGenerator(
      clientReturning(() => throwError(() => ({ message: 'invalid payload' }))),
      1_000,
    );

    await expect(generator.generate(request)).rejects.toMatchObject({ reason: 'refused' });
  });

  it('Given any failure, When it is reported, Then the error says nothing about hosts or ports', async () => {
    const refused = Object.assign(new Error('connect ECONNREFUSED 10.1.2.3:4001'), { code: 'ECONNREFUSED' });
    const generator = new AiSpreadGenerator(clientReturning(() => throwError(() => refused)), 1_000);

    const error = await generator.generate(request).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(SpreadGeneratorUnavailableError);
    expect((error as Error).message).not.toMatch(/10\.1\.2\.3|ECONNREFUSED|4001/);
  });

  it('Given a failure, When it is reported, Then the cause is still logged once at the boundary', async () => {
    const refused = Object.assign(new Error('boom'), { code: 'ECONNRESET' });
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const generator = new AiSpreadGenerator(clientReturning(() => throwError(() => refused)), 1_000);

    await generator.generate(request).catch(() => undefined);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('outbound call failed', expect.objectContaining({ outcome: 'error' }));
  });
});
