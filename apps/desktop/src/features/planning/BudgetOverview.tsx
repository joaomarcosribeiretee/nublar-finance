import { useTranslation } from "react-i18next";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { Money } from "@/components/Money";
import { ErrorNote, Panel, ProgressBar } from "@/components/Page";
import { errorMessage } from "@/lib/api";
import { currentMonth, monthLabel, todayLocal } from "@/lib/dates";
import { formatMinorUnits } from "@/lib/money";
import { useBudgets, type BudgetStatus, type Budgets } from "@/lib/queries";

export const budgetTone: Record<BudgetStatus, "positive" | "warning" | "negative"> = {
  OK: "positive",
  WARNING: "warning",
  OVER: "negative",
};

/** Where in the month we are, 0–100, to compare spending against time. */
export function monthProgress(month: string): number | undefined {
  if (month !== currentMonth()) return undefined;
  const today = todayLocal();
  const [year, monthNumber] = month.split("-").map(Number);
  const days = new Date(year, monthNumber, 0).getDate();
  return (Number(today.slice(8, 10)) / days) * 100;
}

type Item = Budgets["items"][number];

/** Closest to the limit first: the row that needs a decision leads. */
function byUrgency(a: Item, b: Item): number {
  return b.usedBps - a.usedBps;
}

/**
 * Every category limit of the month in one block: the total against the
 * whole budget, then each category against its own limit, with a mark for
 * how much of the month has passed. Shared by Início and Análises.
 */
export function BudgetOverview({
  month,
  limit,
  onManage,
  onCategory,
}: {
  month: string;
  /** Show only the most urgent rows, with a link to the rest. */
  limit?: number;
  onManage: () => void;
  /** Opens the month's entries of that category. */
  onCategory?: (category: { id: string; name: string }) => void;
}) {
  const { t } = useTranslation();
  const budgets = useBudgets(month);
  const data = budgets.data;
  const pace = monthProgress(month);
  const items = [...(data?.items ?? [])].sort(byUrgency);
  const shown = limit ? items.slice(0, limit) : items;
  const hidden = items.length - shown.length;

  return (
    <Panel
      title={t("planning.overview.title", { month: monthLabel(month).toLowerCase() })}
      subtitle={pace !== undefined && items.length > 0 ? t("planning.overview.markerHint") : undefined}
      actions={
        <Button variant="ghost" className="h-8 px-3 text-xs" onClick={onManage}>
          {items.length > 0 ? t("planning.overview.adjust") : t("planning.budgets.create")}
        </Button>
      }
    >
      {budgets.isError ? (
        <ErrorNote>{errorMessage(budgets.error)}</ErrorNote>
      ) : !data ? (
        <div className="space-y-4">
          {[0, 1, 2].map((index) => (
            <div key={index} className="skeleton h-9" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <button
          type="button"
          onClick={onManage}
          className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-line-strong px-4 py-4 text-left transition-colors hover:border-accent/50"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted">
            <Icon name="gauge" size={16} />
          </span>
          <span className="min-w-0 text-sm">
            {t("planning.overview.emptyTitle")}
            <span className="block text-xs text-muted">{t("planning.overview.emptyHint")}</span>
          </span>
        </button>
      ) : (
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="text-sm">
                <Money amount={data.totals.spent} className="text-lg" />{" "}
                <span className="text-muted">{t("planning.of", { amount: formatMinorUnits(data.totals.limit) })}</span>
              </p>
              <Remaining amount={data.totals.remaining} />
            </div>
            <ProgressBar
              size="md"
              value={data.totals.usedBps / 100}
              tone={budgetTone[data.totals.status]}
              marker={pace}
              markerTitle={t("planning.markerTitle")}
            />
          </div>

          <ul className="-mx-2 grid gap-x-6 gap-y-1 @3xl:grid-cols-2">
            {shown.map((item) => (
              <li key={item.id} className="min-w-0">
                <button
                  type="button"
                  onClick={() => (onCategory ? onCategory(item.category) : onManage())}
                  aria-label={t("planning.overview.itemLabel", { name: item.category.name, spent: formatMinorUnits(item.spent), limit: formatMinorUnits(item.limit) })}
                  className="w-full rounded-xl p-2 text-left transition-colors hover:bg-hover"
                >
                  <span className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate">{item.category.name}</span>
                    <span className="shrink-0 tabular">
                      <Money amount={item.spent} />
                      <span className="text-xs text-muted"> / {formatMinorUnits(item.limit)}</span>
                    </span>
                  </span>
                  <span className="mt-2 block">
                    {/* Past the limit the bar fills in red and the line below says by how much. */}
                    <ProgressBar value={item.usedBps / 100} tone={budgetTone[item.status]} marker={pace} />
                  </span>
                  <span className="mt-1.5 block text-xs">
                    <Remaining amount={item.remaining} />
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {hidden > 0 ? (
            <button type="button" onClick={onManage} className="flex items-center gap-1 text-xs text-accent hover:underline">
              {t("planning.overview.more", { count: hidden })}
              <Icon name="chevronRight" size={13} />
            </button>
          ) : null}
        </div>
      )}
    </Panel>
  );
}

function Remaining({ amount }: { amount: string }) {
  const { t } = useTranslation();
  return amount.startsWith("-") ? (
    <span className="text-xs text-negative">
      {t("planning.over")} <Money amount={amount.slice(1)} />
    </span>
  ) : (
    <span className="text-xs text-muted">
      {t("planning.remaining")} <Money amount={amount} className="text-foreground" />
    </span>
  );
}
