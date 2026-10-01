import type { ReactNode } from "react";

export function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1.5 text-left text-xs text-muted ${className}`}>
      <span className="tracking-wide">{label}</span>
      {children}
    </label>
  );
}

export const controlClass =
  "h-10 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-foreground outline-none transition-colors placeholder:text-faint hover:border-line-strong focus:border-gold/60 focus-visible:outline-none";
