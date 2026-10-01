import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { axisProps, gridProps, Legend, lineCursor, TooltipBox, yAxisMoney } from "@/components/charts";
import { Icon, type IconName } from "@/components/Icon";
import { Money } from "@/components/Money";
import { PageHeader, Panel } from "@/components/Page";
import { Segmented } from "@/components/Segmented";
import { errorMessage } from "@/lib/api";
import { plotValue } from "@/lib/chart";
import { dayLabel, monthLabel, shortMonthLabel, todayLocal } from "@/lib/dates";
import { formatMinorUnits } from "@/lib/money";
import { useCalendar, useProjection, type CalendarEvent } from "@/lib/queries";

const weekdays = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** How an event reads: money in, money out, a bill, a milestone. */
function look(event: CalendarEvent): { icon: IconName; dot: string; sign: "+" | "-" | null } {
  switch (event.kind) {
    case "INCOME":
    case "REDEMPTION":
      return { icon: "arrowDown", dot: "bg-positive", sign: "+" };
    case "INVOICE":
      return { icon: "card", dot: "bg-gold", sign: "-" };
    case "MATURITY":
      return { icon: "trend", dot: "bg-transfer", sign: null };
    case "TRANSFER":
      return { icon: "swap", dot: "bg-transfer", sign: null };
    default:
      return { icon: "arrowUp", dot: "bg-negative", sign: "-" };
  }
}

export function CalendarScreen({ month }: { month: string }) {
  const calendar = useCalendar(month);
  const data = calendar.data;
  const today = todayLocal();
  const [selected, setSelected] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of data?.events ?? []) {
      map.set(event.date, [...(map.get(event.date) ?? []), event]);
    }
    return map;
  }, [data]);

  const [year, monthNumber] = month.split("-").map(Number);
  const firstWeekday = new Date(year, monthNumber - 1, 1).getDay();
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const cells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`),
  ];
  const focus = selected && selected.startsWith(month) ? selected : month === today.slice(0, 7) ? today : `${month}-01`;
  const focusEvents = byDay.get(focus) ?? [];

  return (
    <section className="animate-enter space-y-6">
      <PageHeader eyebrow="Calendário financeiro" title={monthLabel(month)}>
        Dias passados mostram o saldo real; os próximos, o previsto com pendentes e faturas.
      </PageHeader>

      {calendar.isError ? <p className="text-sm text-negative">{errorMessage(calendar.error)}</p> : null}

      <DailyCashChart data={data} today={today} dim={calendar.isPlaceholderData} />

      <div className="grid grid-cols-[1.5fr_1fr] gap-4">
        <Panel>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-faint uppercase">
            {weekdays.map((day) => (
              <span key={day} className="pb-2">
                {day}
              </span>
            ))}
          </div>
          <div className={`grid grid-cols-7 gap-1 transition-opacity ${calendar.isPlaceholderData ? "opacity-50" : ""}`}>
            {cells.map((date, index) => {
              if (!date) return <span key={`blank-${index}`} />;
              const events = byDay.get(date) ?? [];
              const isToday = date === today;
              const isFocus = date === focus;
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => setSelected(date)}
                  className={`flex h-16 flex-col items-start rounded-xl border px-2 py-1.5 text-left transition-colors ${
                    isFocus
                      ? "border-gold/50 bg-gold/10"
                      : "border-transparent hover:border-line hover:bg-white/[0.03]"
                  } ${date < today ? "text-muted" : ""}`}
                  aria-label={`${dayLabel(date)}: ${events.length} itens`}
                >
                  <span className={`text-xs ${isToday ? "rounded-full bg-gold px-1.5 font-medium text-background" : ""}`}>
                    {Number(date.slice(8, 10))}
                  </span>
                  <span className="mt-auto flex flex-wrap gap-0.5">
                    {events.slice(0, 5).map((event) => (
                      <span
                        key={event.id}
                        className={`h-1.5 w-1.5 rounded-full ${look(event).dot} ${event.status === "PENDING" ? "opacity-50" : ""}`}
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-4">
            <Legend
              items={[
                { label: "Entrada", color: "var(--positive)" },
                { label: "Saída", color: "var(--negative)" },
                { label: "Fatura", color: "var(--gold)" },
                { label: "Vencimento / transferência", color: "var(--transfer)" },
              ]}
            />
          </div>
        </Panel>

        <Panel flush title={dayLabel(focus)} subtitle={focusEvents.length === 0 ? "Nada neste dia." : undefined}>
          <ul>
            {focusEvents.map((event) => {
              const style = look(event);
              return (
                <li key={event.id} className="flex items-center gap-3 rounded-2xl px-3 py-2.5">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted ${event.status === "PENDING" ? "border border-dashed border-line-strong" : ""}`}>
                    <Icon name={style.icon} size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{event.title}</span>
                    <span className="block truncate text-xs text-muted">
                      {event.status === "PENDING" ? "Previsto · " : ""}
                      {event.subtitle}
                    </span>
                  </span>
                  {event.amount !== "0" ? (
                    <Money
                      amount={event.amount}
                      sign={style.sign ?? undefined}
                      tone={style.sign === "+" ? "positive" : "plain"}
                      className="text-sm"
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <ProjectionPanel />
    </section>
  );
}

type Day = { date: string; cash: string; projected: boolean };

function DailyCashChart({
  data,
  today,
  dim,
}: {
  data: { days: Day[] } | undefined;
  today: string;
  dim: boolean;
}) {
  // Two series of the same measure: real (solid) and projected (dashed),
  // joined at today so the line is continuous.
  const rows =
    data?.days.map((day, index, all) => {
      const value = plotValue(day.cash);
      const joins = !day.projected && all[index + 1]?.projected;
      return {
        ...day,
        real: day.projected ? null : value,
        forecast: day.projected || joins ? value : null,
      };
    }) ?? [];
  const hasProjection = rows.some((row) => row.projected);

  return (
    <Panel
      title="Saldo em contas, dia a dia"
      actions={
        hasProjection ? (
          <Legend
            items={[
              { label: "Real", color: "var(--gold)", shape: "line" },
              { label: "Previsto", color: "var(--muted)", shape: "line" },
            ]}
          />
        ) : null
      }
    >
      <div className={`h-52 transition-opacity ${dim ? "opacity-50" : ""}`}>
        {data ? (
          <ResponsiveContainer>
            <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="date" tickFormatter={(d: string) => String(Number(d.slice(8, 10)))} {...axisProps} minTickGap={12} />
              <YAxis {...yAxisMoney} />
              {rows.some((r) => r.date === today) ? <ReferenceLine x={today} stroke="var(--line-strong)" /> : null}
              <Tooltip
                cursor={lineCursor}
                content={({ active, payload }) => {
                  const day = payload?.[0]?.payload as Day | undefined;
                  if (!active || !day) return null;
                  return (
                    <TooltipBox
                      title={dayLabel(day.date)}
                      rows={[
                        {
                          label: day.projected ? "Previsto" : "Saldo",
                          color: day.projected ? "var(--muted)" : "var(--gold)",
                          value: formatMinorUnits(day.cash),
                        },
                      ]}
                    />
                  );
                }}
              />
              <Line type="stepAfter" dataKey="real" stroke="var(--gold)" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
              <Line
                type="stepAfter"
                dataKey="forecast"
                stroke="var(--muted)"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="skeleton h-full" />
        )}
      </div>
    </Panel>
  );
}

function ProjectionPanel() {
  const [months, setMonths] = useState<6 | 12>(6);
  const projection = useProjection(months);
  const data = projection.data;
  const rows = data?.months.map((m) => ({ ...m, plot: plotValue(m.projectedCash) })) ?? [];
  type Row = (typeof rows)[number];

  return (
    <Panel
      title="Projeção de saldo"
      subtitle={
        data
          ? `Começa em ${formatMinorUnits(data.startCash)} hoje. Soma recorrências, parcelas e faturas e desconta ${formatMinorUnits(data.variableEstimate)}/mês de gasto variável (média de ${data.basedOnMonths || 0} ${data.basedOnMonths === 1 ? "mês" : "meses"}).`
          : undefined
      }
      actions={
        <Segmented
          size="sm"
          value={String(months) as "6" | "12"}
          options={[
            { value: "6", label: "6 meses" },
            { value: "12", label: "12 meses" },
          ]}
          onChange={(value) => setMonths(Number(value) as 6 | 12)}
        />
      }
    >
      {projection.isError ? <p className="text-sm text-negative">{errorMessage(projection.error)}</p> : null}
      <div className="grid grid-cols-[1.3fr_1fr] gap-6">
        <div className="h-56">
          {data ? (
            <ResponsiveContainer>
              <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="projectionFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="month" tickFormatter={(m: string) => shortMonthLabel(m)} {...axisProps} />
                <YAxis {...yAxisMoney} />
                <ReferenceLine y={0} stroke="var(--negative)" strokeOpacity={0.5} />
                <Tooltip
                  cursor={lineCursor}
                  content={({ active, payload }) => {
                    const row = payload?.[0]?.payload as Row | undefined;
                    if (!active || !row) return null;
                    return (
                      <TooltipBox
                        title={`Fim de ${monthLabel(row.month).toLowerCase()}`}
                        rows={[
                          { label: "Saldo previsto", color: "var(--series-1)", value: formatMinorUnits(row.projectedCash) },
                          { label: "Entradas", value: formatMinorUnits(row.income), strong: false },
                          { label: "Fixos", value: `− ${formatMinorUnits(row.fixed)}`, strong: false },
                          { label: "Parcelas", value: `− ${formatMinorUnits(row.installments)}`, strong: false },
                          { label: "Variável (média)", value: `− ${formatMinorUnits(row.variableEstimate)}`, strong: false },
                        ]}
                      />
                    );
                  }}
                />
                <Area type="linear" dataKey="plot" stroke="var(--series-1)" strokeWidth={2} fill="url(#projectionFill)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="skeleton h-full" />
          )}
        </div>
        <table className="w-full self-start text-right text-xs tabular">
          <thead className="text-muted">
            <tr>
              <th className="py-1.5 text-left font-normal">Mês</th>
              <th className="py-1.5 font-normal">Saldo do mês</th>
              <th className="py-1.5 font-normal">Saldo previsto</th>
            </tr>
          </thead>
          <tbody>
            {data?.months.map((row) => (
              <tr key={row.month} className="border-t border-line">
                <td className="py-1.5 text-left">{monthLabel(row.month)}</td>
                <td className={`py-1.5 ${row.balance.startsWith("-") ? "text-negative" : "text-positive"}`}>
                  {formatMinorUnits(row.balance)}
                </td>
                <td className={`py-1.5 ${row.projectedCash.startsWith("-") ? "text-negative" : ""}`}>
                  <Money amount={row.projectedCash} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
