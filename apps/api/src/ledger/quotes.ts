/** Rules from docs/decisions/0005-cotacao-automatica-de-cripto.md. */

/** "0,5" or "512345.12" as digits and decimal places, so math stays exact. */
function parseDecimal(text: string): { digits: bigint; scale: number } | null {
  const match = /^(\d+)(?:[.,](\d+))?$/.exec(text.trim());
  if (!match) return null;
  const fraction = match[2] ?? '';
  return { digits: BigInt(match[1] + fraction), scale: fraction.length };
}

/**
 * quantity × BRL price, in centavos, rounded half up. Null when either side
 * is not a plain decimal. Exact: money never passes through a float.
 */
export function quotedValue(quantity: string, price: string): bigint | null {
  const q = parseDecimal(quantity);
  const p = parseDecimal(price);
  if (!q || !p) return null;
  const scale = 10n ** BigInt(q.scale + p.scale);
  const product = q.digits * p.digits * 100n;
  return (product * 2n + scale) / (scale * 2n);
}

/**
 * BRL prices from CoinGecko's `simple/price` answer, as decimal text.
 * Missing, zero or non-numeric prices are left out (never become zero).
 */
export function parseSimplePrice(
  body: unknown,
  coinIds: readonly string[],
): Map<string, string> {
  const prices = new Map<string, string>();
  if (!body || typeof body !== 'object') return prices;
  for (const coinId of coinIds) {
    const entry = (body as Record<string, unknown>)[coinId];
    const brl =
      entry && typeof entry === 'object'
        ? (entry as Record<string, unknown>).brl
        : undefined;
    if (typeof brl === 'number' && Number.isFinite(brl) && brl > 0) {
      // A quote, not money: 8 places cover any coin; trailing zeros dropped.
      prices.set(coinId, brl.toFixed(8).replace(/\.?0+$/, ''));
    }
  }
  return prices;
}
