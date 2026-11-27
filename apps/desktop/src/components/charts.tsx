import type { ReactNode } from "react";
import { useHideValues } from "@/hooks/useHideValues";
import { compactBRL } from "@/lib/chart";

/** Shared axis/grid styling: hairline, recessive, solid (never dashed). */
export const axisTick = { fill: "var(--muted)", fontSize: 11 };
export const axisProps = {
  axisLine: false,
  tickLine: false,
  tick: axisTick,
} as const;
const yAxisMoney = {
  ...axisProps,
  width: 84,
  tickFormatter: (value: number) => compactBRL(value),
} as const;
/**
 * Money axis and tooltip for a chart. In privacy mode the marks keep their
 * shape, but the axis loses its labels (same width, so nothing shifts) and the
 * tooltip never opens. Spread `yAxis` on <YAxis> and `tooltip` on <Tooltip>.
 */
export function useMoneyChart() {
  const hidden = useHideValues();
  return hidden
    ? { yAxis: { ...yAxisMoney, tick: false }, tooltip: { active: false } }
    : { yAxis: yAxisMoney, tooltip: {} };
}
export const gridProps = {
  stroke: "var(--grid)",
  vertical: false,
} as const;
/** Hover wash behind the active bar group. */
export const barCursor = { fill: "var(--hover)" };
/** Crosshair for line/area charts. */
export const lineCursor = { stroke: "var(--line-strong)", strokeWidth: 1 };

export function ChartCard({
  title,
  subtitle,
  right,
  children,
  className = "",
  dim,
}: {
  title: string;
  subtitle?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Previous render held at reduced opacity while refetching. */
  dim?: boolean;
}) {
  return (
    <article aria-busy={dim} className={`content-panel chart-panel min-w-0 rounded-3xl border border-line bg-surface p-5 @2xl:p-6 ${className}`}>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-base font-medium">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
        </div>
        {right}
      </header>
      <div className={`transition-opacity duration-(--dur-base) ${dim ? "opacity-50" : ""}`}>{children}</div>
    </article>
  );
}

export type LegendItem = { label: string; color: string; shape?: "rect" | "line" };

/** Legend mirrors the mark: rect for bars/areas, line for lines. */
export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          {item.shape === "line" ? (
            <span className="h-0.5 w-3 rounded-full" style={{ background: item.color }} />
          ) : (
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: item.color }} />
          )}
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export type TooltipRow = { label: string; color?: string; value: ReactNode; strong?: boolean };

/** Values lead, labels follow; rows keyed with a short line of the series color. */
export function TooltipBox({ title, rows }: { title: string; rows: TooltipRow[] }) {
  return (
    <div className="max-w-[min(300px,calc(100vw-40px))] rounded-xl border border-line-strong bg-raised px-3 py-2.5 text-xs shadow-xl shadow-shadow/40">
      <p className="mb-1.5 text-muted">{title}</p>
      <ul className="space-y-1">
        {rows.map((row) => (
          <li key={row.label} className="flex flex-wrap items-center gap-2">
            {row.color ? (
              <span className="h-0.5 w-2.5 shrink-0 rounded-full" style={{ background: row.color }} />
            ) : (
              <span className="w-2.5 shrink-0" />
            )}
            <span className={`tabular ${row.strong === false ? "text-muted" : "font-medium text-foreground"}`}>
              {row.value}
            </span>
            <span className="ml-auto pl-3 text-muted">{row.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A KPI tile: the number is the chart. */
export function StatTile({
  label,
  value,
  detail,
  loading,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="metric-tile min-w-0 rounded-2xl border border-line bg-surface p-5">
      <p className="text-xs text-muted">{label}</p>
      <div className="mt-2 break-words text-xl tabular">
        {loading ? <div className="skeleton h-7 w-28" /> : value}
      </div>
      <div className="mt-2 min-h-4 text-xs leading-relaxed text-muted">{loading ? null : detail}</div>
    </div>
  );
}
