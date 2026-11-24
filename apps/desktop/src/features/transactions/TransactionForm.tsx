import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import type { TranslationKey } from "@/i18n";
import { AccountSelect } from "@/components/AccountSelect";
import { CategoryChips } from "./CategoryChips";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { controlClass, Field, IntegerInput, MoneyInput, TextInput } from "@/components/Field";
import { FormFooter, Modal } from "@/components/Modal";
import { Money } from "@/components/Money";
import { Segmented } from "@/components/Segmented";
import { useToast } from "@/components/Toast";
import { errorMessage } from "@/lib/api";
import { dayLabel, defaultDateFor, monthLabel, todayLocal } from "@/lib/dates";
import { formatMinorUnits, minorUnitsToInput, parseReaisToMinorUnits } from "@/lib/money";
import {
  useAccounts,
  useCards,
  useCategories,
  useConfirmTransaction,
  useDeletePurchase,
  useDeleteTransaction,
  useSavePurchase,
  useSaveRecurring,
  useSaveTransaction,
  useUpdateOccurrence,
  type EntryType,
  type Transaction,
} from "@/lib/queries";

const typeOptions: { value: EntryType; label: TranslationKey; activeClass: string }[] = [
  { value: "EXPENSE", label: "labels.entryType.EXPENSE", activeClass: "text-negative" },
  { value: "INCOME", label: "labels.entryType.INCOME", activeClass: "text-positive" },
  { value: "TRANSFER", label: "labels.entryType.TRANSFER", activeClass: "text-transfer" },
];

type Repeat = "once" | "monthly" | "installments";

export type FormPreset = { cardId: string; date: string };

export function TransactionForm({
  open,
  onClose,
  month,
  editing,
  preset,
  onNeedAccount,
}: {
  open: boolean;
  onClose: () => void;
  month: string;
  editing: Transaction | null;
  /** New card purchase started from an invoice. */
  preset?: FormPreset | null;
  onNeedAccount: () => void;
}) {
  const { t } = useTranslation();
  const title = !editing
    ? t("transactions.new")
    : editing.type === "CARD_PAYMENT"
      ? t("transactions.kind.cardPayment")
      : editing.type === "INVESTMENT"
        ? t("transactions.kind.investment")
        : editing.type === "REDEMPTION"
          ? t("transactions.kind.redemption")
          : editing.purchase
            ? t("transactions.form.titles.purchase")
            : editing.status === "PENDING"
              ? t("transactions.form.titles.pending")
              : t("transactions.form.titles.edit");

  return (
    <Modal open={open} onClose={onClose} title={title} width={520}>
      {editing && isMovement(editing.type) ? (
        <PaymentDetails payment={editing} onDone={onClose} />
      ) : (
        <FormBody
          month={month}
          editing={editing}
          preset={editing ? null : (preset ?? null)}
          onDone={onClose}
          onNeedAccount={() => {
            onClose();
            onNeedAccount();
          }}
        />
      )}
    </Modal>
  );
}

function FormBody({
  month,
  editing,
  preset,
  onDone,
  onNeedAccount,
}: {
  month: string;
  editing: Transaction | null;
  preset: FormPreset | null;
  onDone: () => void;
  onNeedAccount: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const accounts = useAccounts();
  const categories = useCategories();
  const cards = useCards();
  const saveEntry = useSaveTransaction();
  const savePurchase = useSavePurchase();
  const removeEntry = useDeleteTransaction();
  const removePurchase = useDeletePurchase();
  const confirm = useConfirmTransaction();
  const saveRecurring = useSaveRecurring();
  const updateOccurrence = useUpdateOccurrence();

  const purchase = editing?.purchase ?? null;
  // One month of a recurring rule: edited in place, never detached from it.
  const occurrence = editing?.recurring && !purchase ? editing : null;
  const [scope, setScope] = useState<"one" | "following">("one");
  const [type, setType] = useState<EntryType>(
    editing && !isMovement(editing.type) ? (editing.type as EntryType) : "EXPENSE",
  );
  const [payWith, setPayWith] = useState<"account" | "card">(
    purchase || editing?.card || preset ? "card" : "account",
  );
  const [amount, setAmount] = useState(
    purchase ? minorUnitsToInput(purchase.amount) : editing ? minorUnitsToInput(editing.amount) : "",
  );
  const [accountId, setAccountId] = useState(editing?.account?.id ?? "");
  const [destinationAccountId, setDestinationAccountId] = useState(
    editing?.destinationAccount?.id ?? "",
  );
  const [cardId, setCardId] = useState(editing?.card?.id ?? preset?.cardId ?? "");
  const [repeat, setRepeat] = useState<Repeat>(
    purchase && purchase.installments > 1 ? "installments" : "once",
  );
  const [installments, setInstallments] = useState(
    purchase && purchase.installments > 1 ? purchase.installments : 2,
  );
  const [categoryId, setCategoryId] = useState(editing?.category?.id ?? "");
  const [description, setDescription] = useState(
    purchase ? purchase.description : (editing?.description ?? ""),
  );
  const [date, setDate] = useState(
    purchase?.date ?? editing?.date ?? preset?.date ?? defaultDateFor(month),
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const accountList = accounts.data ?? [];
  const cardList = cards.data ?? [];
  const onCard = type === "EXPENSE" && payWith === "card";
  const kind = type === "INCOME" ? "INCOME" : "EXPENSE";
  const visibleCategories = (categories.data ?? []).filter((category) => category.kind === kind);
  // Monthly and installment plans are set up when recording; editing one
  // occurrence never turns it into a plan.
  const canRepeat = type !== "TRANSFER" && (!editing || Boolean(purchase));
  const effectiveRepeat: Repeat = canRepeat ? (type === "INCOME" && repeat === "installments" ? "once" : repeat) : "once";
  // The card schema stops at 48 parcels; a carnê on an account goes to 120.
  const maxInstallments = onCard ? 48 : 120;
  const parts = effectiveRepeat === "installments" ? Math.min(installments, maxInstallments) : 1;
  const sourceId = accountId || accountList[0]?.id || "";
  const destinationId =
    destinationAccountId || accountList.find((account) => account.id !== sourceId)?.id || "";
  const chosenCard = cardId || cardList[0]?.id || "";
  const chosenCategory = visibleCategories.some((c) => c.id === categoryId) ? categoryId : "";
  const parsedAmount = parseReaisToMinorUnits(amount);
  const saving =
    saveEntry.isPending || savePurchase.isPending || saveRecurring.isPending || updateOccurrence.isPending;

  if (accounts.isSuccess && accountList.length === 0) {
    return (
      <EmptyState
        icon="wallet"
        title={t("transactions.form.noAccount.title")}
        description={t("transactions.form.noAccount.description")}
        action={
          <Button variant="primary" onClick={onNeedAccount}>
            {t("home.onboarding.addInstitution")}
          </Button>
        }
      />
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!parsedAmount) {
      setError(t("transactions.form.errors.amount"));
      return;
    }
    if (type === "TRANSFER" && (!destinationId || destinationId === sourceId)) {
      setError(t("transactions.form.errors.sameAccount"));
      return;
    }
    if (type !== "TRANSFER" && !chosenCategory) {
      setError(t("transactions.form.errors.category"));
      return;
    }

    setError(null);
    try {
      if (occurrence) {
        await updateOccurrence.mutateAsync({
          id: occurrence.id,
          input: {
            amount: parsedAmount,
            categoryId: chosenCategory,
            description: description.trim(),
            date,
            accountId: onCard ? undefined : sourceId,
            scope,
          },
        });
        toast(scope === "following" ? t("transactions.form.toasts.recurringUpdated") : t("transactions.form.toasts.updated"));
        onDone();
        return;
      }
      if (!editing && effectiveRepeat === "monthly") {
        // Fixed every month: becomes a recurring rule. Recorded now, so the
        // first occurrence already happened unless it is in the future.
        await saveRecurring.mutateAsync({
          input: {
            type: kind,
            accountId: onCard ? null : sourceId,
            cardId: onCard ? chosenCard : null,
            categoryId: chosenCategory,
            amount: parsedAmount,
            description: description.trim(),
            dayOfMonth: onCard ? undefined : Number(date.slice(8, 10)),
            startMonth: date.slice(0, 7),
            startDate: onCard ? date : undefined,
            endMonth: null,
            postFirst: date <= todayLocal(),
          },
        });
        toast(t("transactions.form.toasts.recurringCreated"));
        onDone();
        return;
      }
      if (!editing && !onCard && effectiveRepeat === "installments") {
        // Paid from an account in parts (carnê, boleto parcelado).
        await saveRecurring.mutateAsync({
          input: {
            type: kind,
            accountId: sourceId,
            categoryId: chosenCategory,
            amount: parsedAmount,
            installments: parts,
            description: description.trim(),
            dayOfMonth: Number(date.slice(8, 10)),
            startMonth: date.slice(0, 7),
            endMonth: null,
            postFirst: date <= todayLocal(),
          },
        });
        toast(t("transactions.form.toasts.installments", { count: parts }));
        onDone();
        return;
      }
      if (onCard) {
        await savePurchase.mutateAsync({
          id: purchase?.id,
          input: {
            cardId: chosenCard,
            categoryId: chosenCategory,
            amount: parsedAmount,
            installments: parts,
            description: description.trim(),
            date,
          },
        });
        if (editing && !purchase) {
          // Moved from an account to a card: the old entry goes away.
          await removeEntry.mutateAsync(editing.id);
        }
      } else {
        await saveEntry.mutateAsync({
          id: purchase ? undefined : editing?.id,
          input: {
            type,
            accountId: sourceId,
            destinationAccountId: type === "TRANSFER" ? destinationId : undefined,
            categoryId: type === "TRANSFER" ? undefined : chosenCategory,
            amount: parsedAmount,
            description: description.trim(),
            date,
          },
        });
        if (purchase) {
          await removePurchase.mutateAsync(purchase.id);
        }
      }
      toast(editing ? t("transactions.form.toasts.updated") : t("transactions.form.toasts.saved"));
      onDone();
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    }
  }

  async function destroy() {
    if (!editing) {
      return;
    }
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      if (purchase) {
        await removePurchase.mutateAsync(purchase.id);
        toast(t("transactions.form.toasts.purchaseDeleted"));
      } else {
        await removeEntry.mutateAsync(editing.id);
        toast(occurrence || editing.status === "PENDING" ? t("transactions.row.skipped") : t("transactions.form.toasts.deleted"));
      }
      onDone();
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    }
  }

  async function confirmPending() {
    if (!editing) {
      return;
    }
    if (!parsedAmount) {
      setError(t("transactions.form.errors.amount"));
      return;
    }
    try {
      await confirm.mutateAsync({ id: editing.id, amount: parsedAmount, date });
      toast(t("transactions.row.confirmed"));
      onDone();
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    }
  }

  const amountColor =
    type === "INCOME" ? "text-positive" : type === "EXPENSE" ? "text-negative" : "text-transfer";

  const accountSelect = (label: string, value: string, onChange: (id: string) => void) => (
    <AccountSelect label={label} accounts={accountList} value={value} onChange={onChange} />
  );

  const pending = editing?.status === "PENDING";

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-5">
      {!pending && !purchase && !occurrence ? (
        <Segmented
          full
          label={t("transactions.form.type")}
          value={type}
          options={typeOptions.map((option) => ({ ...option, label: t(option.label) }))}
          onChange={(next) => {
            setType(next);
            setError(null);
          }}
        />
      ) : null}

      <label className="block rounded-2xl border border-line bg-surface-2 px-4 py-3 transition-colors focus-within:border-accent/60">
        <span className="text-xs text-muted">
          {effectiveRepeat === "installments" ? t("transactions.form.amount.total") : effectiveRepeat === "monthly" ? t("transactions.form.amount.monthly") : t("transactions.form.amount.single")}
        </span>
        <div className="mt-1 flex items-baseline gap-2">
          <span className={`text-lg ${amountColor}`}>{t("common.money.symbol")}</span>
          <MoneyInput
            autoFocus={!editing}
            className={`tabular w-full min-w-0 bg-transparent font-display text-3xl outline-none placeholder:text-faint focus-visible:outline-none ${amountColor}`}
            value={amount}
            onChange={(value) => {
              setAmount(value);
              setError(null);
            }}
          />
        </div>
      </label>

      {type === "EXPENSE" && cardList.length > 0 && !pending && !occurrence ? (
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

      {type === "TRANSFER" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {accountSelect(t("transactions.form.from"), sourceId, setAccountId)}
          {accountSelect(t("transactions.form.to"), destinationId, setDestinationAccountId)}
        </div>
      ) : (
        <>
          <CategoryChips
            kind={kind}
            categories={categories.data ?? []}
            value={chosenCategory}
            onChange={setCategoryId}
          />
          {onCard ? (
            <Field label={t("transactions.form.card")}>
              <select
                className={controlClass}
                value={chosenCard}
                disabled={Boolean(occurrence)}
                onChange={(event) => setCardId(event.target.value)}
              >
                {cardList.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            accountSelect(t("transactions.form.payWith.account"), sourceId, setAccountId)
          )}
        </>
      )}

      {canRepeat && !pending ? (
        <div className="space-y-3 rounded-2xl border border-line p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted">{t("transactions.form.repeat.label")}</span>
            <Segmented
              size="sm"
              label={t("transactions.form.repeat.label")}
              value={effectiveRepeat}
              options={[
                { value: "once" as Repeat, label: t("transactions.form.repeat.once") },
                ...(editing ? [] : [{ value: "monthly" as Repeat, label: t("transactions.form.repeat.monthly") }]),
                ...(type === "EXPENSE" ? [{ value: "installments" as Repeat, label: t("transactions.form.repeat.installments") }] : []),
              ]}
              onChange={setRepeat}
            />
          </div>
          {effectiveRepeat === "installments" ? (
            <div className="animate-enter flex flex-wrap items-center gap-x-3 gap-y-2">
              <IntegerInput
                aria-label={t("transactions.form.repeat.count")}
                className={`${controlClass} !w-20 tabular`}
                min={2}
                max={maxInstallments}
                value={Math.min(installments, maxInstallments)}
                onChange={setInstallments}
              />
              <span className="text-sm text-muted">{t("transactions.form.repeat.times")}</span>
              {parsedAmount ? <InstallmentPreview total={parsedAmount} count={parts} inline /> : null}
            </div>
          ) : null}
          {effectiveRepeat === "monthly" ? (
            <p className="animate-enter text-xs text-faint">
              {onCard
                ? t("transactions.form.repeat.monthlyCard")
                : t("transactions.form.repeat.monthlyAccount", { day: Number(date.slice(8, 10)), month: monthLabel(date.slice(0, 7)).toLowerCase() })}
            </p>
          ) : null}
          {effectiveRepeat === "installments" && !onCard ? (
            <p className="text-xs text-faint">
              {t("transactions.form.repeat.installmentsAccount")}
            </p>
          ) : null}
        </div>
      ) : null}

      {occurrence ? (
        <div className="space-y-2 rounded-2xl border border-line p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <Icon name="repeat" size={13} />
              {t("transactions.form.scope.title")}
            </span>
            <Segmented
              size="sm"
              label={t("transactions.form.scope.label")}
              value={scope}
              options={[
                { value: "one" as const, label: t("transactions.form.scope.one") },
                { value: "following" as const, label: t("transactions.form.scope.following") },
              ]}
              onChange={setScope}
            />
          </div>
          <p className="text-xs text-faint">
            {scope === "one"
              ? t("transactions.form.scope.oneHint")
              : (occurrence.installmentCount ?? 1) > 1
                ? t("transactions.form.scope.followingInstallmentsHint")
                : t("transactions.form.scope.followingHint")}
          </p>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
        <Field label={t("transactions.form.description")}>
          <TextInput
            placeholder={type === "TRANSFER" ? t("common.optional") : t("transactions.form.descriptionPlaceholder")}
            value={description}
            maxLength={200}
            onChange={setDescription}
          />
        </Field>
        <Field label={onCard ? t("transactions.form.purchaseDate") : t("transactions.form.date")}>
          <input
            className={controlClass}
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </Field>
      </div>

      {type === "TRANSFER" ? (
        <p className="text-xs text-faint">
          {t("transactions.form.transferHint")}
        </p>
      ) : null}
      {onCard ? (
        <p className="text-xs text-faint">
          {t("transactions.form.cardHint")}
        </p>
      ) : null}

      <FormFooter error={error}>
        {editing ? (
          <Button
            variant={confirmDelete ? "dangerSolid" : "danger"}
            onClick={() => void destroy()}
            disabled={removeEntry.isPending || removePurchase.isPending}
            onBlur={() => setConfirmDelete(false)}
          >
            {confirmDelete
              ? purchase && purchase.installments > 1
                ? t("transactions.form.deleteInstallments", { count: purchase.installments })
                : t("common.actions.confirm")
              : pending || occurrence
                ? t("transactions.form.skipMonth")
                : t("common.actions.delete")}
          </Button>
        ) : null}
        <div className="flex-1" />
        {pending ? (
          <>
            <Button variant="ghost" type="submit" disabled={saving}>
              {t("common.actions.save")}
            </Button>
            <Button variant="primary" onClick={() => void confirmPending()} disabled={confirm.isPending}>
              {t("common.actions.confirm")}
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onDone}>
              {t("common.actions.cancel")}
            </Button>
            <Button variant="primary" type="submit" disabled={saving}>
              {saving ? t("common.save.saving") : t("common.actions.save")}
            </Button>
          </>
        )}
      </FormFooter>
    </form>
  );
}

/** Mirrors the backend split (remainder on the first installment) for preview only. */
function InstallmentPreview({ total, count, inline }: { total: string; count: number; inline?: boolean }) {
  const value = BigInt(total);
  const base = value / BigInt(count);
  const first = base + (value % BigInt(count));
  return (
    <p className={`animate-enter text-sm text-muted ${inline ? "" : "rounded-xl bg-surface-2 px-4 py-2.5"}`}>
      {first === base ? (
        <Trans
          i18nKey="transactions.form.installmentsEqual"
          values={{ count, value: formatMinorUnits(base.toString()) }}
          components={{ value: <span className="text-foreground tabular" /> }}
        />
      ) : (
        <Trans
          i18nKey="transactions.form.installmentsUneven"
          values={{ rest: count - 1, first: formatMinorUnits(first.toString()), value: formatMinorUnits(base.toString()) }}
          components={{ value: <span className="text-foreground tabular" /> }}
        />
      )}
    </p>
  );
}

/** Money changing place: shown read-only, can only be deleted and redone. */
function isMovement(type: Transaction["type"]): boolean {
  return type === "CARD_PAYMENT" || type === "INVESTMENT" || type === "REDEMPTION";
}

function PaymentDetails({ payment, onDone }: { payment: Transaction; onDone: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const remove = useDeleteTransaction();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function destroy() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await remove.mutateAsync(payment.id);
      toast(t("transactions.form.toasts.movementDeleted"));
      onDone();
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    }
  }

  return (
    <div className="space-y-5">
      <dl className="space-y-3 rounded-2xl bg-surface-2 p-4 text-sm">
        <Row label={t("transactions.form.amount.single")}>
          <Money amount={payment.amount} className="text-lg" />
        </Row>
        {payment.type === "CARD_PAYMENT" ? (
          <>
            <Row label={t("transactions.form.card")}>{payment.card?.name}</Row>
            <Row label={t("transactions.form.invoice")}>{payment.invoiceMonth ? monthLabel(payment.invoiceMonth) : "—"}</Row>
            <Row label={t("transactions.form.paidWith")}>{payment.account?.name}</Row>
          </>
        ) : (
          <>
            <Row label={t("transactions.form.investment")}>{payment.investment?.name}</Row>
            <Row label={payment.type === "INVESTMENT" ? t("transactions.form.leftFrom") : t("transactions.form.returnedTo")}>
              {payment.account?.name}
            </Row>
          </>
        )}
        <Row label={t("transactions.form.date")}>{dayLabel(payment.date)}</Row>
      </dl>
      <p className="text-xs text-faint">
        {payment.type === "CARD_PAYMENT"
          ? t("transactions.form.cardPaymentHint")
          : t("transactions.form.movementHint")}
      </p>
      <FormFooter error={error}>
        <Button
          variant={confirmDelete ? "dangerSolid" : "danger"}
          onClick={() => void destroy()}
          onBlur={() => setConfirmDelete(false)}
          disabled={remove.isPending}
        >
          {confirmDelete ? t("common.actions.confirmDelete") : t("common.actions.delete")}
        </Button>
        <div className="flex-1" />
        <Button variant="ghost" onClick={onDone}>
          {t("common.actions.close")}
        </Button>
      </FormFooter>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right">{children}</dd>
    </div>
  );
}
