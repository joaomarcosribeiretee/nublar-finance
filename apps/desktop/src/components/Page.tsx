import type { ReactNode } from "react";
import { Icon } from "./Icon";

/**
 * Every screen opens the same way: a quiet eyebrow, the title in the display
 * face, actions on the right. Keep screens consistent by always using this.
 */
export function PageHeader({
  eyebrow,
  title,
  actions,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  actions?: ReactNode;
  /** Optional line under the title (a hint or a key number). */
  children?: ReactNode;
}) {
  return (
    <header className="page-heading flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        {eyebrow ? <p className="design-eyebrow">{eyebrow}</p> : null}
        <h1 className="mt-1 font-display text-3xl leading-tight tracking-tight @2xl:text-[2.75rem]">{title}</h1>
        {children ? <div className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{children}</div> : null}
      </div>
      {actions ? <div className="flex max-w-full flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** The one card style for content blocks. */
export function Panel({
  title,
  subtitle,
  actions,
  children,
  className = "",
  flush,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Lists bring their own row padding. */
  flush?: boolean;
}) {
  return (
    <article className={`content-panel min-w-0 rounded-3xl border border-line bg-surface ${flush ? "p-2 @2xl:p-3" : "p-5 @2xl:p-7"} ${className}`}>
      {title || actions ? (
        <header className={`flex flex-wrap items-start justify-between gap-x-4 gap-y-2 ${flush ? "px-3 pt-2 pb-3" : "mb-4"}`}>
          <div className="min-w-0">
            {title ? <h2 className="text-base font-medium">{title}</h2> : null}
            {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </article>
  );
}

const meterColors = {
  accent: "var(--accent)",
  positive: "var(--positive)",
  warning: "var(--warning)",
  negative: "var(--negative)",
  series: "var(--series-1)",
};

/**
 * Thin progress bar; the color carries status, the label carries meaning.
 * The fill slides on `translate`, so a changing value never triggers layout.
 */
export function ProgressBar({
  value,
  tone = "accent",
  color,
  marker,
  markerTitle,
  size = "sm",
}: {
  /** 0–100 (clamped). */
  value: number;
  tone?: keyof typeof meterColors;
  /** Entity color (a goal, an institution) instead of a status tone. */
  color?: string;
  /** Optional thin marker, e.g. where the month is today. */
  marker?: number;
  markerTitle?: string;
  size?: "xs" | "sm" | "md";
}) {
  const shown = Math.min(Math.max(value, value > 0 ? 1.5 : 0), 100);
  return (
    <div className="relative">
      <div className={`overflow-hidden rounded-full bg-surface-2 ${size === "md" ? "h-2" : size === "xs" ? "h-1" : "h-1.5"}`}>
        <div
          className="h-full rounded-full transition-[translate] duration-(--dur-slow)"
          style={{ translate: `${shown - 100}% 0`, background: color ?? meterColors[tone] }}
        />
      </div>
      {marker !== undefined ? (
        <span
          title={markerTitle}
          className="absolute -top-1 h-3.5 w-0.5 rounded-full bg-foreground/60"
          style={{ left: `calc(${Math.min(Math.max(marker, 0), 100)}% - 1px)` }}
        />
      ) : null}
    </div>
  );
}

/** Previous / next around the thing they change: one control, not two ends. */
export function Stepper({
  label,
  previousLabel,
  nextLabel,
  onPrevious,
  onNext,
  className = "",
}: {
  label: ReactNode;
  previousLabel: string;
  nextLabel: string;
  onPrevious: () => void;
  onNext: () => void;
  className?: string;
}) {
  const button =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-foreground";
  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      <button type="button" aria-label={previousLabel} className={button} onClick={onPrevious}>
        <Icon name="chevronLeft" size={16} />
      </button>
      <span className="min-w-28 px-1 text-center text-sm tabular">{label}</span>
      <button type="button" aria-label={nextLabel} className={button} onClick={onNext}>
        <Icon name="chevronRight" size={16} />
      </button>
    </div>
  );
}

/** A row of figures sharing one frame, hairlines between them. */
export function StatStrip({
  items,
  columns = "grid-cols-3",
}: {
  items: { label: string; value: ReactNode; hint?: string }[];
  /** Literal grid classes, e.g. "grid-cols-2 sm:grid-cols-4". */
  columns?: string;
}) {
  return (
    <dl className={`stat-strip grid gap-4 ${columns}`}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0 py-2" title={item.hint}>
          <dt className="truncate text-xs text-muted">{item.label}</dt>
          <dd className="mt-1 break-words text-base tabular sm:text-lg">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Inline failure for a block that could not load: says so, never shows zero. */
export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="error-note flex items-start gap-3 rounded-2xl border border-negative/20 bg-negative-surface p-4 text-sm text-negative">
      <Icon name="close" size={17} className="mt-0.5 shrink-0" />
      <p className="min-w-0 break-words">{children}</p>
    </div>
  );
}
