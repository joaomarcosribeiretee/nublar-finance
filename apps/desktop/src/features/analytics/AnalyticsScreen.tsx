import { useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { t } from "@/i18n";
import { assetClassLabels } from "@/lib/labels";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  axisProps,
  barCursor,
  ChartCard,
  gridProps,
  Legend,
  lineCursor,
  StatTile,
  TooltipBox,
  useMoneyChart,
} from "@/components/charts";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { Money } from "@/components/Money";
import { Segmented } from "@/components/Segmented";
import { ErrorNote, PageHeader, ProgressBar } from "@/components/Page";
import { errorMessage } from "@/lib/api";
import { allocationColors, formatBps, plotValue } from "@/lib/chart";
import { monthLabel, shiftMonth, shortMonthLabel } from "@/lib/dates";
import { percentOf } from "@/lib/money";
import { useFormatMoney } from "@/hooks/useHideValues";
import { activeSeries } from "@/lib/insights";
import { useAnalytics, type Analytics, type AssetClass } from "@/lib/queries";
import { IncomeSplitCard, ReserveCard, SpendingPace } from "./Insights";
import { BudgetOverview } from "@/features/planning/BudgetOverview";
import { categoryLabel } from "@/lib/categories";

type Point = Analytics["series"][number];

const colors = {
  income: "var(--series-1)",
  expense: "var(--series-2)",
  fixed: "var(--series-1)",
  installments: "var(--series-2)",
  variable: "var(--series-3)",
  savings: "var(--series-3)",
  worth: "var(--accent)",
};

/** The API names slices in pt-BR; the key says what each one is. */
function sliceName(slice: { key: string; name: string }): string {
  if (slice.key === "CASH") return t("analytics.allocation.cash");
  return slice.key in assetClassLabels ? t(assetClassLabels[slice.key as AssetClass]) : slice.name;
}

/** "out" or "jan 26" at year boundaries. */
function axisMonth(month: string): string {
  return month.endsWith("-01")
    ? `${shortMonthLabel(month)} ${month.slice(2, 4)}`
    : shortMonthLabel(month);
}

export function AnalyticsScreen({
  month,
  onInspectMonth,
  onBudgets,
  onInspectCategory,
}: {
  month: string;
  onInspectMonth: (month: string) => void;
  onBudgets: () => void;
  onInspectCategory: (category: { id: string; name: string }) => void;
}) {
  const { t } = useTranslation();
  const [months, setMonths] = useState<6 | 12 | 24>(12);
  const [view, setView] = useState<"worth" | "flow" | "future">("worth");
  const analytics = useAnalytics(month, months);
  const data = analytics.data;
  const dim = analytics.isPlaceholderData;

  return (
    <section className="animate-enter space-y-6">
      <PageHeader
        eyebrow={data ? t("analytics.range", { from: monthLabel(data.from), to: monthLabel(data.to) }) : t("analytics.eyebrow")}
        title={t("shell.screens.analytics")}
        actions={
          <Segmented
            size="sm"
            label={t("analytics.period")}
            value={String(months) as "6" | "12" | "24"}
            options={[
              { value: "6", label: t("investments.horizons.sixMonths") },
              { value: "12", label: t("home.sparkline.period") },
              { value: "24", label: t("analytics.months24") },
            ]}
            onChange={(value) => setMonths(Number(value) as 6 | 12 | 24)}
          />
        }
      />

      {analytics.isError ? (
        <ErrorNote>{errorMessage(analytics.error)}</ErrorNote>
      ) : data && data.kpis.trackedMonths === 0 ? (
        <EmptyState
          icon="chart"
          title={t("analytics.empty.title")}
          description={t("analytics.empty.description")}
        />
      ) : (
        <>
          <Kpis data={data} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented label={t("analytics.views.label")} value={view} options={[
              { value: "worth", label: t("home.netWorth") },
              { value: "flow", label: t("analytics.views.flow") },
              { value: "future", label: t("analytics.views.future") },
            ]} onChange={setView} />
            <Button variant="ghost" onClick={() => onInspectMonth(month)}>{t("analytics.openMonth")} <Icon name="chevronRight" size={15} /></Button>
          </div>
          <div key={view} className="animate-enter space-y-4">
            {view === "worth" ? <>
              <NetWorthChart data={data} dim={dim} />
              <ReserveCard data={data} />
              <AllocationCard data={data} dim={dim} />
            </> : view === "flow" ? <>
              <SpendingPace month={data?.to ?? month} />
              <BudgetOverview month={data?.to ?? month} onManage={onBudgets} onCategory={onInspectCategory} />
              <IncomeSplitCard data={data} />
              <IncomeExpenseChart data={data} dim={dim} />
              <CategoriesCard data={data} dim={dim} />
            </> : <CommitmentsChart data={data} dim={dim} />}
          </div>
          <MonthlyTable data={data} onInspectMonth={onInspectMonth} />
        </>
      )}
    </section>
  );
}

/** The browsed month up front; the period average only as a reference. */
function Kpis({ data }: { data: Analytics | undefined }) {
  const { t } = useTranslation();
  const money = useFormatMoney();
  const k = data?.kpis;
  const point = data?.series.find((p) => p.month === data.to);
  // Measured from when tracking began: a percentage over the near-empty
  // months before that would only measure how much got registered.
  const active = data ? activeSeries(data.series) : [];
  const since = active.length > 1 ? active[0] : null;
  const change = k && since ? BigInt(k.netWorth) - BigInt(since.netWorth) : 0n;
  const income = point ? BigInt(point.income) : 0n;
  const expense = point ? BigInt(point.expense) : 0n;
  const result = income - expense;
  const loading = !k || !point;
  return (
    <div role="region" aria-label={t("analytics.kpis.label")} tabIndex={0} className="analysis-metrics grid grid-cols-1 gap-3 @2xl:grid-cols-2">
      <StatTile
        label={t("home.netWorth")}
        loading={!k}
        value={k ? <Money amount={k.netWorth} /> : null}
        detail={
          since ? (
            <>
              <span className={change > 0n ? "text-positive" : change < 0n ? "text-negative" : ""}>
                {change > 0n ? "+" : ""}
                <Money amount={change.toString()} />
              </span>{" "}
              {t("analytics.kpis.since", { month: monthLabel(since.month).toLowerCase() })}
            </>
          ) : k ? (
            t("analytics.kpis.firstMonth")
          ) : null
        }
      />
      <StatTile
        label={t("analytics.kpis.result")}
        loading={loading}
        value={point ? <Money amount={result.toString()} tone="auto" /> : null}
        detail={point ? t("analytics.kpis.resultDetail", { income: money(point.income), rate: formatBps(point.savingsRateBps) }) : null}
      />
    </div>
  );
}

function NetWorthChart({ data, dim }: { data: Analytics | undefined; dim: boolean }) {
  const { t } = useTranslation();
  const chart = useMoneyChart();
  const fill = useId();
  const rows = useMemo(
    () => (data ? activeSeries(data.series) : []).map((p) => ({ ...p, plot: plotValue(p.netWorth) })),
    [data],
  );
  const trimmed = data ? rows.length < data.series.length : false;
  return (
    <ChartCard
      title={t("analytics.worth.title")}
      subtitle={
        trimmed && rows[0]
          ? t("analytics.worth.subtitleSince", { month: monthLabel(rows[0].month).toLowerCase() })
          : t("analytics.worth.subtitle")
      }
      dim={dim}
    >
      <div className="h-64">
        {data ? (
          <ResponsiveContainer>
            <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="month" tickFormatter={axisMonth} {...axisProps} />
              <YAxis {...chart.yAxis} />
              <Tooltip
                {...chart.tooltip}
                cursor={lineCursor}
                content={({ active, payload }) => {
                  const point = payload?.[0]?.payload as Point | undefined;
                  if (!active || !point) return null;
                  return (
                    <TooltipBox
                      title={monthLabel(point.month)}
                      rows={[
                        { label: t("home.netWorth"), color: colors.worth, value: <Money amount={point.netWorth} /> },
                        { label: t("analytics.allocation.cash"), value: <Money amount={point.cash} />, strong: false },
                        { label: t("shell.screens.investments"), value: <Money amount={point.investments} />, strong: false },
                        { label: t("shell.screens.cards"), value: <Money amount={point.cardDebt} sign="-" />, strong: false },
                      ]}
                    />
                  );
                }}
              />
              <Area isAnimationActive={false}
                type="monotone"
                dataKey="plot"
                stroke="var(--accent)"
                strokeWidth={2}
                fill={`url(#${fill})`}
                activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2, fill: "var(--accent)" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="skeleton h-full" />
        )}
      </div>
    </ChartCard>
  );
}

function IncomeExpenseChart({ data, dim }: { data: Analytics | undefined; dim: boolean }) {
  const { t } = useTranslation();
  const chart = useMoneyChart();
  const rows = useMemo(
    () =>
      (data ? activeSeries(data.series) : []).map((p) => ({
        ...p,
        incomePlot: plotValue(p.income),
        expensePlot: plotValue(p.expense),
      })),
    [data],
  );
  return (
    <ChartCard
      title={t("analytics.flow.title")}
      subtitle={t("analytics.flow.subtitle")}
      right={
        <Legend
          items={[
            { label: t("transactions.filters.income"), color: colors.income },
            { label: t("transactions.filters.expense"), color: colors.expense },
          ]}
        />
      }
      dim={dim}
    >
      <div className="h-56">
        {data ? (
          <ResponsiveContainer>
            <BarChart data={rows} barGap={2} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="month" tickFormatter={axisMonth} {...axisProps} />
              <YAxis {...chart.yAxis} />
              <Tooltip
                {...chart.tooltip}
                cursor={barCursor}
                content={({ active, payload }) => {
                  const point = payload?.[0]?.payload as Point | undefined;
                  if (!active || !point) return null;
                  return (
                    <TooltipBox
                      title={monthLabel(point.month)}
                      rows={[
                        { label: t("transactions.filters.income"), color: colors.income, value: <Money amount={point.income} /> },
                        { label: t("transactions.filters.expense"), color: colors.expense, value: <Money amount={point.expense} /> },
                        { label: t("transactions.result"), value: <Money amount={point.result} /> },
                        { label: t("analytics.savings"), value: formatBps(point.savingsRateBps), strong: false },
                      ]}
                    />
                  );
                }}
              />
              <Bar isAnimationActive={false} dataKey="incomePlot" fill={colors.income} radius={[4, 4, 0, 0]} maxBarSize={16} />
              <Bar isAnimationActive={false} dataKey="expensePlot" fill={colors.expense} radius={[4, 4, 0, 0]} maxBarSize={16} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="skeleton h-full" />
        )}
      </div>
    </ChartCard>
  );
}

function CategoriesCard({ data, dim }: { data: Analytics | undefined; dim: boolean }) {
  const { t } = useTranslation();
  const money = useFormatMoney();
  const items = data?.categories.slice(0, 8) ?? [];
  const max = items.reduce((m, c) => {
    for (const v of [c.amount, c.average]) if (BigInt(v) > BigInt(m)) m = v;
    return m;
  }, "0");
  const previousMonth = data ? shortMonthLabel(shiftMonth(data.to, -1)) : "";

  return (
    <ChartCard
      title={t("home.categories.title")}
      subtitle={data ? t("analytics.categories.subtitle", { month: monthLabel(data.to) }) : undefined}
      dim={dim}
    >
      {!data ? (
        <div className="space-y-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-8" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-sm text-faint">{t("analytics.categories.empty")}</p>
      ) : (
        <ul className="space-y-3.5">
          {items.map((category) => {
            const share = percentOf(category.amount, max);
            const avgShare = percentOf(category.average, max);
            const previous = BigInt(category.previous);
            const delta = BigInt(category.amount) - previous;
            const deltaBps = previous > 0n ? Number((delta * 10000n) / previous) : null;
            return (
              <li key={category.categoryId ?? "none"} className="group">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate">{categoryLabel(category.name)}</span>
                  <span className="flex shrink-0 items-baseline gap-2">
                    {deltaBps !== null && delta !== 0n ? (
                      <span
                        className={`flex items-center gap-0.5 text-[11px] ${delta > 0n ? "text-negative" : "text-positive"}`}
                        title={t("analytics.categories.previous", { month: previousMonth, amount: money(category.previous) })}
                      >
                        <Icon name={delta > 0n ? "arrowUp" : "arrowDown"} size={11} />
                        <span className="sr-only">{delta > 0n ? t("home.delta.up") : t("home.delta.down")}{" "}</span>
                        {formatBps(Math.abs(deltaBps))}
                      </span>
                    ) : null}
                    <Money amount={category.amount} />
                  </span>
                </div>
                <div className="mt-1.5">
                  <ProgressBar
                    value={share}
                    marker={BigInt(category.average) > 0n ? avgShare : undefined}
                    markerTitle={t("analytics.categories.average", { amount: money(category.average) })}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </ChartCard>
  );
}

function AllocationCard({ data, dim }: { data: Analytics | undefined; dim: boolean }) {
  const { t } = useTranslation();
  const chart = useMoneyChart();
  const slices = data?.allocation ?? [];
  const total = slices.reduce((sum, s) => sum + BigInt(s.value), 0n).toString();
  const rows = slices.map((s) => ({ ...s, plot: plotValue(s.value) }));

  return (
    <ChartCard title={t("analytics.allocation.title")} subtitle={t("analytics.allocation.subtitle")} dim={dim}>
      {!data ? (
        <div className="skeleton h-48" />
      ) : slices.length === 0 ? (
        <p className="py-8 text-center text-sm text-faint">{t("analytics.allocation.empty")}</p>
      ) : (
        <div className="flex flex-wrap items-center justify-center gap-4">
          <div className="relative h-44 w-44 shrink-0">
            <ResponsiveContainer>
              <PieChart>
                <Pie isAnimationActive={false}
                  data={rows}
                  dataKey="plot"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={80}
                  paddingAngle={slices.length > 1 ? 2 : 0}
                  stroke="var(--surface)"
                  strokeWidth={2}
                >
                  {rows.map((slice) => (
                    <Cell key={slice.key} fill={allocationColors[slice.key] ?? "var(--series-8)"} />
                  ))}
                </Pie>
                <Tooltip
                  {...chart.tooltip}
                  content={({ active, payload }) => {
                    const slice = payload?.[0]?.payload as (typeof rows)[number] | undefined;
                    if (!active || !slice) return null;
                    return (
                      <TooltipBox
                        title={sliceName(slice)}
                        rows={[
                          {
                            label: `${Math.round(percentOf(slice.value, total))}%`,
                            color: allocationColors[slice.key],
                            value: <Money amount={slice.value} />,
                          },
                        ]}
                      />
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] text-muted uppercase">{t("cards.detail.total")}</span>
              <Money amount={total} className="text-sm" />
            </div>
          </div>
          <ul className="min-w-40 flex-1 space-y-2">
            {slices.map((slice) => (
              <li key={slice.key} className="flex items-center gap-2 text-sm">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                  style={{ background: allocationColors[slice.key] }}
                />
                <span className="truncate">{sliceName(slice)}</span>
                <span className="ml-auto text-xs text-faint tabular">
                  {Math.round(percentOf(slice.value, total))}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ChartCard>
  );
}

function CommitmentsChart({ data, dim }: { data: Analytics | undefined; dim: boolean }) {
  const { t } = useTranslation();
  const chart = useMoneyChart();
  const rows = useMemo(
    () =>
      data?.commitments.map((c) => ({
        ...c,
        recurringPlot: plotValue(c.recurringExpense),
        installmentsPlot: plotValue(c.installments),
      })) ?? [],
    [data],
  );
  type Row = (typeof rows)[number];
  return (
    <ChartCard
      title={t("analytics.commitments.title")}
      subtitle={t("analytics.commitments.subtitle")}
      right={
        <Legend
          items={[
            { label: t("analytics.commitments.recurring"), color: colors.fixed },
            { label: t("invoices.groups.installments"), color: colors.installments },
          ]}
        />
      }
      dim={dim}
    >
      <div className="h-56">
        {data ? (
          <ResponsiveContainer>
            <BarChart data={rows} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="month" tickFormatter={axisMonth} {...axisProps} />
              <YAxis {...chart.yAxis} />
              <Tooltip
                {...chart.tooltip}
                cursor={barCursor}
                content={({ active, payload }) => {
                  const row = payload?.[0]?.payload as Row | undefined;
                  if (!active || !row) return null;
                  return (
                    <TooltipBox
                      title={monthLabel(row.month)}
                      rows={[
                        { label: t("invoices.groups.installments"), color: colors.installments, value: <Money amount={row.installments} /> },
                        { label: t("analytics.commitments.recurring"), color: colors.fixed, value: <Money amount={row.recurringExpense} /> },
                        { label: t("analytics.commitments.recurringIncome"), value: <Money amount={row.recurringIncome} />, strong: false },
                        { label: t("planning.calendar.projection.projected"), value: <Money amount={row.balance} />, strong: false },
                      ]}
                    />
                  );
                }}
              />
              <Bar isAnimationActive={false} dataKey="recurringPlot" stackId="c" fill={colors.fixed} stroke="var(--surface)" strokeWidth={2} maxBarSize={28} />
              <Bar isAnimationActive={false}
                dataKey="installmentsPlot"
                stackId="c"
                fill={colors.installments}
                stroke="var(--surface)"
                strokeWidth={2}
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="skeleton h-full" />
        )}
      </div>
    </ChartCard>
  );
}

/** Table view: every number in the charts, reachable without hovering. */
function MonthlyTable({ data, onInspectMonth }: { data: Analytics | undefined; onInspectMonth: (month: string) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (!data) return null;
  return (
    <article className="min-w-0 rounded-3xl border border-line bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 rounded-3xl px-4 py-4 text-left text-sm @2xl:px-5"
        aria-expanded={open}
      >
        {t("analytics.table.title")}
        <Icon name="chevronRight" size={15} className={`text-muted transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open ? (
        <div className="animate-enter overflow-x-auto px-2 pb-3">
          <table className="w-full text-right text-xs whitespace-nowrap tabular">
            <thead className="text-muted">
              <tr>
                {[t("planning.calendar.projection.month"), t("transactions.filters.income"), t("transactions.filters.expense"), t("transactions.result"), t("analytics.savings"), t("analytics.split.invested"), t("home.netWorth")].map((h, i) => (
                  <th key={h} className={`px-3 py-2 font-normal ${i === 0 ? "text-left" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...activeSeries(data.series)].reverse().map((p) => (
                <tr key={p.month} className="border-t border-line">
                  <td className="px-3 py-2 text-left"><button type="button" className="rounded-md py-1 text-accent hover:underline" onClick={() => onInspectMonth(p.month)} aria-label={t("home.categories.open", { name: monthLabel(p.month) })}>{monthLabel(p.month)}</button></td>
                  <td className="px-3 py-2"><Money amount={p.income} /></td>
                  <td className="px-3 py-2"><Money amount={p.expense} /></td>
                  <td className="px-3 py-2"><Money amount={p.result} /></td>
                  <td className="px-3 py-2">{formatBps(p.savingsRateBps)}</td>
                  <td className="px-3 py-2"><Money amount={p.invested} /></td>
                  <td className="px-3 py-2"><Money amount={p.netWorth} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </article>
  );
}
