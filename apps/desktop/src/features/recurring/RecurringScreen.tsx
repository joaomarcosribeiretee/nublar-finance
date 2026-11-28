import { useState } from "react";
import { useTranslation } from "react-i18next";
import { t } from "@/i18n";
import { AccountSelect } from "@/components/AccountSelect";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { controlClass, Field, IntegerInput, MoneyInput, TextInput } from "@/components/Field";
import { Icon } from "@/components/Icon";
import { FormFooter, Modal } from "@/components/Modal";
import { Money } from "@/components/Money";
import { ErrorNote, Panel } from "@/components/Page";
import { Segmented } from "@/components/Segmented";
import { useToast } from "@/components/Toast";
import { errorMessage } from "@/lib/api";
import { currentMonth } from "@/lib/dates";
import { minorUnitsToInput, parseReaisToMinorUnits } from "@/lib/money";
import { useFormatMoney } from "@/hooks/useHideValues";
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
import { categoryLabel } from "@/lib/categories";
import { formatMonth } from "@/lib/format";

/** "todo dia 8 · Nubank · Conta corrente", "em toda fatura · Cartão Nubank", "10x · até jan 27". */
function describeRule(rule: RecurringRule): string {
  const where = rule.card ? t("institutions.panel.card", { name: rule.card.name }) : (rule.account?.name ?? "");
  const when = rule.card ? t("recurring.describe.everyInvoice") : t("recurring.describe.everyDay", { day: rule.dayOfMonth });
  const until = rule.installments
    ? `${rule.installments}x · ${t("recurring.describe.until", { month: `${formatMonth(rule.endMonth ?? rule.startMonth, "short")} ${(rule.endMonth ?? "").slice(2, 4)}` })}`
    : rule.endMonth
      ? t("recurring.describe.until", { month: formatMonth(rule.endMonth).toLowerCase() })
      : null;
  return [categoryLabel(rule.category.name), when, where, until].filter(Boolean).join(" · ");
}

/** What a rule costs per month: the installment for plans, the amount otherwise. */
function monthlyOf(rule: RecurringRule): bigint {
  const amount = BigInt(rule.amount);
  return rule.installments ? amount / BigInt(rule.installments) : amount;
}

/** The rules behind every scheduled entry; lives as a tab of Lançamentos. */
export function RecurringScreen() {
  const { t } = useTranslation();
  const money = useFormatMoney();
  const rules = useRecurring();
  const [editing, setEditing] = useState<RecurringRule | "new" | null>(null);
  const [search, setSearch] = useState("");
  const data = (rules.data ?? []).filter((rule) => `${rule.description} ${categoryLabel(rule.category.name)} ${rule.card?.name ?? ""} ${rule.account?.name ?? ""}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const groups: { title: string; items: RecurringRule[]; tone: "positive" | "plain" }[] = [
    { title: t("recurring.groups.income"), items: data.filter((r) => r.type === "INCOME"), tone: "positive" },
    { title: t("recurring.groups.expense"), items: data.filter((r) => r.type === "EXPENSE" && !r.installments), tone: "plain" },
    { title: t("recurring.groups.installments"), items: data.filter((r) => r.installments), tone: "plain" },
  ];

  return (
    <section className="animate-enter space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted">
          {t("recurring.intro")}
        </p>
        <Button onClick={() => setEditing("new")}>
          <Icon name="plus" size={16} />
          {t("recurring.new")}
        </Button>
      </div>
      {rules.data && rules.data.length > 0 ? <div className="filter-toolbar flex items-center gap-3">
        <Icon name="search" size={17} className="text-muted" />
        <input type="search" aria-label={t("recurring.search.label")} placeholder={t("recurring.search.placeholder")} value={search} onChange={(event) => setSearch(event.target.value)} maxLength={100} className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none" />
        <span className="shrink-0 text-xs text-muted">{t("recurring.search.count", { count: data.length })}</span>
      </div> : null}

      {rules.isError ? (
        <ErrorNote>{errorMessage(rules.error)}</ErrorNote>
      ) : rules.isPending ? (
        <div className="skeleton h-40 rounded-3xl" />
      ) : rules.data?.length === 0 ? (
        <EmptyState
          icon="repeat"
          title={t("recurring.empty.title")}
          description={t("recurring.empty.description")}
          action={
            <Button variant="primary" onClick={() => setEditing("new")}>
              {t("recurring.empty.action")}
            </Button>
          }
        />
      ) : data.length === 0 ? <EmptyState icon="search" title={t("recurring.notFound.title")} description={t("recurring.notFound.description")} action={<Button onClick={() => setSearch("")}>{t("recurring.notFound.clear")}</Button>} /> : (
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
                  actions={<span className="text-xs text-muted">{t("recurring.perMonth", { amount: money(total.toString()) })}</span>}
                >
                  <ul>
                    {group.items.map((rule) => (
                      <li key={rule.id}>
                        <button
                          type="button"
                          className="data-row flex w-full items-center gap-3 rounded-2xl px-3 py-4 text-left transition-colors hover:bg-hover"
                          onClick={() => setEditing(rule)}
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted">
                            <Icon name={rule.card ? "card" : rule.installments ? "list" : "repeat"} size={15} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm">{rule.description || categoryLabel(rule.category.name)}</span>
                            <span className="block truncate text-xs text-muted">{describeRule(rule)}</span>
                          </span>
                          <span className="shrink-0 text-right">
                            <Money amount={monthlyOf(rule).toString()} tone={group.tone} className="block text-sm" />
                            {rule.installments ? (
                              <span className="text-[11px] text-faint">{t("recurring.total", { amount: money(rule.amount) })}</span>
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
        title={editing === "new" ? t("recurring.new") : t("recurring.edit")}
        width={540}
      >
        {editing ? <RecurringForm rule={editing === "new" ? null : editing} onDone={() => setEditing(null)} /> : null}
      </Modal>
    </section>
  );
}

function RecurringForm({ rule, onDone }: { rule: RecurringRule | null; onDone: () => void }) {
  const { t } = useTranslation();
  const money = useFormatMoney();
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
      setError(t("recurring.form.errors.amount"));
      return;
    }
    if (!categoryId) {
      setError(t("transactions.form.errors.category"));
      return;
    }
    if (!plan && endMonth && endMonth < startMonth) {
      setError(t("recurring.form.errors.end"));
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
      toast(rule ? t("recurring.form.updated") : t("recurring.form.created"));
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
      toast(t("recurring.form.removed"));
      onDone();
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          label={t("transactions.filters.label")}
          value={type}
          options={[
            { value: "EXPENSE", label: t("labels.entryType.EXPENSE"), activeClass: "text-negative" },
            { value: "INCOME", label: t("labels.entryType.INCOME"), activeClass: "text-positive" },
          ]}
          onChange={(value) => {
            setType(value);
            setCategoryId("");
          }}
        />
        {type === "EXPENSE" ? (
          <Segmented
            size="sm"
            label={t("transactions.form.repeat.label")}
            value={mode}
            options={[
              { value: "monthly", label: t("transactions.form.repeat.monthly") },
              { value: "installments", label: t("transactions.form.repeat.installments") },
            ]}
            onChange={setMode}
          />
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_170px]">
        <Field label={t("transactions.form.description")}>
          <TextInput
            autoFocus
            placeholder={type === "INCOME" ? t("recurring.form.placeholders.income") : plan ? t("recurring.form.placeholders.installments") : t("recurring.form.placeholders.expense")}
            value={description}
            maxLength={200}
            onChange={setDescription}
          />
        </Field>
        <Field label={plan ? t("transactions.form.amount.total") : t("transactions.form.amount.monthly")}>
          <MoneyInput value={amount} onChange={setAmount} />
        </Field>
      </div>

      {plan ? (
        <Field label={t("recurring.form.installments")}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <IntegerInput
              className={`${controlClass} !w-24 tabular`}
              min={2}
              max={120}
              value={installments}
              onChange={setInstallments}
            />
            {parsed ? (
              <span className="text-sm text-muted">
                {t("recurring.form.installmentsPreview", { count: installments, amount: money((BigInt(parsed) / BigInt(installments)).toString()) })}
              </span>
            ) : null}
          </div>
        </Field>
      ) : null}

      <CategoryChips kind={type} categories={categories.data ?? []} value={categoryId} onChange={setCategoryId} />

      {type === "EXPENSE" && (cards.data?.length ?? 0) > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted">{t("transactions.form.payWith.label")}</span>
          <Segmented
            size="sm"
            label={t("transactions.form.payWith.label")}
            value={payWith}
            options={[
              { value: "account", label: t("transactions.form.payWith.account") },
              { value: "card", label: t("transactions.form.payWith.card") },
            ]}
            onChange={setPayWith}
          />
        </div>
      ) : null}

      {onCard ? (
        <Field label={t("transactions.form.card")}>
          <select className={controlClass} value={chosenCard} onChange={(event) => setCardId(event.target.value)}>
            {cards.data?.map((card) => (
              <option key={card.id} value={card.id}>
                {card.name}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-faint">
            {t("recurring.form.cardHint")}
          </span>
        </Field>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-3 sm:grid-cols-[1fr_110px]">
          <AccountSelect label={t("transactions.form.payWith.account")} accounts={accounts.data ?? []} value={chosenAccount} onChange={setAccountId} />
          <Field label={t("recurring.form.day")}>
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
        <Field label={onCard ? t("recurring.form.start.card") : plan ? t("recurring.form.start.installments") : t("recurring.form.start.monthly")}>
          <input
            className={controlClass}
            type="month"
            value={startMonth}
            onChange={(event) => setStartMonth(event.target.value)}
            required
          />
        </Field>
        {plan ? null : (
          <Field label={t("recurring.form.end")}>
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

      {rule ? <p className="text-xs text-faint">{t("recurring.form.editHint")}</p> : null}
      <FormFooter error={error}>
        {rule ? (
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
