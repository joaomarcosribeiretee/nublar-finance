import { useState } from "react";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { controlClass, Field, MoneyInput, TextInput } from "@/components/Field";
import { Icon } from "@/components/Icon";
import { FormFooter, Modal } from "@/components/Modal";
import { Money } from "@/components/Money";
import { Segmented } from "@/components/Segmented";
import { ErrorNote, PageHeader, Panel, ProgressBar } from "@/components/Page";
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
  const [filter, setFilter] = useState<"active" | "done" | "all">("active");
  const visible = data?.filter((goal) => filter === "all" || (filter === "done" ? goal.reached : !goal.reached));

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
      {data && data.length > 0 ? <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented label="Estado das metas" value={filter} onChange={setFilter} options={[
          { value: "active", label: `Em andamento (${data.filter((g) => !g.reached).length})` },
          { value: "done", label: `Concluídas (${data.filter((g) => g.reached).length})` },
          { value: "all", label: "Todas" },
        ]} />
      </div> : null}

      {goals.isError ? (
        <ErrorNote>{errorMessage(goals.error)}</ErrorNote>
      ) : data && data.length === 0 ? (
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
      ) : visible?.length === 0 ? (
        <EmptyState icon="target" title={filter === "done" ? "Seus próximos objetivos estão a caminho" : "Nenhuma meta em andamento"} description={filter === "done" ? "As metas atingidas aparecem aqui." : "Crie uma meta para o seu próximo plano."} action={<Button onClick={() => setEditing("new")}>Nova meta</Button>} />
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-4">
          {!data
            ? [0, 1].map((i) => <li key={i} className="skeleton h-44 rounded-3xl" />)
            : visible?.map((goal) => (
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
      className="goal-card flex h-full w-full flex-col rounded-3xl border border-line bg-surface p-6 text-left transition-colors hover:border-line-strong hover:bg-surface-2"
    >
      <span className="flex items-center gap-2 text-sm">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-raised" style={{ color: goal.color }}><Icon name={goal.reached ? "check" : "target"} size={20} /></span>
        <span className="truncate">{goal.name}</span>
        <span className="ml-auto text-xs text-muted tabular">{formatBps(goal.progressBps)}</span>
      </span>
      <span className="mt-6 break-words text-3xl tabular">
        <Money amount={goal.saved} />
      </span>
      <span className="text-xs text-muted">de {formatMinorUnits(goal.target)}</span>
      <span className="mt-3 block">
        <ProgressBar size="md" value={progress} color={goal.color} />
      </span>
      <span className="mt-5 border-t border-line pt-4 text-sm leading-relaxed">
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
    const manualMinor = /^[0.,\s]*$/.test(manual) ? "0" : parseReaisToMinorUnits(manual);
    if (!name.trim()) {
      setError("Dê um nome para a meta.");
      return;
    }
    if (!targetMinor) {
      setError("Informe quanto quer juntar, por exemplo 10.000,00.");
      return;
    }
    if (manualMinor === null) {
      setError("O valor já guardado está inválido. Use algo como 1.500,00.");
      return;
    }
    try {
      await save.mutateAsync({
        id: goal?.id,
        input: {
          name: name.trim(),
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
    `flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${checked ? "border-accent bg-accent text-accent-fg" : "border-line-strong"}`;

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-[1fr_170px]">
        <Field label="Nome">
          <TextInput
            autoFocus
            placeholder="Ex.: Reserva de emergência"
            value={name}
            maxLength={80}
            onChange={setName}
          />
        </Field>
        <Field label="Quanto quer juntar">
          <MoneyInput value={target} onChange={setTarget} />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Até quando (opcional)">
          <input className={controlClass} type="month" value={targetMonth} onChange={(event) => setTargetMonth(event.target.value)} />
        </Field>
        <Field label="Já guardado fora daqui (opcional)">
          <MoneyInput value={manual} onChange={setManual} />
        </Field>
      </div>

      <Panel title="O que conta para esta meta" subtitle="O saldo das contas e o valor dos investimentos marcados entram no progresso." className="!p-4">
        <div className="space-y-1">
          {accounts.data?.length === 0 && (portfolio.data?.items.length ?? 0) === 0 ? (
            <p className="text-sm text-faint">Nenhuma conta ou investimento cadastrado ainda.</p>
          ) : null}
          {accounts.data?.map((account) => (
            <label key={account.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm has-focus-visible:outline-2 has-focus-visible:outline-(--focus-ring) hover:bg-hover">
              <input
                type="checkbox"
                className="sr-only"
                checked={accountIds.includes(account.id)}
                onChange={() => setAccountIds((list) => toggle(list, account.id))}
              />
              <span className={checkbox(accountIds.includes(account.id))}>
                {accountIds.includes(account.id) ? <Icon name="check" size={11} /> : null}
              </span>
              <span className="min-w-0 flex-1 truncate">{account.label}</span>
              <Money amount={account.balance} className="text-xs text-muted" />
            </label>
          ))}
          {portfolio.data?.items.map((investment) => (
            <label key={investment.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm has-focus-visible:outline-2 has-focus-visible:outline-(--focus-ring) hover:bg-hover">
              <input
                type="checkbox"
                className="sr-only"
                checked={investmentIds.includes(investment.id)}
                onChange={() => setInvestmentIds((list) => toggle(list, investment.id))}
              />
              <span className={checkbox(investmentIds.includes(investment.id))}>
                {investmentIds.includes(investment.id) ? <Icon name="check" size={11} /> : null}
              </span>
              <span className="min-w-0 flex-1 truncate">
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

      <FormFooter error={error}>
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
          {save.isPending ? "Salvando…" : "Salvar"}
        </Button>
      </FormFooter>
    </form>
  );
}
