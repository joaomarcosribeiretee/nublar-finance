import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
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
import { institutionColors } from "@/lib/institutions";
import { minorUnitsToInput, parseReaisToMinorUnits } from "@/lib/money";
import { useFormatMoney } from "@/hooks/useHideValues";
import {
  useAccounts,
  useDeleteGoal,
  useGoals,
  usePortfolio,
  useSaveGoal,
  type Goal,
} from "@/lib/queries";
import { ColorPicker } from "@/features/institutions/InstitutionForm";
import { formatMonth, formatPercent } from "@/lib/format";

export function GoalsScreen() {
  const { t } = useTranslation();
  const goals = useGoals();
  const [editing, setEditing] = useState<Goal | "new" | null>(null);
  const data = goals.data;
  const [filter, setFilter] = useState<"active" | "done" | "all">("active");
  const visible = data?.filter((goal) => filter === "all" || (filter === "done" ? goal.reached : !goal.reached));

  return (
    <section className="animate-enter space-y-6">
      <PageHeader
        eyebrow={t("planning.goals.eyebrow")}
        title={t("shell.screens.goals")}
        actions={
          <Button variant="primary" onClick={() => setEditing("new")}>
            <Icon name="plus" size={16} />
            {t("planning.goals.new")}
          </Button>
        }
      >
        {t("planning.goals.intro")}
      </PageHeader>
      {data && data.length > 0 ? <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented label={t("planning.goals.filter.label")} value={filter} onChange={setFilter} options={[
          { value: "active", label: t("planning.goals.filter.active", { count: data.filter((g) => !g.reached).length }) },
          { value: "done", label: t("planning.goals.filter.done", { count: data.filter((g) => g.reached).length }) },
          { value: "all", label: t("planning.goals.filter.all") },
        ]} />
      </div> : null}

      {goals.isError ? (
        <ErrorNote>{errorMessage(goals.error)}</ErrorNote>
      ) : data && data.length === 0 ? (
        <EmptyState
          icon="target"
          title={t("planning.goals.empty.title")}
          description={t("planning.goals.empty.description")}
          action={
            <Button variant="primary" onClick={() => setEditing("new")}>
              {t("planning.goals.empty.action")}
            </Button>
          }
        />
      ) : visible?.length === 0 ? (
        <EmptyState icon="target" title={filter === "done" ? t("planning.goals.noneDone.title") : t("planning.goals.noneActive.title")} description={filter === "done" ? t("planning.goals.noneDone.description") : t("planning.goals.noneActive.description")} action={<Button onClick={() => setEditing("new")}>{t("planning.goals.new")}</Button>} />
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
        title={editing === "new" ? t("planning.goals.new") : editing ? editing.name : ""}
        width={560}
      >
        {editing ? <GoalForm goal={editing === "new" ? null : editing} onDone={() => setEditing(null)} /> : null}
      </Modal>
    </section>
  );
}

function GoalCard({ goal, onOpen }: { goal: Goal; onOpen: () => void }) {
  const { t } = useTranslation();
  const money = useFormatMoney();
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
        <span className="ml-auto text-xs text-muted tabular">{formatPercent(goal.progressBps)}</span>
      </span>
      <span className="mt-6 break-words text-3xl tabular">
        <Money amount={goal.saved} />
      </span>
      <span className="text-xs text-muted">{t("planning.of", { amount: money(goal.target) })}</span>
      <span className="mt-3 block">
        <ProgressBar size="md" value={progress} color={goal.color} />
      </span>
      <span className="mt-5 border-t border-line pt-4 text-sm leading-relaxed">
        {goal.reached ? (
          <span className="text-positive">{t("planning.goals.card.reached")}</span>
        ) : goal.late ? (
          <span className="text-negative">{t("planning.goals.card.late", { amount: money(goal.remaining) })}</span>
        ) : goal.monthlyNeeded ? (
          <span className="text-muted">
            <Trans
              i18nKey="planning.goals.card.monthly"
              values={{ amount: money(goal.monthlyNeeded), month: goal.targetDate ? formatMonth(goal.targetDate.slice(0, 7)).toLowerCase() : "" }}
              components={{ value: <span className="text-foreground" /> }}
            />
          </span>
        ) : (
          <span className="text-muted">{t("planning.goals.card.remaining", { amount: money(goal.remaining) })}</span>
        )}
      </span>
    </button>
  );
}

function GoalForm({ goal, onDone }: { goal: Goal | null; onDone: () => void }) {
  const { t } = useTranslation();
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
      setError(t("planning.goals.form.errors.name"));
      return;
    }
    if (!targetMinor) {
      setError(t("planning.goals.form.errors.target"));
      return;
    }
    if (manualMinor === null) {
      setError(t("planning.goals.form.errors.saved"));
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
      toast(goal ? t("planning.goals.form.updated") : t("planning.goals.form.created"));
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
      toast(t("planning.goals.form.removed"));
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
        <Field label={t("institutions.form.name")}>
          <TextInput
            autoFocus
            placeholder={t("planning.goals.form.namePlaceholder")}
            value={name}
            maxLength={80}
            onChange={setName}
          />
        </Field>
        <Field label={t("planning.goals.form.target")}>
          <MoneyInput value={target} onChange={setTarget} />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("planning.goals.form.date")}>
          <input className={controlClass} type="month" value={targetMonth} onChange={(event) => setTargetMonth(event.target.value)} />
        </Field>
        <Field label={t("planning.goals.form.saved")}>
          <MoneyInput value={manual} onChange={setManual} />
        </Field>
      </div>

      <Panel title={t("planning.goals.form.sources.title")} subtitle={t("planning.goals.form.sources.subtitle")} className="!p-4">
        <div className="space-y-1">
          {accounts.data?.length === 0 && (portfolio.data?.items.length ?? 0) === 0 ? (
            <p className="text-sm text-faint">{t("planning.goals.form.sources.empty")}</p>
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
                <span className="text-faint"> · {t("planning.goals.form.sources.investment")}</span>
              </span>
              <Money amount={investment.current} className="text-xs text-muted" />
            </label>
          ))}
        </div>
      </Panel>

      <Field label={t("institutions.form.color")}>
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
            {confirmDelete ? t("common.actions.confirm") : t("common.actions.remove")}
          </Button>
        ) : null}
        <div className="flex-1" />
        <Button variant="ghost" onClick={onDone}>
          {t("common.actions.cancel")}
        </Button>
        <Button variant="primary" type="submit" disabled={save.isPending}>
          {save.isPending ? t("common.save.saving") : t("common.actions.save")}
        </Button>
      </FormFooter>
    </form>
  );
}
