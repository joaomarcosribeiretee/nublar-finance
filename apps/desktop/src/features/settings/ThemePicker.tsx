import type { KeyboardEvent } from "react";
import type { Theme } from "@nublar/validation";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/Icon";
import type { TranslationKey } from "@/i18n";

const options: { value: Theme; label: TranslationKey; hint: TranslationKey }[] = [
  { value: "DARK", label: "settings.appearance.dark", hint: "settings.appearance.darkHint" },
  { value: "LIGHT", label: "settings.appearance.light", hint: "settings.appearance.lightHint" },
  { value: "SYSTEM", label: "settings.appearance.system", hint: "settings.appearance.systemHint" },
];

/**
 * Three cards, each a miniature of the app in that theme. The preview sets
 * its own data-theme, so it always shows the real tokens of that palette.
 */
export function ThemePicker({ value, onChange }: { value: Theme; onChange: (theme: Theme) => void }) {
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
    const index = options.findIndex((option) => option.value === value);
    const nextIndex = (index + step + options.length) % options.length;
    onChange(options[nextIndex].value);
    event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=radio]")[nextIndex]?.focus();
  }

  return (
    <div role="radiogroup" aria-label={t("settings.appearance.theme")} onKeyDown={onKeyDown} className="grid grid-cols-3 gap-3">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => !active && onChange(option.value)}
            className={`group min-w-0 rounded-2xl border p-2 text-left transition-[border-color,background-color] ${
              active ? "border-accent bg-surface-2" : "border-line hover:border-line-strong hover:bg-hover"
            }`}
          >
            <div className="flex h-20 overflow-hidden rounded-xl border border-line" aria-hidden="true">
              {option.value === "SYSTEM" ? (
                <>
                  <Preview theme="dark" className="w-1/2" />
                  <Preview theme="light" className="w-1/2" />
                </>
              ) : (
                <Preview theme={option.value === "LIGHT" ? "light" : "dark"} className="w-full" />
              )}
            </div>
            <div className="mt-2.5 flex items-start justify-between gap-2 px-1 pb-0.5">
              <div className="min-w-0">
                <p className="text-sm">{t(option.label)}</p>
                <p className="mt-0.5 truncate text-xs text-muted">{t(option.hint)}</p>
              </div>
              <span
                className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border transition-colors ${
                  active ? "border-accent bg-accent text-accent-fg" : "border-line-strong"
                }`}
              >
                {active ? <Icon name="check" size={10} /> : null}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/** A miniature app window: sidebar, a panel with a figure and a small chart. */
function Preview({ theme, className }: { theme: "dark" | "light"; className: string }) {
  return (
    <div data-theme={theme} className={`flex gap-1.5 bg-background p-1.5 ${className}`}>
      <div className="flex w-1/5 min-w-3 flex-col gap-1 rounded-md bg-surface p-1">
        <span className="h-1 rounded-full bg-accent" />
        <span className="h-1 rounded-full bg-line-strong" />
        <span className="h-1 rounded-full bg-line-strong" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between rounded-md border border-line bg-surface p-1.5">
        <div className="flex flex-col gap-1">
          <span className="h-1 w-1/3 rounded-full bg-muted" />
          <span className="h-1.5 w-1/2 rounded-full bg-foreground" />
        </div>
        <div className="flex h-5 items-end gap-0.5">
          {[50, 80, 35, 100, 65].map((height, i) => (
            <span
              key={i}
              className="flex-1 rounded-t-[2px] bg-(--series-1)"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
