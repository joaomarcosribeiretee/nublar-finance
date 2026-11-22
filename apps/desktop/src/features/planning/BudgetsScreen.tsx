import { useState } from "react";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { controlClass, Field, MoneyInput } from "@/components/Field";
import { Icon } from "@/components/Icon";
import { FormFooter, Modal } from "@/components/Modal";
import { Money } from "@/components/Money";
import { Segmented } from "@/components/Segmented";
import { ErrorNote, PageHeader, Panel, ProgressBar } from "@/components/Page";
import { useToast } from "@/components/Toast";
import { errorMessage } from "@/lib/api";
import { formatBps } from "@/lib/chart";
import { monthLabel } from "@/lib/dates";
import { formatMinorUnits, minorUnitsToInput, parseReaisToMinorUnits } from "@/lib/money";
import {
  useAnalytics,
  useBudgets,
  useCategories,
  useDeleteBudget,
  useSaveBudget,
  type Budgets,
} from "@/lib/queries";
import { budgetTone, monthProgress } from "./BudgetOverview";

const tone = budgetTone;

type Item = Budgets["items"][number];

export function BudgetsScreen({ month }: { month: string }) {
  const budgets = useBudgets(month);
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const data = budgets.data;
  const pace = monthProgress(month);
  const [filter, setFilter] = useState<"all" | "attention">("all");
  const visible = data?.items.filter((item) => filter === "all" || item.status !== "OK");

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

      {budgets.isError ? (
        <ErrorNote>{errorMessage(budgets.error)}</ErrorNote>
      ) : data && data.items.length === 0 ? (
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
          <Panel className="budget-overview">
            {!data ? (
              <div className="skeleton h-16" />
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
                  <div>
                    <p className="text-xs text-muted">Gasto nas categorias com orçamento</p>
                    <p className="mt-1 text-xl @2xl:text-2xl">
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
                {data.totals.usedBps <= 10000 ? <ProgressBar
                  size="md"
                  value={data.totals.usedBps / 100}
                  tone={tone[data.totals.status]}
                  marker={pace}
                  markerTitle="Quanto do mês já passou"
                /> : null}
                <p className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-faint">
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

          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-medium">Por categoria</h2>
            <Segmented size="sm" label="Estado do orçamento" value={filter} onChange={setFilter} options={[{ value: "all", label: "Todos" }, { value: "attention", label: "Perto ou acima do limite" }]} />
          </div>
          {visible?.length === 0 ? <EmptyState icon="check" title="Tudo dentro dos limites" description="Nenhuma categoria está perto ou acima do orçamento." /> : null}
            <ul className="grid gap-4 @2xl:grid-cols-2">
              {!data
                ? [0, 1, 2].map((i) => <li key={i} className="skeleton m-3 h-12" />)
                : visible?.map((item) => (
                    <li key={item.id} className="min-w-0">
                      <button
                        type="button"
                        onClick={() => setEditing(item)}
                        className="budget-card flex h-full w-full flex-col gap-4 rounded-2xl border border-line bg-surface p-5 text-left transition-colors hover:border-line-strong hover:bg-surface-2"
                      >
                        <span className="flex w-full flex-wrap items-baseline justify-between gap-3 text-sm">
                          <span className="font-medium">{item.category.name}</span>
                          <span className="text-lg tabular">
                            <Money amount={item.spent} />
                            <span className="block text-xs text-muted"> de {formatMinorUnits(item.limit)}</span>
                          </span>
                        </span>
                        {item.usedBps <= 10000 ? <div className="w-full"><ProgressBar value={item.usedBps / 100} tone={tone[item.status]} marker={pace} /></div> : null}
                        <span className="flex w-full flex-wrap justify-between gap-x-4 gap-y-1 text-xs">
                          <span className={item.status === "OVER" ? "text-negative" : item.status === "WARNING" ? "text-warning" : "text-faint"}>
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
    if (!categoryId) {
      setError("Escolha a categoria.");
      return;
    }
    if (!minor) {
      setError("Informe o limite, por exemplo 800,00.");
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
        <MoneyInput autoFocus value={amount} onChange={setAmount} />
        {average && BigInt(average) > 0n ? (
          <button
            type="button"
            className="self-start py-1 text-left text-xs text-gold hover:underline"
            onClick={() => setAmount(minorUnitsToInput(average))}
          >
            Média dos últimos meses: {formatMinorUnits(average)}. Usar esse valor
          </button>
        ) : null}
      </Field>
      <FormFooter error={error}>
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
          {save.isPending ? "Salvando…" : "Salvar"}
        </Button>
      </FormFooter>
    </form>
  );
}
