import type { KeyboardEvent } from "react";

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = "md",
  full,
  label,
}: {
  value: T;
  options: { value: T; label: string; activeClass?: string }[];
  onChange: (value: T) => void;
  size?: "sm" | "md";
  /** Stretch to the container, options sharing the width. */
  full?: boolean;
  /** Names the group for screen readers when no visible label does. */
  label?: string;
}) {
  // A radio group moves with the arrow keys and keeps a single tab stop.
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (step === 0) {
      return;
    }
    event.preventDefault();
    const index = options.findIndex((option) => option.value === value);
    const next = options[(index + step + options.length) % options.length];
    onChange(next.value);
    const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=radio]");
    buttons[options.indexOf(next)]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={`segmented scroll-quiet max-w-full overflow-x-auto rounded-xl bg-surface-2 p-1 ${full ? "flex w-full" : "inline-flex"}`}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            className={`shrink-0 rounded-lg whitespace-nowrap transition-[background-color,color,box-shadow] ${size === "sm" ? "px-3 py-2 text-xs" : "flex-1 px-3.5 py-2 text-sm"} ${
              active
                ? `bg-raised shadow-sm ${option.activeClass ?? "text-accent"}`
                : "text-muted hover:text-foreground"
            }`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
