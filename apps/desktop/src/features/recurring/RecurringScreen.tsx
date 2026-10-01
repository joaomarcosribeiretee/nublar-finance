import { useState } from "react";
import { AccountSelect } from "@/components/AccountSelect";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { controlClass, Field } from "@/components/Field";
import { Icon } from "@/components/Icon";
import { Modal } from "@/components/Modal";
import { Money } from "@/components/Money";
import { PageHeader, Panel } from "@/components/Page";
import { Segmented } from "@/components/Segmented";
import { useToast } from "@/components/Toast";
import { errorMessage } from "@/lib/api";
import { currentMonth, monthLabel, shortMonthLabel } from "@/lib/dates";
import { formatMinorUnits, minorUnitsToInput, parseReaisToMinorUnits } from "@/lib/money";
import {
  useAccounts,
  useCards,
  useCategories,
  useDeleteRecurring,
  useRecurring,
  useSaveRecurring,
  type CategoryKind,
  type RecurringRule,
} from "@/lib/queries";
import { CategoryChips } from "@/features/transactions/CategoryChips";

/** "todo dia 8 · Nubank · Conta corrente", "em toda fatura · Cartão Nubank", "10x · até jan 27". */
function describeRule(rule: RecurringRule): string {
  const where = rule.card ? `Cartão ${rule.card.name}` : (rule.account?.name ?? "");
  const when = rule.card ? "em toda fatura" : `todo dia ${rule.dayOfMonth}`;
  const until = rule.installments
    ? `${rule.installments}x · até ${shortMonthLabel(rule.endMonth ?? rule.startMonth)} ${(rule.endMonth ?? "").slice(2, 4)}`
    : rule.endMonth
      ? `até ${monthLabel(rule.endMonth).toLowerCase()}`
      : null;
  return [rule.category.name, when, where, until].filter(Boolean).join(" · ");
}

/** What a rule costs per month: the installment for plans, the amount otherwise. */
function monthlyOf(rule: RecurringRule): bigint {
  const amount = BigInt(rule.amount);
  return rule.installments ? amount / BigInt(rule.installments) : amount;
}

export function RecurringScreen() {
  const rules = useRecurring();
  const [editing, setEditing] = useState<RecurringRule | "new" | null>(null);
  const data = rules.data ?? [];
  const groups: { title: string; items: RecurringRule[]; tone: "positive" | "plain" }[] = [
    { title: "Receitas fixas", items: data.filter((r) => r.type === "INCOME"), tone: "positive" },
    { title: "Despesas fixas", items: data.filter((r) => r.type === "EXPENSE" && !r.installments), tone: "plain" },
    { title: "Parcelados", items: data.filter((r) => r.installments), tone: "plain" },
  ];

  return (
    <section className="animate-enter space-y-6">
      <PageHeader
        eyebrow="Salário, aluguel, assinaturas, carnês"
        title="Recorrentes"
        actions={
          <Button variant="primary" onClick={() => setEditing("new")}>
            <Icon name="plus" size={16} />
            Nova recorrência
          </Button>
        }
      >
        Todo mês o Nublar cria um lançamento pendente. Ele só afeta o saldo depois que você confirma.
      </PageHeader>

      {rules.isError ? <p className="text-sm text-negative">{errorMessage(rules.error)}</p> : null}

      {rules.isPending ? (
        <div className="skeleton h-40 rounded-3xl" />
      ) : data.length === 0 ? (
        <EmptyState
          icon="repeat"
          title="Nenhuma recorrência"
          description="Cadastre o que se repete (salário, aluguel, Netflix no cartão, um carnê em 10x) para não lançar à mão todo mês."
          action={
            <Button variant="primary" onClick={() => setEditing("new")}>
              Criar recorrência
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {groups
            .filter((group) => group.items.length > 0)
            .map((group) => {
              const total = group.items.reduce((sum, rule) => sum + monthlyOf(rule), 0n);
              return (
                <Panel
                  key={group.title}
                  flush
                  title={group.title}
                  actions={<span className="text-xs text-muted">{formatMinorUnits(total.toString())} por mês</span>}
                >
                  <ul>
                    {group.items.map((rule) => (
                      <li key={rule.id}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-white/[0.035]"
                          onClick={() => setEditing(rule)}
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted">
                            <Icon name={rule.card ? "card" : rule.installments ? "list" : "repeat"} size={15} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm">{rule.description || rule.category.name}</span>
                            <span className="block truncate text-xs text-muted">{describeRule(rule)}</span>
                          </span>
                          <span className="text-right">
                            <Money amount={monthlyOf(rule).toString()} tone={group.tone} className="block text-sm" />
                            {rule.installments ? (
                              <span className="text-[11px] text-faint">total {formatMinorUnits(rule.amount)}</span>
                            ) : null}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </Panel>
              );
            })}
        </div>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Nova recorrência" : "Editar recorrência"}
        width={540}
      >
        {editing ? <RecurringForm rule={editing === "new" ? null : editing} onDone={() => setEditing(null)} /> : null}
      </Modal>
    </section>
  );
}

function RecurringForm({ rule, onDone }: { rule: RecurringRule | null; onDone: () => void }) {
  const toast = useToast();
  const accounts = useAccounts();
  const cards = useCards();
  const categories = useCategories();
  const save = useSaveRecurring();
  const remove = useDeleteRecurring();
  const [type, setType] = useState<CategoryKind>(rule?.type ?? "EXPENSE");
  const [mode, setMode] = useState<"monthly" | "installments">(rule?.installments ? "installments" : "monthly");
  const [installments, setInstallments] = useState(rule?.installments ?? 10);
  const [payWith, setPayWith] = useState<"account" | "card">(rule?.card ? "card" : "account");
  const [amount, setAmount] = useState(rule ? minorUnitsToInput(rule.amount) : "");
  const [description, setDescription] = useState(rule?.description ?? "");
  const [accountId, setAccountId] = useState(rule?.account?.id ?? "");
  const [cardId, setCardId] = useState(rule?.card?.id ?? "");
  const [categoryId, setCategoryId] = useState(rule?.category.id ?? "");
  const [dayOfMonth, setDayOfMonth] = useState(rule?.dayOfMonth ?? new Date().getDate());
  const [startMonth, setStartMonth] = useState(rule?.startMonth ?? currentMonth());
  const [endMonth, setEndMonth] = useState(rule && !rule.installments ? (rule.endMonth ?? "") : "");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const onCard = type === "EXPENSE" && payWith === "card" && (cards.data?.length ?? 0) > 0;
  const plan = type === "EXPENSE" && mode === "installments";
  const chosenAccount = accountId || accounts.data?.[0]?.id || "";
  const chosenCard = cardId || cards.data?.[0]?.id || "";
  const parsed = parseReaisToMinorUnits(amount);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!parsed) {
      setError("Informe um valor.");
      return;
    }
    if (!categoryId) {
      setError("Escolha uma categoria.");
      return;
    }
    try {
      await save.mutateAsync({
        id: rule?.id,
        input: {
          type,
          amount: parsed,
          installments: plan ? installments : null,
          description: description.trim(),
          accountId: onCard ? null : chosenAccount,
          cardId: onCard ? chosenCard : null,
          categoryId,
          dayOfMonth: onCard ? undefined : dayOfMonth,
          startMonth,
          endMonth: plan ? null : endMonth || null,
        },
      });
      toast(rule ? "Recorrência atualizada" : "Recorrência criada");
      onDone();
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    }
  }

  async function destroy() {
    if (!rule) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await remove.mutateAsync(rule.id);
      toast("Recorrência removida");
      onDone();
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          value={type}
          options={[
            { value: "EXPENSE", label: "Despesa", activeClass: "text-negative" },
            { value: "INCOME", label: "Receita", activeClass: "text-positive" },
          ]}
          onChange={(value) => {
            setType(value);
            setCategoryId("");
          }}
        />
        {type === "EXPENSE" ? (
          <Segmented
            size="sm"
            value={mode}
            options={[
              { value: "monthly", label: "Fixo todo mês" },
              { value: "installments", label: "Parcelado" },
            ]}
            onChange={setMode}
          />
        ) : null}
      </div>

      <div className="grid grid-cols-[1fr_170px] gap-3">
        <Field label="Descrição">
          <input
            autoFocus
            className={controlClass}
            placeholder={type === "INCOME" ? "Ex.: Salário" : plan ? "Ex.: Carnê da geladeira" : "Ex.: Netflix"}
            value={description}
            maxLength={200}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
        <Field label={plan ? "Valor total" : "Valor por mês"}>
          <input
            className={`${controlClass} tabular`}
            inputMode="decimal"
            placeholder="0,00"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </Field>
      </div>

      {plan ? (
        <Field label="Em quantas vezes">
          <div className="flex items-center gap-3">
            <input
              className={`${controlClass} !w-24 tabular`}
              type="number"
              min={2}
              max={120}
              value={installments}
              onChange={(event) => setInstallments(Math.max(2, Number(event.target.value) || 2))}
            />
            {parsed ? (
              <span className="text-sm text-muted">
                {installments}x de cerca de {formatMinorUnits((BigInt(parsed) / BigInt(installments)).toString())}
              </span>
            ) : null}
          </div>
        </Field>
      ) : null}

      <CategoryChips kind={type} categories={categories.data ?? []} value={categoryId} onChange={setCategoryId} />

      {type === "EXPENSE" && (cards.data?.length ?? 0) > 0 ? (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">Pagar com</span>
          <Segmented
            size="sm"
            value={payWith}
            options={[
              { value: "account", label: "Conta" },
              { value: "card", label: "Cartão de crédito" },
            ]}
            onChange={setPayWith}
          />
        </div>
      ) : null}

      {onCard ? (
        <Field label="Cartão">
          <select className={controlClass} value={chosenCard} onChange={(event) => setCardId(event.target.value)}>
            {cards.data?.map((card) => (
              <option key={card.id} value={card.id}>
                {card.name}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-faint">
            Entra em toda fatura, na data de vencimento dela. Não precisa escolher o dia.
          </span>
        </Field>
      ) : (
        <div className="grid grid-cols-[1fr_110px] gap-3">
          <AccountSelect label="Conta" accounts={accounts.data ?? []} value={chosenAccount} onChange={setAccountId} />
          <Field label="Todo dia">
            <select className={controlClass} value={dayOfMonth} onChange={(event) => setDayOfMonth(Number(event.target.value))}>
              {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label={onCard ? "A partir da fatura de" : plan ? "Primeira parcela em" : "Começa em"}>
          <input
            className={controlClass}
            type="month"
            value={startMonth}
            onChange={(event) => setStartMonth(event.target.value)}
            required
          />
        </Field>
        {plan ? null : (
          <Field label="Termina em (opcional)">
            <input
              className={controlClass}
              type="month"
              value={endMonth}
              min={startMonth}
              onChange={(event) => setEndMonth(event.target.value)}
            />
          </Field>
        )}
      </div>

      {rule ? <p className="text-xs text-faint">Alterar atualiza os pendentes. O que já foi confirmado não muda.</p> : null}
      {error ? <p className="text-sm text-negative">{error}</p> : null}
      <footer className="flex items-center gap-2">
        {rule ? (
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
