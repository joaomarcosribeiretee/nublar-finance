import { useState } from "react";
import { Button } from "@/components/Button";
import { controlClass, Field } from "@/components/Field";
import { useToast } from "@/components/Toast";
import { errorMessage } from "@/lib/api";
import { shortDate, todayLocal } from "@/lib/dates";
import { assetClassLabels } from "@/lib/labels";
import { minorUnitsToInput, parseReaisToMinorUnits } from "@/lib/money";
import { useAddValuations, type InvestmentItem } from "@/lib/queries";

/**
 * The monthly check-in: open the bank app, copy each value, done.
 * Only the values that changed are saved.
 */
export function BulkValuations({ items, onDone }: { items: InvestmentItem[]; onDone: () => void }) {
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
        setError(`Valor inválido em ${item.name}.`);
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
      toast(`${changed.length} ${changed.length === 1 ? "valor atualizado" : "valores atualizados"}`);
      onDone();
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <p className="text-sm text-muted">
        Copie o valor atual de cada aplicação do app do banco. Só o que mudou é salvo.
      </p>
      <ul className="max-h-[50vh] space-y-1 overflow-y-auto pr-1">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{item.name}</span>
              <span className="block truncate text-xs text-faint">
                {item.institution?.name ? `${item.institution.name} · ` : ""}
                {assetClassLabels[item.assetClass]}
                {item.lastValuation ? ` · atualizado ${shortDate(item.lastValuation)}` : ""}
              </span>
            </span>
            <div className="relative w-40">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-faint">R$</span>
              <input
                className={`${controlClass} tabular pl-9 text-right`}
                inputMode="decimal"
                value={values[item.id] ?? ""}
                onChange={(event) => setValues((current) => ({ ...current, [item.id]: event.target.value }))}
                onFocus={(event) => event.target.select()}
              />
            </div>
          </li>
        ))}
      </ul>
      <div className="flex items-end justify-between gap-3 border-t border-line pt-4">
        <Field label="Valores de" className="w-44">
          <input
            className={controlClass}
            type="date"
            value={date}
            max={todayLocal()}
            onChange={(event) => setDate(event.target.value)}
          />
        </Field>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onDone}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" disabled={save.isPending}>
            Salvar valores
          </Button>
        </div>
      </div>
      {error ? <p className="text-sm text-negative">{error}</p> : null}
    </form>
  );
}
