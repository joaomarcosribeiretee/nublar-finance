import type { ButtonHTMLAttributes } from "react";

const variants = {
  primary:
    "bg-gold text-background hover:brightness-110 active:brightness-95 font-medium",
  secondary:
    "border border-line-strong bg-surface-2 text-foreground hover:bg-raised",
  ghost: "text-muted hover:bg-white/5 hover:text-foreground",
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
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
