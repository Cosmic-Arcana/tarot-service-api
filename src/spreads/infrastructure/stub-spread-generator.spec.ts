import { StubSpreadGenerator } from './stub-spread-generator';

describe('StubSpreadGenerator', () => {
  const generator = new StubSpreadGenerator();

  it('draws three cards past present future for the same question every time', async () => {
    const first = await generator.generate('will the move work out?');
    const second = await generator.generate('will the move work out?');

    expect(first.cards.map((card) => card.positionKey)).toEqual(['past', 'present', 'future']);
    expect(first.cards).toHaveLength(3);
    expect(second).toEqual(first);
  });
});
