import { useState } from "react";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { controlClass, Field } from "@/components/Field";
import { Icon } from "@/components/Icon";
import { Modal } from "@/components/Modal";
import { Money } from "@/components/Money";
import { PageHeader, Panel } from "@/components/Page";
import { useToast } from "@/components/Toast";
import { errorMessage } from "@/lib/api";
import { formatBps } from "@/lib/chart";
import { monthLabel } from "@/lib/dates";
import { institutionColors } from "@/lib/institutions";
import { formatMinorUnits, minorUnitsToInput, parseReaisToMinorUnits } from "@/lib/money";
import {
  useAccounts,
  useDeleteGoal,
  useGoals,
  usePortfolio,
  useSaveGoal,
  type Goal,
} from "@/lib/queries";
import { ColorPicker } from "@/features/institutions/InstitutionForm";

export function GoalsScreen() {
  const goals = useGoals();
  const [editing, setEditing] = useState<Goal | "new" | null>(null);
  const data = goals.data;

  return (
    <section className="animate-enter space-y-6">
      <PageHeader
        eyebrow="Reserva, viagem, entrada do carro"
        title="Metas"
        actions={
          <Button variant="primary" onClick={() => setEditing("new")}>
            <Icon name="plus" size={16} />
            Nova meta
          </Button>
        }
      >
        Ligue contas ou investimentos a uma meta e o progresso se atualiza sozinho.
      </PageHeader>

      {goals.isError ? <p className="text-sm text-negative">{errorMessage(goals.error)}</p> : null}

      {data && data.length === 0 ? (
        <EmptyState
          icon="target"
          title="Nenhuma meta"
          description="Diga quanto quer juntar e até quando. O Nublar mostra quanto guardar por mês."
          action={
            <Button variant="primary" onClick={() => setEditing("new")}>
              Criar meta
            </Button>
          }
        />
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
          {!data
            ? [0, 1].map((i) => <li key={i} className="skeleton h-44 rounded-3xl" />)
            : data.map((goal) => (
                <li key={goal.id}>
                  <GoalCard goal={goal} onOpen={() => setEditing(goal)} />
                </li>
              ))}
        </ul>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Nova meta" : editing ? editing.name : ""}
        width={560}
      >
        {editing ? <GoalForm goal={editing === "new" ? null : editing} onDone={() => setEditing(null)} /> : null}
      </Modal>
    </section>
  );
}

function GoalCard({ goal, onOpen }: { goal: Goal; onOpen: () => void }) {
  const progress = goal.progressBps / 100;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-full w-full flex-col rounded-3xl border border-line bg-surface p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-line-strong"
    >
      <span className="flex items-center gap-2 text-sm">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: goal.color }} />
        <span className="truncate">{goal.name}</span>
        <span className="ml-auto text-xs text-muted tabular">{formatBps(goal.progressBps)}</span>
      </span>
      <span className="mt-4 text-2xl">
        <Money amount={goal.saved} />
      </span>
      <span className="text-xs text-muted">de {formatMinorUnits(goal.target)}</span>
      <span className="mt-3 block h-2 overflow-hidden rounded-full bg-surface-2">
        <span
          className="block h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${Math.max(progress, progress > 0 ? 2 : 0)}%`, background: goal.color }}
        />
      </span>
      <span className="mt-3 text-xs">
        {goal.reached ? (
          <span className="text-positive">Meta atingida</span>
        ) : goal.late ? (
          <span className="text-negative">Prazo passou · faltam {formatMinorUnits(goal.remaining)}</span>
        ) : goal.monthlyNeeded ? (
          <span className="text-muted">
            Guarde <span className="text-foreground">{formatMinorUnits(goal.monthlyNeeded)}</span> por mês até{" "}
            {goal.targetDate ? monthLabel(goal.targetDate.slice(0, 7)).toLowerCase() : ""}
          </span>
        ) : (
          <span className="text-muted">Faltam {formatMinorUnits(goal.remaining)}</span>
        )}
      </span>
    </button>
  );
}

function GoalForm({ goal, onDone }: { goal: Goal | null; onDone: () => void }) {
  const toast = useToast();
  const accounts = useAccounts();
  const portfolio = usePortfolio();
  const save = useSaveGoal();
  const remove = useDeleteGoal();
  const [name, setName] = useState(goal?.name ?? "");
  const [target, setTarget] = useState(goal ? minorUnitsToInput(goal.target) : "");
  const [targetMonth, setTargetMonth] = useState(goal?.targetDate?.slice(0, 7) ?? "");
  const [manual, setManual] = useState(goal && goal.manualSaved !== "0" ? minorUnitsToInput(goal.manualSaved) : "");
  const [color, setColor] = useState(goal?.color ?? institutionColors[0]);
  const [accountIds, setAccountIds] = useState<string[]>(goal?.accountIds ?? []);
  const [investmentIds, setInvestmentIds] = useState<string[]>(goal?.investmentIds ?? []);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const targetMinor = parseReaisToMinorUnits(target);
    const manualMinor = manual.trim() ? parseReaisToMinorUnits(manual) : "0";
    if (!targetMinor || manualMinor === null) {
      setError("Informe o valor da meta.");
      return;
    }
    try {
      await save.mutateAsync({
        id: goal?.id,
        input: {
          name,
          target: targetMinor,
          // The goal is due by the end of the chosen month.
          targetDate: targetMonth ? `${targetMonth}-${new Date(Number(targetMonth.slice(0, 4)), Number(targetMonth.slice(5, 7)), 0).getDate()}` : null,
          manualSaved: manualMinor,
          color,
          accountIds,
          investmentIds,
        },
      });
      toast(goal ? "Meta atualizada" : "Meta criada");
      onDone();
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    }
  }

  async function destroy() {
    if (!goal) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await remove.mutateAsync(goal.id);
      toast("Meta removida");
      onDone();
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    }
  }

  const checkbox = (checked: boolean) =>
    `flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${checked ? "border-gold bg-gold text-background" : "border-line-strong"}`;

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-5">
      <div className="grid grid-cols-[1fr_170px] gap-3">
        <Field label="Nome">
          <input
            autoFocus
            className={controlClass}
            placeholder="Ex.: Reserva de emergência"
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </Field>
        <Field label="Quanto quer juntar">
          <input
            className={`${controlClass} tabular`}
            inputMode="decimal"
            placeholder="0,00"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Até quando (opcional)">
          <input className={controlClass} type="month" value={targetMonth} onChange={(event) => setTargetMonth(event.target.value)} />
        </Field>
        <Field label="Já guardado fora daqui (opcional)">
          <input
            className={`${controlClass} tabular`}
            inputMode="decimal"
            placeholder="0,00"
            value={manual}
            onChange={(event) => setManual(event.target.value)}
          />
        </Field>
      </div>

      <Panel title="O que conta para esta meta" subtitle="O saldo das contas e o valor dos investimentos marcados entram no progresso." className="!p-4">
        <div className="max-h-52 space-y-1 overflow-y-auto">
          {accounts.data?.map((account) => (
            <label key={account.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-white/[0.03]">
              <input
                type="checkbox"
                className="sr-only"
                checked={accountIds.includes(account.id)}
                onChange={() => setAccountIds((list) => toggle(list, account.id))}
              />
              <span className={checkbox(accountIds.includes(account.id))}>
                {accountIds.includes(account.id) ? <Icon name="check" size={11} /> : null}
              </span>
              <span className="flex-1 truncate">{account.label}</span>
              <Money amount={account.balance} className="text-xs text-muted" />
            </label>
          ))}
          {portfolio.data?.items.map((investment) => (
            <label key={investment.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-white/[0.03]">
              <input
                type="checkbox"
                className="sr-only"
                checked={investmentIds.includes(investment.id)}
                onChange={() => setInvestmentIds((list) => toggle(list, investment.id))}
              />
              <span className={checkbox(investmentIds.includes(investment.id))}>
                {investmentIds.includes(investment.id) ? <Icon name="check" size={11} /> : null}
              </span>
              <span className="flex-1 truncate">
                {investment.name}
                <span className="text-faint"> · investimento</span>
              </span>
              <Money amount={investment.current} className="text-xs text-muted" />
            </label>
          ))}
        </div>
      </Panel>

      <Field label="Cor">
        <ColorPicker value={color} onChange={setColor} />
      </Field>

      {error ? <p className="text-sm text-negative">{error}</p> : null}
      <footer className="flex items-center gap-2">
        {goal ? (
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
