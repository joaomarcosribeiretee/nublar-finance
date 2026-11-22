import type { ButtonHTMLAttributes } from "react";

const variants = {
  primary:
    "bg-gold text-background hover:brightness-110 active:brightness-95 font-medium",
  secondary:
    "border border-line-strong bg-surface-2 text-foreground hover:bg-raised",
  ghost: "text-muted hover:bg-hover hover:text-foreground",
  danger: "text-negative hover:bg-negative/10",
  dangerSolid: "bg-negative text-background font-medium hover:brightness-110",
} as const;

export function Button({
  variant = "secondary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
}) {
  return (
    <button
      type={type}
      className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm whitespace-nowrap transition-[background-color,border-color,color,filter,scale] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

/** Square icon-only action; the label is required because nothing else names it. */
export function IconButton({
  label,
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-foreground disabled:pointer-events-none disabled:opacity-40 ${className}`}
      {...props}
    />
  );
}
