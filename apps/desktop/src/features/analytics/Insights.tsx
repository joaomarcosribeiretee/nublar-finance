import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { axisProps, ChartCard, gridProps, Legend, lineCursor, TooltipBox, yAxisMoney } from "@/components/charts";
import { Money } from "@/components/Money";
import { ErrorNote, ProgressBar } from "@/components/Page";
import { errorMessage } from "@/lib/api";
import { plotValue } from "@/lib/chart";
import { currentMonth, monthLabel, shiftMonth, todayLocal } from "@/lib/dates";
import {
  averageCumulative,
  cumulativeSpending,
  formatTenths,
  incomeSplit,
  reserveTenths,
  type SplitPart,
} from "@/lib/insights";
import { formatMinorUnits } from "@/lib/money";
import { usePortfolio, useSummary, useTransactionsFor, type Analytics, type Transaction } from "@/lib/queries";

/** How many earlier months make "the usual" pace. */
const PACE_HISTORY = 3;

/** `months[0]` is the browsed month; the rest make the average. */
function readPace(months: string[], lists: Transaction[][]) {
  const [current, ...history] = months.map((month, index) => cumulativeSpending(lists[index], month));
  const average = averageCumulative(history, current.length);
  // The browsed month is still running: the line stops at today.
  const lastDay = months[0] === currentMonth() ? Number(todayLocal().slice(8, 10)) : current.length;
  const rows = current.map((value, index) => ({
    day: index + 1,
    spent: index < lastDay ? value : null,
    usual: average ? average[index] : null,
  }));
  return { rows, lastDay, spent: current[lastDay - 1], usual: average ? average[lastDay - 1] : null };
}

/** Spending so far this month against the same day of the usual month. */
export function SpendingPace({ month }: { month: string }) {
  const months = useMemo(
    () => [month, ...Array.from({ length: PACE_HISTORY }, (_, index) => shiftMonth(month, -(index + 1)))],
    [month],
  );
  const lists = useTransactionsFor(months);
  const failed = lists.find((list) => list.isError);
  const loading = lists.some((list) => list.isPending);

  const reading = lists.some((list) => !list.data) ? null : readPace(months, lists.map((list) => list.data ?? []));

  const plotted = reading?.rows.map((row) => ({
    ...row,
    spentPlot: row.spent === null ? null : plotValue(row.spent.toString()),
    usualPlot: row.usual === null ? null : plotValue(row.usual.toString()),
  }));
  type Row = NonNullable<typeof plotted>[number];
  const difference = reading?.usual != null ? reading.spent - reading.usual : null;

  return (
    <ChartCard
      title="Ritmo de gastos"
      subtitle={`Gasto acumulado em ${monthLabel(month).toLowerCase()}, comparado com a média dos ${PACE_HISTORY} meses anteriores`}
      right={
        reading?.usual != null ? (
          <Legend
            items={[
              { label: "Este mês", color: "var(--accent)", shape: "line" },
              { label: "Normal", color: "var(--muted)", shape: "line" },
            ]}
          />
        ) : null
      }
    >
      {failed ? (
        <ErrorNote>{errorMessage(failed.error)}</ErrorNote>
      ) : loading || !reading || !plotted ? (
        <div className="space-y-3">
          <div className="skeleton h-7 w-56" />
          <div className="skeleton h-48" />
        </div>
      ) : reading.spent === 0n && reading.usual === null ? (
        <p className="py-8 text-center text-sm text-faint">Nenhum gasto registrado em {monthLabel(month).toLowerCase()}.</p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <Money amount={reading.spent.toString()} className="text-2xl" />
            <span className="text-xs text-muted">
              até o dia {reading.lastDay}
              {difference === null ? (
                " · sem meses anteriores para comparar"
              ) : difference === 0n ? (
                " · igual ao normal"
              ) : (
                <>
                  {" · "}
                  <span className={difference > 0n ? "text-negative" : "text-positive"}>
                    {formatMinorUnits((difference > 0n ? difference : -difference).toString())}{" "}
                    {difference > 0n ? "acima" : "abaixo"} do normal
                  </span>
                </>
              )}
            </span>
          </div>
          <div className="h-52">
            <ResponsiveContainer>
              <LineChart data={plotted} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="day" {...axisProps} minTickGap={16} />
                <YAxis {...yAxisMoney} />
                <Tooltip
                  cursor={lineCursor}
                  content={({ active, payload }) => {
                    const row = payload?.[0]?.payload as Row | undefined;
                    if (!active || !row) return null;
                    return (
                      <TooltipBox
                        title={`Até o dia ${row.day}`}
                        rows={[
                          ...(row.spent !== null
                            ? [{ label: "Este mês", color: "var(--accent)", value: formatMinorUnits(row.spent.toString()) }]
                            : []),
                          ...(row.usual !== null
                            ? [{ label: "Normal", color: "var(--muted)", value: formatMinorUnits(row.usual.toString()), strong: false }]
                            : []),
                        ]}
                      />
                    );
                  }}
                />
                <Line
                  type="stepAfter"
                  dataKey="usualPlot"
                  stroke="var(--muted)"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="stepAfter"
                  dataKey="spentPlot"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                  activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2, fill: "var(--accent)" }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </ChartCard>
  );
}

/** A reserve is usually advised at 3 to 6 months of spending. */
const RESERVE_GOAL_TENTHS = 60;
const RESERVE_LOW_TENTHS = 30;

/** How long the money you can reach today would last at the usual spending. */
export function ReserveCard({ data }: { data: Analytics | undefined }) {
  const now = currentMonth();
  const summary = useSummary(now);
  const portfolio = usePortfolio();
  const failed = summary.error ?? portfolio.error;

  // Complete months only: the running month has not finished spending yet.
  const finished = data?.series.filter((point) => point.tracked && point.month < now) ?? [];
  const monthly = finished.length
    ? finished.reduce((sum, point) => sum + BigInt(point.expense), 0n) / BigInt(finished.length)
    : data
      ? BigInt(data.kpis.averageExpense)
      : null;
  const openInvoices =
    summary.data?.invoices.reduce((sum, invoice) => sum + (invoice.status === "PAID" ? 0n : BigInt(invoice.remaining)), 0n) ?? 0n;
  const available =
    summary.data && portfolio.data
      ? BigInt(summary.data.cash) + BigInt(portfolio.data.fixedIncome.daily) - openInvoices
      : null;
  const tenths = available !== null && monthly !== null ? reserveTenths(available, monthly) : null;

  return (
    <ChartCard title="Reserva de emergência" subtitle="Quanto tempo o dinheiro que dá para sacar hoje cobre o seu gasto normal">
      {failed ? (
        <ErrorNote>{errorMessage(failed)}</ErrorNote>
      ) : available === null || monthly === null ? (
        <div className="space-y-3">
          <div className="skeleton h-9 w-40" />
          <div className="skeleton h-2" />
        </div>
      ) : tenths === null ? (
        <p className="text-sm text-faint">Registre os gastos de um mês inteiro para calcular a reserva.</p>
      ) : (
        <div className="space-y-4">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className={`font-display text-4xl tracking-tight ${tenths < RESERVE_LOW_TENTHS ? "text-warning" : ""}`}>
              {formatTenths(tenths)}
            </span>
            <span className="text-sm text-muted">{tenths === 10 ? "mês" : "meses"} de gastos</span>
          </p>
          {tenths <= RESERVE_GOAL_TENTHS ? (
            <ProgressBar
              size="md"
              value={(tenths / RESERVE_GOAL_TENTHS) * 100}
              tone={tenths < RESERVE_LOW_TENTHS ? "warning" : "positive"}
              marker={(RESERVE_LOW_TENTHS / RESERVE_GOAL_TENTHS) * 100}
              markerTitle="3 meses"
            />
          ) : null}
          <dl className="grid max-w-xl gap-x-8 gap-y-1 text-xs sm:grid-cols-2">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Dá para sacar hoje</dt>
              <dd>
                <Money amount={available.toString()} />
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Gasto normal por mês</dt>
              <dd>
                <Money amount={monthly.toString()} />
              </dd>
            </div>
          </dl>
          <p className="text-[11px] text-faint">
            Contas + renda fixa com liquidez diária, menos faturas em aberto.{" "}
            {tenths > RESERVE_GOAL_TENTHS ? "Acima dos 6 meses que costumam ser recomendados." : "O usual é ter de 3 a 6 meses."}
          </p>
        </div>
      )}
    </ChartCard>
  );
}

const splitLook: Record<SplitPart["key"], { label: string; color: string }> = {
  fixed: { label: "Fixos", color: "var(--series-1)" },
  installments: { label: "Parcelas", color: "var(--series-2)" },
  variable: { label: "Dia a dia", color: "var(--series-3)" },
  invested: { label: "Investido", color: "var(--accent)" },
  left: { label: "Ficou na conta", color: "var(--line-strong)" },
};

/** Where the month's income went, read as "of every R$ 100". */
export function IncomeSplitCard({ data }: { data: Analytics | undefined }) {
  const point = data?.series.find((p) => p.month === data.to);
  const split = point ? incomeSplit(point) : null;
  const per100 = (amount: bigint) => (split ? Number((amount * 100n + split.base / 2n) / split.base) : 0);
  const month = data ? monthLabel(data.to).toLowerCase() : "";

  return (
    <ChartCard
      title={split && split.over > 0n ? "Para cada R$ 100 que saíram" : "Para cada R$ 100 que entraram"}
      subtitle={data ? `Em ${month}` : undefined}
    >
      {!data ? (
        <div className="space-y-3">
          <div className="skeleton h-3" />
          <div className="skeleton h-20" />
        </div>
      ) : !split ? (
        <p className="py-6 text-center text-sm text-faint">Nada entrou nem saiu em {month}.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex h-3 gap-[2px] overflow-hidden rounded-full" aria-hidden="true">
            {split.parts.map((part) => (
              <div
                key={part.key}
                className="h-full first:rounded-l-full last:rounded-r-full"
                style={{ width: `${Math.max(per100(part.amount), 1)}%`, background: splitLook[part.key].color }}
              />
            ))}
          </div>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {split.parts.map((part) => (
              <li key={part.key} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: splitLook[part.key].color }} />
                {splitLook[part.key].label}
                <span className="font-medium tabular">R$ {per100(part.amount)}</span>
                <Money amount={part.amount.toString()} className="text-xs text-muted" />
              </li>
            ))}
          </ul>
          {split.over > 0n ? (
            <p className="text-sm text-negative">
              Saiu <Money amount={split.over.toString()} /> a mais do que entrou.
            </p>
          ) : null}
        </div>
      )}
    </ChartCard>
  );
}
