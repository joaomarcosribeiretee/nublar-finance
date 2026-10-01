/**
 * Accepts what people type in Brazil: "1.234,56", "1234,5", "25" and also
 * "25.90" (a single dot followed by one or two digits is read as decimals).
 */
export function parseReaisToMinorUnits(input: string): string | null {
  let normalized = input.trim().replace(/^R\$\s*/, "").replace(/\s/g, "");
  if (normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (!/^\d+\.\d{1,2}$/.test(normalized)) {
    normalized = normalized.replace(/\./g, "");
  }

  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) {
    return null;
  }

  const cents = (match[2] ?? "").padEnd(2, "0");
  const amount = BigInt(match[1] ?? "0") * 100n + BigInt(cents || "0");
  if (amount <= 0n) {
    return null;
  }
  return amount.toString();
}

/** Like parseReaisToMinorUnits, but empty means zero and "-" is allowed. */
export function parseSignedReaisToMinorUnits(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return "0";
  }
  const negative = /^[-−]/.test(trimmed);
  const body = trimmed.replace(/^[-−]\s*/, "");
  if (/^[0.,\s]*$/.test(body.replace(/^R\$/, ""))) {
    return /\d/.test(body) ? "0" : null;
  }
  const parsed = parseReaisToMinorUnits(body);
  if (!parsed) {
    return null;
  }
  return negative ? `-${parsed}` : parsed;
}

/** Minor units back into the editable "1.234,56" form, keeping the sign. */
export function minorUnitsToInput(amount: string): string {
  const value = BigInt(amount);
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const reais = (absolute / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "-" : ""}${reais},${(absolute % 100n).toString().padStart(2, "0")}`;
}

export function formatMinorUnits(amount: string): string {
  const value = BigInt(amount);
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const reais = (absolute / 100n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const cents = (absolute % 100n).toString().padStart(2, "0");
  return `${negative ? "-" : ""}R$ ${reais},${cents}`;
}

/** Share of `part` in `total` as a 0–100 number, for bar widths only. */
export function percentOf(part: string, total: string): number {
  const whole = BigInt(total);
  if (whole <= 0n) {
    return 0;
  }
  return Number((BigInt(part) * 10000n) / whole) / 100;
}
