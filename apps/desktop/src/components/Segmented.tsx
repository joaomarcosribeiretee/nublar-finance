export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = "md",
}: {
  value: T;
  options: { value: T; label: string; activeClass?: string }[];
  onChange: (value: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="radiogroup"
      className="inline-flex rounded-xl border border-line bg-surface-2 p-1"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            className={`rounded-lg transition-all duration-150 ${size === "sm" ? "px-2.5 py-1 text-xs" : "flex-1 px-3.5 py-1.5 text-sm"} ${
              active
                ? `bg-raised shadow-sm ${option.activeClass ?? "text-foreground"}`
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
