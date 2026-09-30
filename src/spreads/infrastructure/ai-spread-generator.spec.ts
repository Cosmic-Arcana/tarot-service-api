import { NEVER, of, throwError } from 'rxjs';
import { AiSpreadGenerator } from './ai-spread-generator';

const drawnCard = {
  positionKey: 'past',
  positionLabel: 'What shaped it',
  cardId: 'eight-of-pentacles',
  cardName: 'Eight of Pentacles',
  reversed: false,
  keywords: ['craft'],
  meaning: 'patient work',
};

const request = {
  question: 'should i take the job?',
  userId: '9d2f1a44-5c6e-4b7a-8c9d-0e1f2a3b4c5d',
  askedAt: '2026-09-30T00:00:00.000Z',
};

const clientReturning = (replies: Record<string, unknown>) => ({
  send: jest.fn((pattern: string) => of(replies[pattern])),
});

describe('AiSpreadGenerator', () => {
  const replies = {
    'ai.tarot.draw': { cards: [drawnCard] },
    'ai.reading.interpret': { interpretation: 'a reading', fictional: true },
  };

  it('draws the cards and asks for a reading of them', async () => {
    const client = clientReturning(replies);
    const generator = new AiSpreadGenerator(client as never, 1_000);

    const spread = await generator.generate(request);

    expect(spread.prediction).toBe('a reading');
    expect(spread.cards).toEqual([
      { positionKey: 'past', cardId: 'eight-of-pentacles', reversed: false },
    ]);

    const [drawPattern, drawMessage] = client.send.mock.calls[0];
    expect(drawPattern).toBe('ai.tarot.draw');
    expect(drawMessage).toMatchObject({
      data: {
        userId: request.userId,
        question: request.question,
        spreadId: 'three-card',
        askedAt: request.askedAt,
      },
    });
  });

  it('interprets the cards that were actually drawn', async () => {
    const client = clientReturning(replies);
    const generator = new AiSpreadGenerator(client as never, 1_000);

    await generator.generate(request);

    const [pattern, message] = client.send.mock.calls[1];
    expect(pattern).toBe('ai.reading.interpret');
    expect(message).toMatchObject({ data: { cards: [drawnCard], cosmic: null } });
  });

  it('carries a correlation id on every message', async () => {
    const client = clientReturning(replies);
    const generator = new AiSpreadGenerator(client as never, 1_000);

    await generator.generate(request);

    for (const [, message] of client.send.mock.calls) {
      expect((message as { meta: { correlationId: string } }).meta.correlationId).toMatch(/\S/);
      expect((message as { meta: { origin: string } }).meta.origin).toBe('tarot-service-api');
    }
  });

  it('fails the spread when the draw fails rather than inventing cards', async () => {
    const client = {
      send: jest.fn(() => throwError(() => new Error('ai unreachable'))),
    };
    const generator = new AiSpreadGenerator(client as never, 1_000);

    await expect(generator.generate(request)).rejects.toThrow('ai unreachable');
  });

  it('gives up on a silent service instead of holding the request open', async () => {
    const generator = new AiSpreadGenerator({ send: jest.fn(() => NEVER) } as never, 20);

    await expect(generator.generate(request)).rejects.toThrow();
  });
});
