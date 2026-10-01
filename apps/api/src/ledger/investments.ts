/** Rules from docs/decisions/0002-investimentos.md. */

/** `createdAt` (ISO) orders a valuation and a movement on the same day. */
export type Valuation = { date: string; value: bigint; createdAt?: string };

export type InvestmentMovement = {
  type: 'INVESTMENT' | 'REDEMPTION';
  amount: bigint;
  date: string;
  createdAt?: string;
};

/** Whether the valuation already reflects the movement. */
function includes(valuation: Valuation, movement: InvestmentMovement): boolean {
  if (movement.date !== valuation.date) {
    return movement.date < valuation.date;
  }
  return (movement.createdAt ?? '') <= (valuation.createdAt ?? '');
}

/**
 * Value of a position at the end of `date`: the latest valuation on or before
 * it plus contributions minus redemptions it does not reflect yet. A
 * valuation reflects earlier days and, on its own day, whatever was
 * recorded before it.
 * `valuations` must be sorted by date ascending (ties: oldest first).
 */
export function investmentValueAt(
  valuations: Valuation[],
  movements: InvestmentMovement[],
  date: string,
): bigint {
  let base: Valuation | null = null;
  for (const valuation of valuations) {
    if (valuation.date <= date) {
      base = valuation;
    }
  }
  let value = base?.value ?? 0n;
  for (const movement of movements) {
    if (movement.date > date || (base && includes(base, movement))) {
      continue;
    }
    value +=
      movement.type === 'INVESTMENT' ? movement.amount : -movement.amount;
  }
  return value;
}

export type Performance = {
  applied: bigint;
  redeemed: bigint;
  current: bigint;
  /** current + redeemed − applied: what the money earned, realized or not. */
  gain: bigint;
  /** gain / applied in basis points (1% = 100); null when nothing applied. */
  gainBps: number | null;
};

export function investmentPerformance(input: {
  openingApplied: bigint;
  valuations: Valuation[];
  movements: InvestmentMovement[];
  today: string;
}): Performance {
  let applied = input.openingApplied;
  let redeemed = 0n;
  for (const movement of input.movements) {
    if (movement.date > input.today) {
      continue;
    }
    if (movement.type === 'INVESTMENT') {
      applied += movement.amount;
    } else {
      redeemed += movement.amount;
    }
  }
  const current = investmentValueAt(
    input.valuations,
    input.movements,
    input.today,
  );
  const gain = current + redeemed - applied;
  return {
    applied,
    redeemed,
    current,
    gain,
    gainBps: applied > 0n ? Number((gain * 10000n) / applied) : null,
  };
}

/** Total value of every position at the end of `date`. */
export function positionsValueAt(
  positions: { valuations: Valuation[]; movements: InvestmentMovement[] }[],
  date: string,
): bigint {
  let total = 0n;
  for (const position of positions) {
    total += investmentValueAt(position.valuations, position.movements, date);
  }
  return total;
}
