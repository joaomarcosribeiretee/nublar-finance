import type { ReactNode } from "react";

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
    <header className="flex items-end justify-between gap-6">
      <div className="min-w-0">
        {eyebrow ? <p className="text-sm text-muted">{eyebrow}</p> : null}
        <h1 className="mt-1 font-display text-3xl tracking-tight">{title}</h1>
        {children ? <div className="mt-2 text-sm text-faint">{children}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
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
    <article className={`rounded-3xl border border-line bg-surface ${flush ? "p-3" : "p-5"} ${className}`}>
      {title || actions ? (
        <header className={`flex items-start justify-between gap-4 ${flush ? "px-3 pt-2 pb-3" : "mb-4"}`}>
          <div className="min-w-0">
            {title ? <h2 className="text-sm">{title}</h2> : null}
            {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </article>
  );
}

/** Thin progress bar; the color carries status, the label carries meaning. */
export function ProgressBar({
  value,
  tone = "gold",
  marker,
}: {
  /** 0–100 (clamped). */
  value: number;
  tone?: "gold" | "positive" | "warning" | "negative" | "series";
  /** Optional thin marker, e.g. where the month is today. */
  marker?: number;
}) {
  const colors = {
    gold: "var(--gold)",
    positive: "var(--positive)",
    warning: "var(--series-4)",
    negative: "var(--negative)",
    series: "var(--series-1)",
  };
  return (
    <div className="relative h-1.5 rounded-full bg-surface-2">
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${Math.min(Math.max(value, value > 0 ? 1.5 : 0), 100)}%`, background: colors[tone] }}
      />
      {marker !== undefined ? (
        <span
          className="absolute -top-1 h-3.5 w-0.5 rounded-full bg-foreground/60"
          style={{ left: `calc(${Math.min(Math.max(marker, 0), 100)}% - 1px)` }}
        />
      ) : null}
    </div>
  );
}
