import { useState } from "react";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { controlClass, Field } from "@/components/Field";
import { Icon } from "@/components/Icon";
import { Modal } from "@/components/Modal";
import { Money } from "@/components/Money";
import { PageHeader, Panel, ProgressBar } from "@/components/Page";
import { useToast } from "@/components/Toast";
import { errorMessage } from "@/lib/api";
import { formatBps } from "@/lib/chart";
import { currentMonth, monthLabel, todayLocal } from "@/lib/dates";
import { formatMinorUnits, minorUnitsToInput, parseReaisToMinorUnits } from "@/lib/money";
import {
  useAnalytics,
  useBudgets,
  useCategories,
  useDeleteBudget,
  useSaveBudget,
  type BudgetStatus,
  type Budgets,
} from "@/lib/queries";

const tone: Record<BudgetStatus, "positive" | "warning" | "negative"> = {
  OK: "positive",
  WARNING: "warning",
  OVER: "negative",
};

/** Where in the month we are, 0–100, to compare spending against time. */
function monthProgress(month: string): number | undefined {
  if (month !== currentMonth()) return undefined;
  const today = todayLocal();
  const [year, monthNumber] = month.split("-").map(Number);
  const days = new Date(year, monthNumber, 0).getDate();
  return (Number(today.slice(8, 10)) / days) * 100;
}

type Item = Budgets["items"][number];

export function BudgetsScreen({ month }: { month: string }) {
  const budgets = useBudgets(month);
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const data = budgets.data;
  const pace = monthProgress(month);

  return (
    <section className="animate-enter space-y-6">
      <PageHeader
        eyebrow={monthLabel(month)}
        title="Orçamentos"
        actions={
          <Button variant="primary" onClick={() => setEditing("new")}>
            <Icon name="plus" size={16} />
            Novo orçamento
          </Button>
        }
      >
        Um limite por categoria, o mesmo todo mês. Compras no cartão contam no mês da fatura.
      </PageHeader>

      {budgets.isError ? <p className="text-sm text-negative">{errorMessage(budgets.error)}</p> : null}

      {data && data.items.length === 0 ? (
        <EmptyState
          icon="gauge"
          title="Nenhum orçamento"
          description="Defina quanto quer gastar por mês em mercado, restaurantes, lazer… e acompanhe o quanto já foi."
          action={
            <Button variant="primary" onClick={() => setEditing("new")}>
              Criar orçamento
            </Button>
          }
        />
      ) : (
        <>
          <Panel>
            {!data ? (
              <div className="skeleton h-16" />
            ) : (
              <div className="space-y-3">
                <div className="flex items-end justify-between gap-6">
                  <div>
                    <p className="text-xs text-muted">Gasto nas categorias com orçamento</p>
                    <p className="mt-1 text-2xl">
                      <Money amount={data.totals.spent} />{" "}
                      <span className="text-base text-muted">de {formatMinorUnits(data.totals.limit)}</span>
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    {BigInt(data.totals.remaining) >= 0n ? (
                      <span className="text-muted">
                        Restam <Money amount={data.totals.remaining} className="text-foreground" />
                      </span>
                    ) : (
                      <span className="text-negative">
                        Passou <Money amount={data.totals.remaining.replace("-", "")} />
                      </span>
                    )}
                  </div>
                </div>
                <ProgressBar value={data.totals.usedBps / 100} tone={tone[data.totals.status]} marker={pace} />
                <p className="flex justify-between text-xs text-faint">
                  <span>{pace !== undefined ? "A marca mostra quanto do mês já passou." : " "}</span>
                  {BigInt(data.totals.unbudgeted) > 0n ? (
                    <span>
                      Fora dos orçamentos: <Money amount={data.totals.unbudgeted} />
                    </span>
                  ) : null}
                </p>
              </div>
            )}
          </Panel>

          <Panel flush>
            <ul>
              {!data
                ? [0, 1, 2].map((i) => <li key={i} className="skeleton m-3 h-12" />)
                : data.items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setEditing(item)}
                        className="w-full space-y-2 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-white/[0.035]"
                      >
                        <span className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="truncate">{item.category.name}</span>
                          <span className="shrink-0">
                            <Money amount={item.spent} />
                            <span className="text-muted"> de {formatMinorUnits(item.limit)}</span>
                          </span>
                        </span>
                        <ProgressBar value={item.usedBps / 100} tone={tone[item.status]} marker={pace} />
                        <span className="flex justify-between text-xs">
                          <span className={item.status === "OVER" ? "text-negative" : item.status === "WARNING" ? "text-[var(--series-4)]" : "text-faint"}>
                            {item.status === "OVER"
                              ? `Passou ${formatMinorUnits(item.remaining.replace("-", ""))}`
                              : `${formatBps(item.usedBps)} usado · restam ${formatMinorUnits(item.remaining)}`}
                          </span>
                          {BigInt(item.scheduled) > 0n ? (
                            <span className="text-faint">+ {formatMinorUnits(item.scheduled)} previsto</span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  ))}
            </ul>
          </Panel>
        </>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Novo orçamento" : editing ? editing.category.name : ""}
      >
        {editing ? (
          <BudgetForm
            item={editing === "new" ? null : editing}
            month={month}
            taken={new Set(data?.items.map((i) => i.category.id))}
            onDone={() => setEditing(null)}
          />
        ) : null}
      </Modal>
    </section>
  );
}

function BudgetForm({
  item,
  month,
  taken,
  onDone,
}: {
  item: Item | null;
  month: string;
  taken: Set<string>;
  onDone: () => void;
}) {
  const toast = useToast();
  const categories = useCategories();
  const analytics = useAnalytics(month, 6);
  const save = useSaveBudget();
  const remove = useDeleteBudget();
  const [categoryId, setCategoryId] = useState(item?.category.id ?? "");
  const [amount, setAmount] = useState(item ? minorUnitsToInput(item.limit) : "");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const options = (categories.data ?? []).filter(
    (c) => c.kind === "EXPENSE" && (!taken.has(c.id) || c.id === item?.category.id),
  );
  const average = analytics.data?.categories.find((c) => c.categoryId === categoryId)?.average;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const minor = parseReaisToMinorUnits(amount);
    if (!categoryId || !minor) {
      setError("Escolha a categoria e o limite.");
      return;
    }
    try {
      await save.mutateAsync({ categoryId, amount: minor });
      toast("Orçamento salvo");
      onDone();
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    }
  }

  async function destroy() {
    if (!item) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await remove.mutateAsync(item.id);
      toast("Orçamento removido");
      onDone();
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-5">
      {item ? null : (
        <Field label="Categoria">
          <select className={controlClass} value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">Escolha…</option>
            {options.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Limite por mês">
        <input
          autoFocus
          className={`${controlClass} tabular`}
          inputMode="decimal"
          placeholder="0,00"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
        {average && BigInt(average) > 0n ? (
          <button
            type="button"
            className="self-start text-[11px] text-gold hover:underline"
            onClick={() => setAmount(minorUnitsToInput(average))}
          >
            Média dos últimos meses: {formatMinorUnits(average)}. Usar esse valor
          </button>
        ) : null}
      </Field>
      {error ? <p className="text-sm text-negative">{error}</p> : null}
      <footer className="flex items-center gap-2">
        {item ? (
          <Button
            variant={confirmDelete ? "dangerSolid" : "danger"}
            onClick={() => void destroy()}
            onBlur={() => setConfirmDelete(false)}
            disabled={remove.isPending}
          >
            {confirmDelete ? "Confirmar" : "Remover"}
          </Button>
        ) : null}
        <div className="flex-1" />
        <Button variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button variant="primary" type="submit" disabled={save.isPending}>
          Salvar
        </Button>
      </footer>
    </form>
  );
}
