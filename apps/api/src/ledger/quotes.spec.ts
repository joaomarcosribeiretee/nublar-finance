import { parseSimplePrice, quotedValue } from './quotes';

describe('quotedValue', () => {
  it('multiplies quantity by price in centavos without floats', () => {
    expect(quotedValue('0,5', '512345.12')).toBe(25617256n);
    expect(quotedValue('0.00012345', '512345.12345678')).toBe(6325n);
    expect(quotedValue('100', '5.43')).toBe(54300n);
  });

  it('rounds half a centavo up', () => {
    expect(quotedValue('1', '0.005')).toBe(1n);
    expect(quotedValue('1', '0.00499')).toBe(0n);
  });

  it('rejects anything that is not a plain decimal', () => {
    expect(quotedValue('', '10')).toBeNull();
    expect(quotedValue('1e3', '10')).toBeNull();
    expect(quotedValue('1', '-10')).toBeNull();
  });
});

describe('parseSimplePrice', () => {
  it('reads BRL prices of the requested coins as decimal text', () => {
    const prices = parseSimplePrice(
      { bitcoin: { brl: 512345.12 }, tether: { brl: 5.4 } },
      ['bitcoin', 'tether'],
    );
    expect(prices.get('bitcoin')).toBe('512345.12');
    expect(prices.get('tether')).toBe('5.4');
  });

  it('leaves out missing, zero and broken prices instead of zeroing them', () => {
    const prices = parseSimplePrice(
      {
        bitcoin: { brl: 0 },
        ethereum: { usd: 3000 },
        solana: { brl: 'x' },
      },
      ['bitcoin', 'ethereum', 'solana', 'usd-coin'],
    );
    expect(prices.size).toBe(0);
    expect(parseSimplePrice(null, ['bitcoin']).size).toBe(0);
  });
});
