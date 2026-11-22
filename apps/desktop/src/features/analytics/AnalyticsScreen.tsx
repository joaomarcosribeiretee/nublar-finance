import { useId, useMemo, useState } from "react";
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
  yAxisMoney,
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
import { formatMinorUnits, percentOf } from "@/lib/money";
import { activeSeries } from "@/lib/insights";
import { useAnalytics, type Analytics } from "@/lib/queries";
import { IncomeSplitCard, ReserveCard, SpendingPace } from "./Insights";
import { BudgetOverview } from "@/features/planning/BudgetOverview";

type Point = Analytics["series"][number];

const colors = {
  income: "var(--series-1)",
  expense: "var(--series-2)",
  fixed: "var(--series-1)",
  installments: "var(--series-2)",
  variable: "var(--series-3)",
  savings: "var(--series-3)",
  worth: "var(--gold)",
};

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
  const [months, setMonths] = useState<6 | 12 | 24>(12);
  const [view, setView] = useState<"worth" | "flow" | "future">("worth");
  const analytics = useAnalytics(month, months);
  const data = analytics.data;
  const dim = analytics.isPlaceholderData;

  return (
    <section className="animate-enter space-y-6">
      <PageHeader
        eyebrow={data ? `${monthLabel(data.from)} a ${monthLabel(data.to)}` : "Sua evolução financeira"}
        title="Análises"
        actions={
          <Segmented
            size="sm"
            label="Período"
            value={String(months) as "6" | "12" | "24"}
            options={[
              { value: "6", label: "6 meses" },
              { value: "12", label: "12 meses" },
              { value: "24", label: "24 meses" },
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
          title="Ainda não há o que analisar"
          description="Registre receitas, despesas e investimentos. Os gráficos aparecem assim que existir o primeiro lançamento."
        />
      ) : (
        <>
          <Kpis data={data} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented label="Assunto da análise" value={view} options={[
              { value: "worth", label: "Patrimônio" },
              { value: "flow", label: "Entradas e saídas" },
              { value: "future", label: "Compromissos" },
            ]} onChange={setView} />
            <Button variant="ghost" onClick={() => onInspectMonth(month)}>Ver lançamentos do mês <Icon name="chevronRight" size={15} /></Button>
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
    <div role="region" aria-label="Resumo financeiro do período" tabIndex={0} className="analysis-metrics grid grid-cols-1 gap-3 @2xl:grid-cols-2">
      <StatTile
        label="Patrimônio"
        loading={!k}
        value={k ? <Money amount={k.netWorth} /> : null}
        detail={
          since ? (
            <>
              <span className={change > 0n ? "text-positive" : change < 0n ? "text-negative" : ""}>
                {change > 0n ? "+" : ""}
                {formatMinorUnits(change.toString()).replace("-", "−")}
              </span>{" "}
              desde {monthLabel(since.month).toLowerCase()}
            </>
          ) : k ? (
            "Primeiro mês acompanhado"
          ) : null
        }
      />
      <StatTile
        label="Sobrou no mês"
        loading={loading}
        value={point ? <Money amount={result.toString()} tone="auto" /> : null}
        detail={point ? `Entrou ${formatMinorUnits(point.income)} · poupança ${formatBps(point.savingsRateBps)}` : null}
      />
    </div>
  );
}

function NetWorthChart({ data, dim }: { data: Analytics | undefined; dim: boolean }) {
  const fill = useId();
  const rows = useMemo(
    () => (data ? activeSeries(data.series) : []).map((p) => ({ ...p, plot: plotValue(p.netWorth) })),
    [data],
  );
  const trimmed = data ? rows.length < data.series.length : false;
  return (
    <ChartCard
      title="Evolução do patrimônio"
      subtitle={
        trimmed && rows[0]
          ? `Contas + investimentos − dívida dos cartões, desde ${monthLabel(rows[0].month).toLowerCase()}, quando você começou a acompanhar`
          : "Contas + investimentos − dívida dos cartões, no fim de cada mês"
      }
      dim={dim}
    >
      <div className="h-64">
        {data ? (
          <ResponsiveContainer>
            <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--gold)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--gold)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="month" tickFormatter={axisMonth} {...axisProps} />
              <YAxis {...yAxisMoney} />
              <Tooltip
                cursor={lineCursor}
                content={({ active, payload }) => {
                  const point = payload?.[0]?.payload as Point | undefined;
                  if (!active || !point) return null;
                  return (
                    <TooltipBox
                      title={monthLabel(point.month)}
                      rows={[
                        { label: "Patrimônio", color: colors.worth, value: formatMinorUnits(point.netWorth) },
                        { label: "Contas", value: formatMinorUnits(point.cash), strong: false },
                        { label: "Investimentos", value: formatMinorUnits(point.investments), strong: false },
                        { label: "Cartões", value: `− ${formatMinorUnits(point.cardDebt)}`, strong: false },
                      ]}
                    />
                  );
                }}
              />
              <Area isAnimationActive={false}
                type="monotone"
                dataKey="plot"
                stroke="var(--gold)"
                strokeWidth={2}
                fill={`url(#${fill})`}
                activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2, fill: "var(--gold)" }}
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
      title="Receitas × despesas"
      subtitle="Por mês de competência"
      right={
        <Legend
          items={[
            { label: "Receitas", color: colors.income },
            { label: "Despesas", color: colors.expense },
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
              <YAxis {...yAxisMoney} />
              <Tooltip
                cursor={barCursor}
                content={({ active, payload }) => {
                  const point = payload?.[0]?.payload as Point | undefined;
                  if (!active || !point) return null;
                  return (
                    <TooltipBox
                      title={monthLabel(point.month)}
                      rows={[
                        { label: "Receitas", color: colors.income, value: formatMinorUnits(point.income) },
                        { label: "Despesas", color: colors.expense, value: formatMinorUnits(point.expense) },
                        { label: "Resultado", value: formatMinorUnits(point.result) },
                        { label: "Poupança", value: formatBps(point.savingsRateBps), strong: false },
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
  const items = data?.categories.slice(0, 8) ?? [];
  const max = items.reduce((m, c) => {
    for (const v of [c.amount, c.average]) if (BigInt(v) > BigInt(m)) m = v;
    return m;
  }, "0");
  const previousMonth = data ? shortMonthLabel(shiftMonth(data.to, -1)) : "";

  return (
    <ChartCard
      title="Para onde foi o dinheiro"
      subtitle={data ? `${monthLabel(data.to)} · marca = média dos 3 meses anteriores` : undefined}
      dim={dim}
    >
      {!data ? (
        <div className="space-y-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-8" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-sm text-faint">Nenhuma despesa no mês.</p>
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
                  <span className="truncate">{category.name}</span>
                  <span className="flex shrink-0 items-baseline gap-2">
                    {deltaBps !== null && delta !== 0n ? (
                      <span
                        className={`flex items-center gap-0.5 text-[11px] ${delta > 0n ? "text-negative" : "text-positive"}`}
                        title={`Em ${previousMonth}: ${formatMinorUnits(category.previous)}`}
                      >
                        <Icon name={delta > 0n ? "arrowUp" : "arrowDown"} size={11} />
                        <span className="sr-only">{delta > 0n ? "subiu " : "caiu "}</span>
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
                    markerTitle={`Média: ${formatMinorUnits(category.average)}`}
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
  const slices = data?.allocation ?? [];
  const total = slices.reduce((sum, s) => sum + BigInt(s.value), 0n).toString();
  const rows = slices.map((s) => ({ ...s, plot: plotValue(s.value) }));

  return (
    <ChartCard title="Onde está o patrimônio" subtitle="Contas e investimentos hoje" dim={dim}>
      {!data ? (
        <div className="skeleton h-48" />
      ) : slices.length === 0 ? (
        <p className="py-8 text-center text-sm text-faint">Nada para distribuir ainda.</p>
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
                  content={({ active, payload }) => {
                    const slice = payload?.[0]?.payload as (typeof rows)[number] | undefined;
                    if (!active || !slice) return null;
                    return (
                      <TooltipBox
                        title={slice.name}
                        rows={[
                          {
                            label: `${Math.round(percentOf(slice.value, total))}%`,
                            color: allocationColors[slice.key],
                            value: formatMinorUnits(slice.value),
                          },
                        ]}
                      />
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] text-muted uppercase">Total</span>
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
                <span className="truncate">{slice.name}</span>
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
      title="Já comprometido"
      subtitle="Próximos 6 meses: parcelas lançadas e despesas recorrentes"
      right={
        <Legend
          items={[
            { label: "Recorrentes", color: colors.fixed },
            { label: "Parcelas", color: colors.installments },
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
              <YAxis {...yAxisMoney} />
              <Tooltip
                cursor={barCursor}
                content={({ active, payload }) => {
                  const row = payload?.[0]?.payload as Row | undefined;
                  if (!active || !row) return null;
                  return (
                    <TooltipBox
                      title={monthLabel(row.month)}
                      rows={[
                        { label: "Parcelas", color: colors.installments, value: formatMinorUnits(row.installments) },
                        { label: "Recorrentes", color: colors.fixed, value: formatMinorUnits(row.recurringExpense) },
                        { label: "Receitas recorrentes", value: formatMinorUnits(row.recurringIncome), strong: false },
                        { label: "Saldo previsto", value: formatMinorUnits(row.balance), strong: false },
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
        Tabela mês a mês
        <Icon name="chevronRight" size={15} className={`text-muted transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open ? (
        <div className="animate-enter overflow-x-auto px-2 pb-3">
          <table className="w-full text-right text-xs whitespace-nowrap tabular">
            <thead className="text-muted">
              <tr>
                {["Mês", "Receitas", "Despesas", "Resultado", "Poupança", "Investido", "Patrimônio"].map((h, i) => (
                  <th key={h} className={`px-3 py-2 font-normal ${i === 0 ? "text-left" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...activeSeries(data.series)].reverse().map((p) => (
                <tr key={p.month} className="border-t border-line">
                  <td className="px-3 py-2 text-left"><button type="button" className="rounded-md py-1 text-gold hover:underline" onClick={() => onInspectMonth(p.month)} aria-label={`Ver lançamentos de ${monthLabel(p.month)}`}>{monthLabel(p.month)}</button></td>
                  <td className="px-3 py-2">{formatMinorUnits(p.income)}</td>
                  <td className="px-3 py-2">{formatMinorUnits(p.expense)}</td>
                  <td className="px-3 py-2">{formatMinorUnits(p.result)}</td>
                  <td className="px-3 py-2">{formatBps(p.savingsRateBps)}</td>
                  <td className="px-3 py-2">{formatMinorUnits(p.invested)}</td>
                  <td className="px-3 py-2">{formatMinorUnits(p.netWorth)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </article>
  );
}
