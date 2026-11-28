import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/Button";
import { controlClass, Field, MoneyInput } from "@/components/Field";
import { FormFooter } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { errorMessage } from "@/lib/api";
import { todayLocal } from "@/lib/dates";
import { assetClassLabels } from "@/lib/labels";
import { minorUnitsToInput, parseReaisToMinorUnits } from "@/lib/money";
import { useAddValuations, type InvestmentItem } from "@/lib/queries";
import { formatDate } from "@/lib/format";

/**
 * The monthly check-in: open the bank app, copy each value, done.
 * Only the values that changed are saved.
 */
export function BulkValuations({ items, onDone }: { items: InvestmentItem[]; onDone: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const save = useAddValuations();
  const [date, setDate] = useState(todayLocal());
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((item) => [item.id, minorUnitsToInput(item.current)])),
  );
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const changed: { investmentId: string; value: string }[] = [];
    for (const item of items) {
      const raw = values[item.id]?.trim() ?? "";
      const minor = /^[0.,\s]*$/.test(raw) ? "0" : parseReaisToMinorUnits(raw);
      if (minor === null) {
        setError(t("investments.bulk.invalid", { name: item.name }));
        return;
      }
      if (minor !== item.current) {
        changed.push({ investmentId: item.id, value: minor });
      }
    }
    if (changed.length === 0) {
      onDone();
      return;
    }
    try {
      await save.mutateAsync({ date, items: changed });
      toast(t("investments.bulk.updated", { count: changed.length }));
      onDone();
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <p className="text-sm text-muted">
        {t("investments.bulk.intro")}
      </p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 py-1.5">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{item.name}</span>
              <span className="block truncate text-xs text-faint">
                {item.institution?.name ? `${item.institution.name} · ` : ""}
                {t(assetClassLabels[item.assetClass])}
                {item.lastValuation ? ` · ${t("investments.bulk.updatedOn", { date: formatDate(item.lastValuation) })}` : ""}
              </span>
            </span>
            <div className="relative w-36 shrink-0 sm:w-40">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-faint">{t("common.money.symbol")}</span>
              <MoneyInput
                aria-label={t("investments.bulk.currentValueOf", { name: item.name })}
                className={`${controlClass} tabular pl-9 text-right`}
                value={values[item.id] ?? ""}
                onChange={(value) => setValues((current) => ({ ...current, [item.id]: value }))}
                onFocus={(event) => event.target.select()}
              />
            </div>
          </li>
        ))}
      </ul>
      <FormFooter error={error}>
        <Field label={t("investments.bulk.date")} className="w-40">
          <input
            className={controlClass}
            type="date"
            value={date}
            max={todayLocal()}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </Field>
        <div className="flex-1" />
        <div className="flex gap-2 self-end">
          <Button variant="ghost" onClick={onDone}>
            {t("common.actions.cancel")}
          </Button>
          <Button variant="primary" type="submit" disabled={save.isPending}>
            {save.isPending ? t("common.save.saving") : t("investments.bulk.submit")}
          </Button>
        </div>
      </FormFooter>
    </form>
  );
}
