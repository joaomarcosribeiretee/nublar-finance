import { useState } from "react";
import { Field } from "@/components/Field";
import type { Category, CategoryKind } from "@/lib/queries";

/** How many chips show before "Mais"; the rest stays one click away. */
const VISIBLE = 12;

/**
 * Category picker as chips. With many categories the most used come first
 * and the rest fold behind "Mais", so the form stays short.
 */
export function CategoryChips({
  kind,
  categories,
  value,
  onChange,
}: {
  kind: CategoryKind;
  categories: Category[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const list = categories
    .filter((category) => category.kind === kind)
    .sort((a, b) => b.usage - a.usage || a.name.localeCompare(b.name, "pt-BR"));
  const visible =
    expanded || list.length <= VISIBLE
      ? list
      : [
          ...list.slice(0, VISIBLE),
          // Keep the chosen one visible even when folded.
          ...list.slice(VISIBLE).filter((category) => category.id === value),
        ];

  return (
    <Field label="Categoria">
      <div className="flex flex-wrap gap-1.5">
        {visible.map((category) => (
          <button
            key={category.id}
            type="button"
            className={`rounded-full border px-3 py-1.5 text-sm transition-all duration-150 ${
              value === category.id
                ? "border-gold/50 bg-gold/15 text-foreground"
                : "border-line text-muted hover:border-line-strong hover:text-foreground"
            }`}
            onClick={() => onChange(category.id)}
          >
            {category.name}
          </button>
        ))}
        {list.length > VISIBLE ? (
          <button
            type="button"
            className="rounded-full px-3 py-1.5 text-sm text-gold transition-colors hover:bg-gold/10"
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? "Menos" : `Mais ${list.length - VISIBLE}`}
          </button>
        ) : null}
      </div>
    </Field>
  );
}
