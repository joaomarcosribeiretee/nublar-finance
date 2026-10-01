import { useState } from "react";
import { AccountSelect } from "@/components/AccountSelect";
import { CategoryChips } from "./CategoryChips";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { controlClass, Field } from "@/components/Field";
import { Modal } from "@/components/Modal";
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
  type EntryType,
  type Transaction,
} from "@/lib/queries";

const typeOptions: { value: EntryType; label: string; activeClass: string }[] = [
  { value: "EXPENSE", label: "Despesa", activeClass: "text-negative" },
  { value: "INCOME", label: "Receita", activeClass: "text-positive" },
  { value: "TRANSFER", label: "Transferência", activeClass: "text-transfer" },
];

type Repeat = "once" | "monthly" | "installments";

export function TransactionForm({
  open,
  onClose,
  month,
  editing,
  onNeedAccount,
}: {
  open: boolean;
  onClose: () => void;
  month: string;
  editing: Transaction | null;
  onNeedAccount: () => void;
}) {
  const title = !editing
    ? "Novo lançamento"
    : editing.type === "CARD_PAYMENT"
      ? "Pagamento de fatura"
      : editing.type === "INVESTMENT"
        ? "Aporte"
        : editing.type === "REDEMPTION"
          ? "Resgate"
      : editing.purchase
        ? "Compra no cartão"
        : editing.status === "PENDING"
          ? "Lançamento pendente"
          : "Editar lançamento";

  return (
    <Modal open={open} onClose={onClose} title={title} width={520}>
      {editing && isMovement(editing.type) ? (
        <PaymentDetails payment={editing} onDone={onClose} />
      ) : (
        <FormBody
          month={month}
          editing={editing}
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
  onDone,
  onNeedAccount,
}: {
  month: string;
  editing: Transaction | null;
  onDone: () => void;
  onNeedAccount: () => void;
}) {
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

  const purchase = editing?.purchase ?? null;
  const [type, setType] = useState<EntryType>(
    editing && !isMovement(editing.type) ? (editing.type as EntryType) : "EXPENSE",
  );
  const [payWith, setPayWith] = useState<"account" | "card">(purchase ? "card" : "account");
  const [amount, setAmount] = useState(
    purchase ? minorUnitsToInput(purchase.amount) : editing ? minorUnitsToInput(editing.amount) : "",
  );
  const [accountId, setAccountId] = useState(editing?.account?.id ?? "");
  const [destinationAccountId, setDestinationAccountId] = useState(
    editing?.destinationAccount?.id ?? "",
  );
  const [cardId, setCardId] = useState(editing?.card?.id ?? "");
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
  const [date, setDate] = useState(purchase?.date ?? editing?.date ?? defaultDateFor(month));
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
  const parts = effectiveRepeat === "installments" ? installments : 1;
  const sourceId = accountId || accountList[0]?.id || "";
  const destinationId =
    destinationAccountId || accountList.find((account) => account.id !== sourceId)?.id || "";
  const chosenCard = cardId || cardList[0]?.id || "";
  const chosenCategory = visibleCategories.some((c) => c.id === categoryId) ? categoryId : "";
  const parsedAmount = parseReaisToMinorUnits(amount);
  const saving = saveEntry.isPending || savePurchase.isPending || saveRecurring.isPending;

  if (accounts.isSuccess && accountList.length === 0) {
    return (
      <EmptyState
        icon="wallet"
        title="Nenhuma conta ainda"
        description="Todo lançamento acontece em uma conta. Adicione seu banco para começar."
        action={
          <Button variant="primary" onClick={onNeedAccount}>
            Adicionar instituição
          </Button>
        }
      />
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!parsedAmount) {
      setError("Informe um valor, por exemplo 25,90.");
      return;
    }
    if (type === "TRANSFER" && (!destinationId || destinationId === sourceId)) {
      setError("Escolha duas contas diferentes.");
      return;
    }
    if (type !== "TRANSFER" && !chosenCategory) {
      setError("Escolha uma categoria.");
      return;
    }

    setError(null);
    try {
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
        toast("Recorrência criada: aparece todo mês para confirmar");
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
            installments,
            description: description.trim(),
            dayOfMonth: Number(date.slice(8, 10)),
            startMonth: date.slice(0, 7),
            endMonth: null,
            postFirst: date <= todayLocal(),
          },
        });
        toast(`Parcelado em ${installments}x`);
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
      toast(editing ? "Lançamento atualizado" : "Lançamento salvo");
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
        toast("Compra excluída");
      } else {
        await removeEntry.mutateAsync(editing.id);
        toast(editing.status === "PENDING" ? "Pulado este mês" : "Lançamento excluído");
      }
      onDone();
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    }
  }

  async function confirmPending() {
    if (!editing || !parsedAmount) {
      return;
    }
    try {
      await confirm.mutateAsync({ id: editing.id, amount: parsedAmount, date });
      toast("Confirmado");
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
      {!pending && !purchase ? (
        <Segmented
          value={type}
          options={typeOptions}
          onChange={(next) => {
            setType(next);
            setError(null);
          }}
        />
      ) : null}

      <label className="block rounded-2xl border border-line bg-surface-2 px-4 py-3 transition-colors focus-within:border-gold/60">
        <span className="text-xs text-muted">
          {effectiveRepeat === "installments" ? "Valor total" : effectiveRepeat === "monthly" ? "Valor por mês" : "Valor"}
        </span>
        <div className="mt-1 flex items-baseline gap-2">
          <span className={`text-lg ${amountColor}`}>R$</span>
          <input
            autoFocus
            inputMode="decimal"
            placeholder="0,00"
            className={`tabular w-full bg-transparent font-display text-3xl outline-none placeholder:text-faint ${amountColor}`}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </div>
      </label>

      {type === "EXPENSE" && cardList.length > 0 && !pending ? (
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

      {type === "TRANSFER" ? (
        <div className="grid grid-cols-2 gap-3">
          {accountSelect("De", sourceId, setAccountId)}
          {accountSelect("Para", destinationId, setDestinationAccountId)}
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
            <Field label="Cartão">
              <select
                className={controlClass}
                value={chosenCard}
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
            accountSelect("Conta", sourceId, setAccountId)
          )}
        </>
      )}

      {canRepeat && !pending ? (
        <div className="space-y-3 rounded-2xl border border-line p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted">Repetição</span>
            <Segmented
              size="sm"
              value={effectiveRepeat}
              options={[
                { value: "once" as Repeat, label: "Não repete" },
                ...(editing ? [] : [{ value: "monthly" as Repeat, label: "Fixo todo mês" }]),
                ...(type === "EXPENSE" ? [{ value: "installments" as Repeat, label: "Parcelado" }] : []),
              ]}
              onChange={setRepeat}
            />
          </div>
          {effectiveRepeat === "installments" ? (
            <div className="animate-enter flex items-center gap-3">
              <input
                aria-label="Número de parcelas"
                className={`${controlClass} !w-20 tabular`}
                type="number"
                min={2}
                max={onCard ? 48 : 120}
                value={installments}
                onChange={(event) => setInstallments(Math.min(Math.max(Number(event.target.value) || 2, 2), onCard ? 48 : 120))}
              />
              <span className="text-sm text-muted">vezes</span>
              {parsedAmount ? <InstallmentPreview total={parsedAmount} count={installments} inline /> : null}
            </div>
          ) : null}
          {effectiveRepeat === "monthly" ? (
            <p className="animate-enter text-xs text-faint">
              {onCard
                ? "Entra em toda fatura do cartão, na data de vencimento. Cada mês aparece como pendente para confirmar."
                : `Todo dia ${Number(date.slice(8, 10))}, a partir de ${monthLabel(date.slice(0, 7)).toLowerCase()}. Cada mês aparece como pendente para confirmar.`}
            </p>
          ) : null}
          {effectiveRepeat === "installments" && !onCard ? (
            <p className="text-xs text-faint">
              Uma parcela por mês na conta, a partir desta data. As próximas aparecem como pendentes.
            </p>
          ) : null}
        </div>
      ) : null}

      {editing?.recurring ? (
        <p className="text-xs text-faint">
          Faz parte de uma recorrência. Aqui você muda só este mês; para mudar todos, use Recorrentes.
        </p>
      ) : null}

      <div className="grid grid-cols-[1fr_160px] gap-3">
        <Field label="Descrição">
          <input
            className={controlClass}
            placeholder={type === "TRANSFER" ? "Opcional" : "Ex.: Mercado"}
            value={description}
            maxLength={200}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
        <Field label={onCard ? "Data da compra" : "Data"}>
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
          Transferências entre suas contas não contam como receita nem despesa.
        </p>
      ) : null}
      {onCard ? (
        <p className="text-xs text-faint">
          A despesa entra no mês de cada fatura. Compras no dia do fechamento ou depois vão para a
          fatura seguinte.
        </p>
      ) : null}

      {error ? <p className="animate-enter text-sm text-negative">{error}</p> : null}

      <footer className="flex items-center gap-2 pt-1">
        {editing ? (
          <Button
            variant={confirmDelete ? "dangerSolid" : "danger"}
            onClick={() => void destroy()}
            disabled={removeEntry.isPending || removePurchase.isPending}
            onBlur={() => setConfirmDelete(false)}
          >
            {confirmDelete
              ? purchase && purchase.installments > 1
                ? `Excluir ${purchase.installments} parcelas`
                : "Confirmar"
              : pending
                ? "Pular"
                : "Excluir"}
          </Button>
        ) : null}
        <div className="flex-1" />
        {pending ? (
          <>
            <Button variant="ghost" type="submit" disabled={saving}>
              Salvar
            </Button>
            <Button variant="primary" onClick={() => void confirmPending()} disabled={confirm.isPending}>
              Confirmar
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onDone}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </>
        )}
      </footer>
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
        <>
          {count}x de <span className="text-foreground tabular">{formatMinorUnits(base.toString())}</span>
        </>
      ) : (
        <>
          1ª de <span className="text-foreground tabular">{formatMinorUnits(first.toString())}</span> e{" "}
          {count - 1}x de <span className="text-foreground tabular">{formatMinorUnits(base.toString())}</span>
        </>
      )}
    </p>
  );
}

/** Money changing place: shown read-only, can only be deleted and redone. */
function isMovement(type: Transaction["type"]): boolean {
  return type === "CARD_PAYMENT" || type === "INVESTMENT" || type === "REDEMPTION";
}

function PaymentDetails({ payment, onDone }: { payment: Transaction; onDone: () => void }) {
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
      toast("Excluído");
      onDone();
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    }
  }

  return (
    <div className="space-y-5">
      <dl className="space-y-3 rounded-2xl bg-surface-2 p-4 text-sm">
        <Row label="Valor">
          <Money amount={payment.amount} className="text-lg" />
        </Row>
        {payment.type === "CARD_PAYMENT" ? (
          <>
            <Row label="Cartão">{payment.card?.name}</Row>
            <Row label="Fatura">{payment.invoiceMonth ? monthLabel(payment.invoiceMonth) : "—"}</Row>
            <Row label="Pago com">{payment.account?.name}</Row>
          </>
        ) : (
          <>
            <Row label="Investimento">{payment.investment?.name}</Row>
            <Row label={payment.type === "INVESTMENT" ? "Saiu de" : "Voltou para"}>
              {payment.account?.name}
            </Row>
          </>
        )}
        <Row label="Data">{dayLabel(payment.date)}</Row>
      </dl>
      <p className="text-xs text-faint">
        {payment.type === "CARD_PAYMENT"
          ? "Pagamentos de fatura não são despesa: as compras já contaram no mês da fatura."
          : "Aportes e resgates só mudam o dinheiro de lugar: não são despesa nem receita."}
      </p>
      {error ? <p className="text-sm text-negative">{error}</p> : null}
      <footer className="flex items-center gap-2">
        <Button
          variant={confirmDelete ? "dangerSolid" : "danger"}
          onClick={() => void destroy()}
          onBlur={() => setConfirmDelete(false)}
          disabled={remove.isPending}
        >
          {confirmDelete ? "Confirmar exclusão" : "Excluir"}
        </Button>
        <div className="flex-1" />
        <Button variant="ghost" onClick={onDone}>
          Fechar
        </Button>
      </footer>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
