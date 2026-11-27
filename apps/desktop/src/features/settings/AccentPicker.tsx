import type { KeyboardEvent } from "react";
import type { Accent } from "@nublar/validation";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/Icon";
import type { TranslationKey } from "@/i18n";
import { ACCENTS, accentAttribute } from "@/lib/preferences";

const labels: Record<Accent, TranslationKey> = {
  GOLD: "settings.appearance.accents.gold",
  GREEN: "settings.appearance.accents.green",
  BLUE: "settings.appearance.accents.blue",
  VIOLET: "settings.appearance.accents.violet",
  ROSE: "settings.appearance.accents.rose",
};

/**
 * Five round swatches. Each sets its own data-accent, so it shows the step
 * of that color for the current theme, exactly as the app will use it.
 */
export function AccentPicker({ value, onChange }: { value: Accent; onChange: (accent: Accent) => void }) {
  const { t } = useTranslation();
  // A radio group moves with the arrow keys and keeps a single tab stop.
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (step === 0) {
      return;
    }
    event.preventDefault();
    const index = ACCENTS.indexOf(value);
    const nextIndex = (index + step + ACCENTS.length) % ACCENTS.length;
    onChange(ACCENTS[nextIndex]);
    event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=radio]")[nextIndex]?.focus();
  }

  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-line pt-4">
      <div className="min-w-0">
        <p className="text-sm">{t("settings.appearance.accent")}</p>
        <p className="mt-0.5 text-xs text-muted">{t(labels[value])}</p>
      </div>
      <div role="radiogroup" aria-label={t("settings.appearance.accent")} onKeyDown={onKeyDown} className="flex gap-2">
        {ACCENTS.map((accent) => {
          const active = accent === value;
          return (
            <button
              key={accent}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={t(labels[accent])}
              title={t(labels[accent])}
              tabIndex={active ? 0 : -1}
              onClick={() => !active && onChange(accent)}
              className={`grid size-9 place-items-center rounded-full border-2 transition-colors ${
                active ? "border-foreground" : "border-transparent hover:border-line-strong"
              }`}
            >
              <span
                data-accent={accentAttribute(accent)}
                className="grid size-7 place-items-center rounded-full bg-accent text-accent-fg"
              >
                {active ? <Icon name="check" size={14} /> : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
