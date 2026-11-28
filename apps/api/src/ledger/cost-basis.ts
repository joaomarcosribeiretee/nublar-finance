/** Rules from docs/decisions/0006-preco-medio-em-cripto.md. */
import { QUANTITY_SCALE, unitsToQuantity } from '@nublar/validation';

const UNITS_PER_COIN = 10n ** BigInt(QUANTITY_SCALE);

/** A contribution or redemption with how many coins moved (10^-18 units). */
export type QuantityMovement = {
  type: 'INVESTMENT' | 'REDEMPTION';
  amount: bigint;
  /** Null when the movement was recorded without a quantity. */
  units: bigint | null;
  date: string;
  createdAt?: string;
};

export type CostBasis = {
  /** What one whole coin cost on average, in centavos (rounded half up). */
  averagePrice: bigint | null;
  /** Coins still held, as decimal text. */
  quantity: string;
  /** What the coins still held cost: quantity × average price. */
  costBasis: bigint;
  /** current − cost basis: what the coins still held earned, not sold yet. */
  unrealized: bigint;
  unrealizedBps: number | null;
  /** Σ (sale − cost of the coins sold): what the sales earned. */
  realized: bigint;
  realizedBps: number | null;
  /** Whether anything was sold, so the screen only shows realized when it exists. */
  hasSales: boolean;
};

const bps = (gain: bigint, base: bigint) =>
  base > 0n ? Number((gain * 10000n) / base) : null;

/**
 * Weighted average cost, the way the Receita Federal asks for it: a purchase
 * moves the average; a sale does not, it only takes the coins out at the
 * average and the difference is the realized result.
 *
 * The opening lot (what was applied before tracking, `openingApplied`) holds
 * whatever quantity is not explained by the movements: today's quantity −
 * coins bought + coins sold. Null when that cannot be told: a movement
 * without quantity, no quantity at all, or more sold than held.
 */
export function costBasis(input: {
  openingApplied: bigint;
  /** Coins held now, in 10^-18 units (the position's quantity). */
  heldUnits: bigint | null;
  current: bigint;
  movements: QuantityMovement[];
  today: string;
}): CostBasis | null {
  if (input.heldUnits === null) return null;
  if (input.movements.some((movement) => movement.units === null)) return null;

  // The held quantity already counts every movement, future-dated ones too.
  let net = 0n;
  for (const movement of input.movements) {
    net += movement.type === 'INVESTMENT' ? movement.units! : -movement.units!;
  }
  const openingUnits = input.heldUnits - net;
  const movements = input.movements
    .filter((movement) => movement.date <= input.today)
    .sort((a, b) =>
      a.date === b.date
        ? (a.createdAt ?? '').localeCompare(b.createdAt ?? '')
        : a.date.localeCompare(b.date),
    );
  // An opening lot with money but no coins (or fewer than zero) has no price.
  if (openingUnits < 0n || (openingUnits === 0n && input.openingApplied > 0n)) {
    return null;
  }

  let units = openingUnits;
  let basis = openingUnits > 0n ? input.openingApplied : 0n;
  let realized = 0n;
  let soldBasis = 0n;
  let hasSales = false;
  for (const movement of movements) {
    const moved = movement.units!;
    if (movement.type === 'INVESTMENT') {
      units += moved;
      basis += movement.amount;
      continue;
    }
    if (moved > units) return null;
    // The coins leave at the average cost; selling everything takes it all.
    const removed = moved === units ? basis : (basis * moved) / units;
    realized += movement.amount - removed;
    soldBasis += removed;
    basis -= removed;
    units -= moved;
    hasSales = true;
  }

  const unrealized = input.current - basis;
  return {
    averagePrice:
      units > 0n ? (basis * UNITS_PER_COIN * 2n + units) / (units * 2n) : null,
    quantity: unitsToQuantity(units),
    costBasis: basis,
    unrealized,
    unrealizedBps: bps(unrealized, basis),
    realized,
    realizedBps: bps(realized, soldBasis),
    hasSales,
  };
}
