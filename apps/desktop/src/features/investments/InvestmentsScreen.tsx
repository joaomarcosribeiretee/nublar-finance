import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { t } from "@/i18n";
import { Button } from "@/components/Button";
import { ErrorNote, PageHeader } from "@/components/Page";
import { StatTile } from "@/components/charts";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { Modal } from "@/components/Modal";
import { Money } from "@/components/Money";
import { errorMessage } from "@/lib/api";
import { allocationColors } from "@/lib/chart";
import { GainText } from "./GainText";
import { assetClassLabels } from "@/lib/labels";
import { percentOf } from "@/lib/money";
import { usePortfolio, type AssetClass, type InvestmentItem } from "@/lib/queries";
import { InvestmentDetail } from "./InvestmentDetail";
import { InvestmentForm } from "./InvestmentForm";
import { BulkValuations } from "./BulkValuations";
import { QuoteAge, QuoteWarning } from "./QuoteStatus";
import { liquidityLabels, rateLabel } from "@/lib/rates";
import { formatDate } from "@/lib/format";

const classOrder: AssetClass[] = ["FIXED_INCOME", "STOCK", "FII", "ETF", "CRYPTO", "OTHER"];

export function InvestmentsScreen() {
  const { t } = useTranslation();
  const portfolio = usePortfolio();
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [assetFilter, setAssetFilter] = useState<AssetClass | null>(null);
  const data = portfolio.data;
  const totals = data?.totals;
  // Auto-quoted positions update themselves; the check-in is for the rest.
  const manualItems = data?.items.filter((item) => !item.autoQuote) ?? [];

  return (
    <section className="animate-enter space-y-6">
      <PageHeader
        eyebrow={t("investments.eyebrow")}
        title={t("shell.screens.investments")}
        actions={
          <>
            {manualItems.length > 0 ? (
              <Button variant="ghost" onClick={() => setUpdating(true)}>
                {t("investments.updateValues")}
              </Button>
            ) : null}
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Icon name="plus" size={16} />
              {t("investments.new")}
            </Button>
          </>
        }
      />

      {portfolio.isError ? (
        <ErrorNote>{errorMessage(portfolio.error)}</ErrorNote>
      ) : data && data.items.length === 0 ? (
        <EmptyState
          icon="trend"
          title={t("investments.empty.title")}
          description={t("investments.empty.description")}
          action={
            <Button variant="primary" onClick={() => setCreating(true)}>
              {t("investments.empty.action")}
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
            <StatTile label={t("investments.stats.current")} loading={!totals} value={totals ? <Money amount={totals.current} /> : null} />
            <StatTile
              label={t("investments.stats.applied")}
              loading={!totals}
              value={totals ? <Money amount={totals.applied} /> : null}
              detail={totals && BigInt(totals.redeemed) > 0n ? <>{t("investments.stats.redeemed")} <Money amount={totals.redeemed} /></> : null}
            />
            <StatTile
              label={t("investments.stats.gain")}
              loading={!totals}
              value={totals ? <Money amount={totals.gain} tone="auto" /> : null}
              detail={t("investments.stats.gainDetail")}
            />
            <StatTile
              label={t("investments.stats.return")}
              loading={!totals}
              value={totals ? <GainText gain={totals.gain} bps={totals.gainBps} /> : null}
              detail={t("investments.stats.returnDetail")}
            />
          </div>

          {data && data.allocation.length > 0 && BigInt(data.totals.current) > 0n ? <AllocationBar data={data.allocation} total={data.totals.current} selected={assetFilter} onSelect={setAssetFilter} /> : null}

          {data && (!assetFilter || assetFilter === "FIXED_INCOME") && data.items.some((item) => item.assetClass === "FIXED_INCOME") ? (
            <FixedIncomePanel summary={data.fixedIncome} onOpen={setOpenId} />
          ) : null}

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-medium">{assetFilter ? t(assetClassLabels[assetFilter]) : t("investments.portfolio")}</h2>
              {assetFilter ? <Button variant="ghost" className="h-8 text-xs" onClick={() => setAssetFilter(null)}>{t("investments.allClasses")} <Icon name="close" size={13} /></Button> : null}
            </div>
            {!data
              ? [0, 1].map((i) => <div key={i} className="skeleton h-32 rounded-3xl" />)
              : classOrder.map((assetClass) => {
                  if (assetFilter && assetFilter !== assetClass) return null;
                  const items = data.items.filter((item) => item.assetClass === assetClass);
                  if (items.length === 0) return null;
                  return (
                    <ClassGroup
                      key={assetClass}
                      assetClass={assetClass}
                      items={items}
                      onOpen={(item) => setOpenId(item.id)}
                    />
                  );
                })}
          </div>
        </>
      )}

      <Modal open={updating} onClose={() => setUpdating(false)} title={t("investments.updateValues")} width={560}>
        {data ? <BulkValuations items={manualItems} onDone={() => setUpdating(false)} /> : null}
      </Modal>
      <Modal open={creating} onClose={() => setCreating(false)} title={t("investments.new")} width={600}>
        <InvestmentForm investment={null} onDone={() => setCreating(false)} />
      </Modal>
      <Modal
        open={openId !== null}
        onClose={() => setOpenId(null)}
        title={data?.items.find((i) => i.id === openId)?.name ?? t("transactions.form.investment")}
        width={720}
      >
        {openId ? <InvestmentDetail id={openId} onClose={() => setOpenId(null)} /> : null}
      </Modal>
    </section>
  );
}

/** Part-to-whole as one bar: segments separated by a 2px surface gap. */
function AllocationBar({
  data,
  total,
  selected,
  onSelect,
}: {
  data: { assetClass: AssetClass; name: string; value: string }[];
  total: string;
  selected: AssetClass | null;
  onSelect: (value: AssetClass | null) => void;
}) {
  const { t } = useTranslation();
  return (
    <article className="min-w-0 rounded-3xl border border-line bg-surface p-4 @2xl:p-5">
      <h2 className="text-sm">{t("investments.allocation")}</h2>
      <div className="mt-4 flex h-3 gap-[2px] overflow-hidden rounded-full">
        {data.map((slice) => (
          <div
            key={slice.assetClass}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{
              width: `${percentOf(slice.value, total)}%`,
              opacity: selected && selected !== slice.assetClass ? 0.25 : 1,
              background: allocationColors[slice.assetClass],
            }}
            title={`${t(assetClassLabels[slice.assetClass])}: ${Math.round(percentOf(slice.value, total))}%`}
          />
        ))}
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {data.map((slice) => (
          <li key={slice.assetClass}>
            <button type="button" aria-pressed={selected === slice.assetClass} onClick={() => onSelect(selected === slice.assetClass ? null : slice.assetClass)} className={`flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-left transition-colors ${selected === slice.assetClass ? "bg-raised text-foreground" : "text-muted hover:bg-hover"}`}>
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: allocationColors[slice.assetClass] }} />
            {t(assetClassLabels[slice.assetClass])}
            <span className="text-xs text-faint tabular">{Math.round(percentOf(slice.value, total))}%</span>
            <Money amount={slice.value} className="text-xs text-muted" />
            </button>
          </li>
        ))}
      </ul>
    </article>
  );
}

function ClassGroup({
  assetClass,
  items,
  onOpen,
}: {
  assetClass: AssetClass;
  items: InvestmentItem[];
  onOpen: (item: InvestmentItem) => void;
}) {
  const { t } = useTranslation();
  const total = items.reduce((sum, item) => sum + BigInt(item.current), 0n).toString();
  // Every quoted coin comes from the same fetch: one status for the group.
  const quote = items.find((item) => item.quote)?.quote ?? null;
  return (
    <article className="min-w-0 rounded-3xl border border-line bg-surface p-2 @2xl:p-3">
      <header className="flex flex-wrap items-center gap-2 px-3 pt-2 pb-2">
        <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: allocationColors[assetClass] }} />
        <h2 className="text-sm text-muted">{t(assetClassLabels[assetClass])}</h2>
        {quote ? <QuoteAge quote={quote} /> : null}
        <Money amount={total} className="ml-auto text-sm" />
        {quote?.stale ? (
          <div className="w-full">
            <QuoteWarning quote={quote} />
          </div>
        ) : null}
      </header>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onOpen(item)}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-hover"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm">
                  <span className="truncate">{item.name}</span>
                  {item.ticker ? (
                    <span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">{item.ticker}</span>
                  ) : null}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  {item.institution ? (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: item.institution.color }} />
                  ) : null}
                  <span className="truncate">
                    {item.institution ? `${item.institution.name} · ` : ""}
                    {describe(item)}
                  </span>
                </span>
              </span>
              <span className="shrink-0 text-right">
                <Money amount={item.current} className="block text-sm" />
                <span className="text-xs">
                  <GainText gain={item.gain} bps={item.gainBps} />
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </article>
  );
}

/** "110% do CDI · liquidez diária · vence 10 mar 28 · valor de 2 out". */
function describe(item: InvestmentItem): string {
  const parts = [
    item.assetClass === "FIXED_INCOME" ? rateLabel(item.indexer, item.rateBps) : null,
    item.liquidity ? t(liquidityLabels[item.liquidity]).toLowerCase() : null,
    item.maturityDate ? t("investments.describe.matures", { date: `${formatDate(item.maturityDate)} ${item.maturityDate.slice(2, 4)}` }) : null,
    item.autoQuote
      ? t("investments.quote.auto")
      : item.lastValuation
        ? t("investments.bulk.updatedOn", { date: formatDate(item.lastValuation) })
        : t("investments.describe.noValue"),
  ];
  return parts.filter(Boolean).join(" · ");
}

/** Fixed income at a glance: what can be withdrawn now and what matures soon. */
function FixedIncomePanel({
  summary,
  onOpen,
}: {
  summary: NonNullable<ReturnType<typeof usePortfolio>["data"]>["fixedIncome"];
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation();
  const unknown = BigInt(summary.unknown);
  return (
    <article className="grid gap-px overflow-hidden rounded-3xl border border-line bg-line @2xl:grid-cols-[1fr_1.2fr]">
      <div className="space-y-4 bg-surface p-4 @2xl:p-5">
        <h2 className="text-sm">{t("investments.fixedIncome.title")}</h2>
        <div>
          <p className="text-xs text-muted">{t("investments.fixedIncome.daily")}</p>
          <Money amount={summary.daily} className="text-2xl" />
          <p className="mt-0.5 text-[11px] text-faint">{t("investments.fixedIncome.dailyHint")}</p>
        </div>
        <div>
          <p className="text-xs text-muted">{t("investments.fixedIncome.atMaturity")}</p>
          <Money amount={summary.atMaturity} className="text-lg" />
        </div>
        {unknown > 0n ? (
          <p className="text-[11px] text-faint">
            <Trans i18nKey="investments.fixedIncome.unknown" components={{ value: <Money amount={summary.unknown} /> }} />
          </p>
        ) : null}
      </div>
      <div className="min-w-0 bg-surface p-4 @2xl:p-5">
        <h2 className="text-sm">{t("investments.fixedIncome.maturities")}</h2>
        {summary.maturities.length === 0 ? (
          <p className="mt-4 text-sm text-faint">{t("investments.fixedIncome.noMaturities")}</p>
        ) : (
          <ul className="mt-3 space-y-1">
            {summary.maturities.map((maturity) => (
              <li key={maturity.id}>
                <button
                  type="button"
                  onClick={() => onOpen(maturity.id)}
                  className="-mx-2 flex w-[calc(100%+16px)] items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-hover"
                >
                  <span className="w-20 shrink-0 text-xs text-muted">
                    {formatDate(maturity.date)} {maturity.date.slice(2, 4)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{maturity.name}</span>
                  <Money amount={maturity.value} className="text-sm" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
