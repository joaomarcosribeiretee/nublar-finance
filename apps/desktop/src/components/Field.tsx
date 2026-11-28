import { useEffect, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { numberSeparators } from "@/lib/format";
import { clampInteger, sanitizeDecimal, sanitizeInteger, sanitizeMoney, sanitizeText } from "@/lib/input";

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
    <label className={`flex min-w-0 flex-col gap-1.5 text-left text-xs text-muted ${className}`}>
      <span className="tracking-wide">{label}</span>
      {children}
    </label>
  );
}

/** 16px on phones keeps iOS from zooming the page when a field gets focus. */
export const controlClass =
  "form-control h-11 w-full min-w-0 rounded-xl border border-line-strong bg-surface-2 px-3 text-base text-foreground outline-none transition-colors placeholder:text-faint hover:border-line-strong focus:border-accent/60 focus-visible:outline-none disabled:opacity-60 sm:text-sm";

type TextProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: string;
  onChange: (value: string) => void;
};

/** Free text (names, descriptions) without control characters or markup. */
export function TextInput({ value, onChange, className = controlClass, ...props }: TextProps) {
  return (
    <input
      {...props}
      type="text"
      className={className}
      value={value}
      onChange={(event) => onChange(sanitizeText(event.target.value))}
    />
  );
}

/** Reais: digits, thousands separators and one decimal separator with two cents, in the language shown. */
export function MoneyInput({
  value,
  onChange,
  signed,
  className = `${controlClass} tabular`,
  placeholder,
  ...props
}: TextProps & { signed?: boolean }) {
  return (
    <input
      {...props}
      type="text"
      // The numeric keypad has no minus key on phones.
      inputMode={signed ? "text" : "decimal"}
      autoComplete="off"
      placeholder={placeholder ?? `0${numberSeparators().decimal}00`}
      className={className}
      value={value}
      onChange={(event) => onChange(sanitizeMoney(event.target.value, { signed }))}
    />
  );
}

/** A number with one decimal separator: a rate, a quantity. */
export function DecimalInput({
  value,
  onChange,
  decimals = 2,
  wholeDigits,
  className = `${controlClass} tabular`,
  ...props
}: TextProps & { decimals?: number; wholeDigits?: number }) {
  return (
    <input
      {...props}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      className={className}
      value={value}
      onChange={(event) => onChange(sanitizeDecimal(event.target.value, decimals, wholeDigits))}
    />
  );
}

/**
 * Whole number within a range. Typing is free (so "12" is not clamped at its
 * first digit); the range is enforced when the field loses focus.
 */
export function IntegerInput({
  value,
  onChange,
  min,
  max,
  className = `${controlClass} tabular`,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "min" | "max"> & {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
}) {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText((current) => (clampInteger(current, min, max) === value ? current : String(value)));
  }, [value, min, max]);

  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      className={className}
      value={text}
      onChange={(event) => {
        const next = sanitizeInteger(event.target.value, String(max).length);
        setText(next);
        onChange(clampInteger(next, min, max));
      }}
      onBlur={(event) => {
        setText(String(clampInteger(text, min, max)));
        props.onBlur?.(event);
      }}
    />
  );
}
