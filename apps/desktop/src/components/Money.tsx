import { formatMinorUnits } from "@/lib/money";

const tones = {
  plain: "",
  positive: "text-positive",
  negative: "text-negative",
  transfer: "text-transfer",
  auto: "",
} as const;

/**
 * Formats minor units. `sign` prefixes + or − explicitly; `auto` colors
 * by the sign of the value itself.
 */
export function Money({
  amount,
  tone = "plain",
  sign,
  className = "",
}: {
  amount: string;
  tone?: keyof typeof tones;
  sign?: "+" | "-";
  className?: string;
}) {
  const negative = amount.startsWith("-");
  const color =
    tone === "auto"
      ? negative
        ? tones.negative
        : BigInt(amount) > 0n
          ? tones.positive
          : ""
      : tones[tone];
  const text = formatMinorUnits(amount);

  return (
    <span className={`tabular whitespace-nowrap ${color} ${className}`}>
      {sign ? `${sign === "-" ? "−" : "+"} ${text}` : text.replace("-", "−")}
    </span>
  );
}
