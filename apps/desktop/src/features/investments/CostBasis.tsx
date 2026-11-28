import { useTranslation } from "react-i18next";
import { resolveLocale } from "@nublar/validation";
import { Money } from "@/components/Money";
import { useHideValues } from "@/hooks/useHideValues";
import { formatMoney } from "@/lib/format";
import { coinSymbol } from "@/lib/quantity";
import type { InvestmentDetail } from "@/lib/queries";
import { GainText } from "./GainText";

/**
 * "Você pagou em média R$ X por BTC", then what the coins still held earned
 * (unrealized) and what the sales earned (realized). Crypto only.
 */
export function CostBasisSummary({ data }: { data: InvestmentDetail }) {
  const { t, i18n } = useTranslation();
  const hidden = useHideValues();
  if (data.assetClass !== "CRYPTO") return null;
  const basis = data.costBasis;
  if (!basis) {
    return <p className="text-xs text-faint">{t("investments.costBasis.missing")}</p>;
  }
  const symbol = coinSymbol(data.coinId, data.ticker);
  const both = basis.averagePrice !== null && basis.hasSales;
  return (
    <div className="space-y-3 rounded-2xl border border-line p-4">
      <p className="text-sm text-muted">
        {basis.averagePrice === null
          ? t("investments.costBasis.soldAll")
          : t(symbol ? "investments.costBasis.average" : "investments.costBasis.averageUnit", {
              price: formatMoney(basis.averagePrice, hidden, resolveLocale(i18n.language)),
              symbol,
            })}
      </p>
      <dl className={`grid gap-px overflow-hidden rounded-xl border border-line bg-line ${both ? "grid-cols-2" : "grid-cols-1"}`}>
        {basis.averagePrice !== null ? (
          <Result label={t("investments.costBasis.unrealized")} amount={basis.unrealized} bps={basis.unrealizedBps} />
        ) : null}
        {basis.hasSales ? (
          <Result label={t("investments.costBasis.realized")} amount={basis.realized} bps={basis.realizedBps} />
        ) : null}
      </dl>
      <p className="text-[11px] text-faint">
        {basis.hasSales ? t("investments.costBasis.noteWithSales") : t("investments.costBasis.note")}
      </p>
    </div>
  );
}

function Result({ label, amount, bps }: { label: string; amount: string; bps: number | null }) {
  return (
    <div className="bg-surface-2 px-3 py-2.5">
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="mt-1 flex flex-wrap items-baseline gap-x-2 text-sm">
        <Money amount={amount} tone="auto" />
        <span className="text-xs">
          <GainText gain={amount} bps={bps} />
        </span>
      </dd>
    </div>
  );
}
