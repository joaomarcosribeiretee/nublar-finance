import { useHideValues } from "@/hooks/useHideValues";
import { formatMoney } from "@/lib/money";

const tones = {
  plain: "",
  positive: "text-positive",
  negative: "text-negative",
  transfer: "text-transfer",
  auto: "",
} as const;

/**
 * The one place an amount is shown. Formats minor units, or "R$ ••••" in
 * privacy mode. `sign` prefixes + or − explicitly; `auto` colors by the sign
 * of the value itself.
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
  const hidden = useHideValues();
  const negative = amount.startsWith("-");
  const color =
    tone === "auto"
      ? negative
        ? tones.negative
        : BigInt(amount) > 0n
          ? tones.positive
          : ""
      : tones[tone];
  const text = formatMoney(amount, hidden);

  return (
    <span className={`tabular whitespace-nowrap ${color} ${className}`}>
      {sign ? `${sign === "-" ? "−" : "+"} ${text}` : text.replace("-", "−")}
    </span>
  );
}
