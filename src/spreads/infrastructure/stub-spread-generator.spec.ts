const USER = '9d2f1a44-5c6e-4b7a-8c9d-0e1f2a3b4c5d';
const ASKED_AT = '2026-09-30T00:00:00.000Z';

import { StubSpreadGenerator } from './stub-spread-generator';

describe('StubSpreadGenerator', () => {
  const generator = new StubSpreadGenerator();

  it('draws three cards past present future for the same question every time', async () => {
    const first = await generator.generate({
      question: 'will the move work out?',
      userId: USER,
      askedAt: ASKED_AT,
    });
    const second = await generator.generate({
      question: 'will the move work out?',
      userId: USER,
      askedAt: ASKED_AT,
    });

    expect(first.cards.map((card) => card.positionKey)).toEqual(['past', 'present', 'future']);
    expect(first.cards).toHaveLength(3);
    expect(second).toEqual(first);
  });
});
