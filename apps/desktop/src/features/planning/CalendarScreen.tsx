import { useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { axisProps, gridProps, Legend, lineCursor, TooltipBox, useMoneyChart } from "@/components/charts";
import { Icon, type IconName } from "@/components/Icon";
import { Button } from "@/components/Button";
import { Money } from "@/components/Money";
import { ErrorNote, PageHeader, Panel } from "@/components/Page";
import { Segmented } from "@/components/Segmented";
import { errorMessage } from "@/lib/api";
import { plotValue } from "@/lib/chart";
import { todayLocal } from "@/lib/dates";
import { useFormatMoney } from "@/hooks/useHideValues";
import { useCalendar, useProjection, type CalendarEvent } from "@/lib/queries";
import { formatDate, formatMonth, weekdayNames } from "@/lib/format";

/** How an event reads: money in, money out, a bill, a milestone. */
function look(event: CalendarEvent): { icon: IconName; dot: string; sign: "+" | "-" | null } {
  switch (event.kind) {
    case "INCOME":
    case "REDEMPTION":
      return { icon: "arrowDown", dot: "bg-positive", sign: "+" };
    case "INVOICE":
      return { icon: "card", dot: "bg-accent", sign: "-" };
    case "MATURITY":
      return { icon: "trend", dot: "bg-transfer", sign: null };
    case "TRANSFER":
      return { icon: "swap", dot: "bg-transfer", sign: null };
    default:
      return { icon: "arrowUp", dot: "bg-negative", sign: "-" };
  }
}

export function CalendarScreen({ month }: { month: string }) {
  const { t } = useTranslation();
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
      <PageHeader eyebrow={formatMonth(month)} title={t("shell.screens.calendar")} actions={month === today.slice(0, 7) ? <Button onClick={() => setSelected(today)}>{t("common.dates.today")}</Button> : undefined}>
        {t("planning.calendar.intro")}
      </PageHeader>

      {calendar.isError ? <ErrorNote>{errorMessage(calendar.error)}</ErrorNote> : null}

      {!calendar.isError ? <div className="grid items-start gap-4 @2xl:grid-cols-[1.5fr_1fr]">
        <Panel className="calendar-panel">
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-faint uppercase">
            {weekdayNames().map((day) => (
              <span key={day} className="pb-2">
                {day}
              </span>
            ))}
          </div>
          <div className={`grid grid-cols-7 gap-1 transition-opacity duration-(--dur-base) ${calendar.isPlaceholderData ? "opacity-50" : ""}`}>
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
                  className={`calendar-day flex h-14 min-w-0 flex-col items-start rounded-xl border px-1.5 py-2 text-left transition-colors @2xl:h-20 @2xl:px-3 ${
                    isFocus ? "border-accent/50 bg-accent/10" : "border-transparent hover:border-line hover:bg-hover"
                  } ${date < today ? "text-muted" : ""}`}
                  aria-pressed={isFocus}
                  aria-label={`${formatDate(date, "weekday")}: ${t("planning.calendar.items", { count: events.length })}`}
                >
                  <span className={`text-xs ${isToday ? "rounded-full bg-accent px-1.5 font-medium text-accent-fg" : ""}`}>
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
                { label: t("planning.calendar.legend.income"), color: "var(--positive)" },
                { label: t("planning.calendar.legend.expense"), color: "var(--negative)" },
                { label: t("transactions.form.invoice"), color: "var(--accent)" },
                { label: t("planning.calendar.legend.other"), color: "var(--transfer)" },
              ]}
            />
          </div>
        </Panel>

        <Panel flush className="day-agenda" title={formatDate(focus, "weekday")} subtitle={data && focusEvents.length === 0 ? t("planning.calendar.noEvents") : undefined}>
          {!data ? <div className="skeleton m-3 h-24" /> : null}
          {data && focusEvents.length === 0 ? <div className="flex items-center gap-3 p-4 text-muted"><Icon name="calendar" size={24} /><p className="text-sm">{t("planning.calendar.pickDay")}</p></div> : null}
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
                      {event.status === "PENDING" ? `${t("invoices.scheduled")} · ` : ""}
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
      </div> : null}
      {calendar.isError ? null : <DailyCashChart data={data} today={today} dim={calendar.isPlaceholderData} />}

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
  const { t } = useTranslation();
  const chart = useMoneyChart();
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
      title={t("planning.calendar.daily.title")}
      actions={
        hasProjection ? (
          <Legend
            items={[
              { label: t("planning.calendar.daily.real"), color: "var(--accent)", shape: "line" },
              { label: t("invoices.scheduled"), color: "var(--muted)", shape: "line" },
            ]}
          />
        ) : null
      }
    >
      <div className={`h-52 transition-opacity duration-(--dur-base) ${dim ? "opacity-50" : ""}`}>
        {data ? (
          <ResponsiveContainer>
            <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="date" tickFormatter={(d: string) => String(Number(d.slice(8, 10)))} {...axisProps} minTickGap={12} />
              <YAxis {...chart.yAxis} />
              {rows.some((r) => r.date === today) ? <ReferenceLine x={today} stroke="var(--line-strong)" /> : null}
              <Tooltip
                {...chart.tooltip}
                cursor={lineCursor}
                content={({ active, payload }) => {
                  const day = payload?.[0]?.payload as Day | undefined;
                  if (!active || !day) return null;
                  return (
                    <TooltipBox
                      title={formatDate(day.date, "weekday")}
                      rows={[
                        {
                          label: day.projected ? t("invoices.scheduled") : t("planning.calendar.daily.balance"),
                          color: day.projected ? "var(--muted)" : "var(--accent)",
                          value: <Money amount={day.cash} />,
                        },
                      ]}
                    />
                  );
                }}
              />
              <Line isAnimationActive={false} type="stepAfter" dataKey="real" stroke="var(--accent)" strokeWidth={2} dot={false} connectNulls={false} />
              <Line isAnimationActive={false}
                type="stepAfter"
                dataKey="forecast"
                stroke="var(--muted)"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
                connectNulls={false}
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
  const { t } = useTranslation();
  const chart = useMoneyChart();
  const money = useFormatMoney();
  const [months, setMonths] = useState<6 | 12>(6);
  const fill = useId();
  const projection = useProjection(months);
  const data = projection.data;
  const rows = data?.months.map((m) => ({ ...m, plot: plotValue(m.projectedCash) })) ?? [];
  type Row = (typeof rows)[number];

  return (
    <Panel
      title={t("planning.calendar.projection.title")}
      subtitle={
        data
          ? t("planning.calendar.projection.subtitle", { start: money(data.startCash), variable: money(data.variableEstimate), basedOn: t("planning.calendar.projection.months", { count: data.basedOnMonths || 0 }) })
          : undefined
      }
      actions={
        <Segmented
          size="sm"
          label={t("planning.calendar.projection.horizon")}
          value={String(months) as "6" | "12"}
          options={[
            { value: "6", label: t("investments.horizons.sixMonths") },
            { value: "12", label: t("home.sparkline.period") },
          ]}
          onChange={(value) => setMonths(Number(value) as 6 | 12)}
        />
      }
    >
      {projection.isError ? <ErrorNote>{errorMessage(projection.error)}</ErrorNote> : null}
      <div className="grid gap-6 @2xl:grid-cols-[1.3fr_1fr]">
        <div className="h-56 min-w-0">
          {data ? (
            <ResponsiveContainer>
              <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="month" tickFormatter={(m: string) => formatMonth(m, "short")} {...axisProps} />
                <YAxis {...chart.yAxis} />
                <ReferenceLine y={0} stroke="var(--negative)" strokeOpacity={0.5} />
                <Tooltip
                  {...chart.tooltip}
                  cursor={lineCursor}
                  content={({ active, payload }) => {
                    const row = payload?.[0]?.payload as Row | undefined;
                    if (!active || !row) return null;
                    return (
                      <TooltipBox
                        title={t("planning.calendar.projection.endOf", { month: formatMonth(row.month).toLowerCase() })}
                        rows={[
                          { label: t("planning.calendar.projection.projected"), color: "var(--series-1)", value: <Money amount={row.projectedCash} /> },
                          { label: t("planning.calendar.projection.income"), value: <Money amount={row.income} />, strong: false },
                          { label: t("planning.calendar.projection.fixed"), value: <Money amount={row.fixed} sign="-" />, strong: false },
                          { label: t("invoices.groups.installments"), value: <Money amount={row.installments} sign="-" />, strong: false },
                          { label: t("planning.calendar.projection.variable"), value: <Money amount={row.variableEstimate} sign="-" />, strong: false },
                        ]}
                      />
                    );
                  }}
                />
                <Area isAnimationActive={false} type="linear" dataKey="plot" stroke="var(--series-1)" strokeWidth={2} fill={`url(#${fill})`} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="skeleton h-full" />
          )}
        </div>
        <table className="w-full self-start text-right text-xs whitespace-nowrap tabular">
          <thead className="text-muted">
            <tr>
              <th className="py-1.5 text-left font-normal">{t("planning.calendar.projection.month")}</th>
              <th className="py-1.5 font-normal">{t("planning.calendar.projection.monthBalance")}</th>
              <th className="py-1.5 font-normal">{t("planning.calendar.projection.projected")}</th>
            </tr>
          </thead>
          <tbody>
            {data?.months.map((row) => (
              <tr key={row.month} className="border-t border-line">
                <td className="py-1.5 text-left">{formatMonth(row.month)}</td>
                <td className={`py-1.5 ${row.balance.startsWith("-") ? "text-negative" : "text-positive"}`}>
                  <Money amount={row.balance} />
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
