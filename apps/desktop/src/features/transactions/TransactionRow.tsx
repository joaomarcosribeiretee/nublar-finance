import { Icon, type IconName } from "@/components/Icon";
import { Money } from "@/components/Money";
import { useToast } from "@/components/Toast";
import { errorMessage } from "@/lib/api";
import { useConfirmTransaction, useSkipTransaction, type Transaction } from "@/lib/queries";
import { entryTypeLabels } from "@/lib/labels";

type Look = {
  icon: IconName;
  badge: string;
  tone: "positive" | "plain" | "transfer";
  sign?: "+" | "-";
};

function lookOf(transaction: Transaction): Look {
  if (transaction.type === "INCOME") {
    return { icon: "arrowDown", badge: "bg-positive/10 text-positive", tone: "positive", sign: "+" };
  }
  if (transaction.type === "TRANSFER") {
    return { icon: "swap", badge: "bg-transfer/10 text-transfer", tone: "transfer" };
  }
  if (transaction.type === "CARD_PAYMENT") {
    return { icon: "card", badge: "bg-transfer/10 text-transfer", tone: "transfer" };
  }
  if (transaction.type === "INVESTMENT" || transaction.type === "REDEMPTION") {
    return { icon: "trend", badge: "bg-gold/10 text-gold", tone: "transfer" };
  }
  if (transaction.card) {
    return { icon: "card", badge: "bg-negative/10 text-negative", tone: "plain", sign: "-" };
  }
  return { icon: "arrowUp", badge: "bg-negative/10 text-negative", tone: "plain", sign: "-" };
}

function subtitleOf(transaction: Transaction): string {
  if (transaction.type === "TRANSFER") {
    return `${transaction.account?.name} → ${transaction.destinationAccount?.name ?? ""}`;
  }
  if (transaction.type === "CARD_PAYMENT") {
    return `${transaction.account?.name} → ${transaction.card?.name}`;
  }
  if (transaction.type === "INVESTMENT") {
    return `${transaction.account?.name} → ${transaction.investment?.name}`;
  }
  if (transaction.type === "REDEMPTION") {
    return `${transaction.investment?.name} → ${transaction.account?.name}`;
  }
  const category = transaction.category?.name ?? "Sem categoria";
  if (transaction.card) {
    const installment =
      (transaction.installmentCount ?? 1) > 1
        ? ` · ${transaction.installmentNumber}/${transaction.installmentCount}`
        : "";
    return `${category} · ${transaction.card.name}${installment}`;
  }
  return `${category} · ${transaction.account?.name ?? ""}`;
}

export function TransactionRow({
  transaction,
  onOpen,
}: {
  transaction: Transaction;
  onOpen: (transaction: Transaction) => void;
}) {
  const look = lookOf(transaction);
  const pending = transaction.status === "PENDING";

  return (
    <li className="group relative">
      <button
        type="button"
        className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors duration-150 hover:bg-white/[0.035]"
        onClick={() => onOpen(transaction)}
      >
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${pending ? "border border-dashed border-line-strong text-muted" : look.badge}`}
        >
          <Icon name={transaction.recurring && pending ? "repeat" : look.icon} size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 truncate text-sm">
            <span className={`truncate ${pending ? "text-muted" : ""}`}>
              {transaction.description ||
                transaction.category?.name ||
                (transaction.type === "CARD_PAYMENT"
                  ? "Pagamento de fatura"
                  : transaction.type === "INVESTMENT"
                    ? "Aporte"
                    : transaction.type === "REDEMPTION"
                      ? "Resgate"
                      : entryTypeLabels[transaction.type])}
            </span>
            {pending ? (
              <span className="shrink-0 rounded-full bg-gold/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-gold uppercase">
                Pendente
              </span>
            ) : null}
          </span>
          <span className="block truncate text-xs text-muted">{subtitleOf(transaction)}</span>
        </span>
        <Money
          amount={transaction.amount}
          tone={pending ? "plain" : look.tone}
          sign={look.sign}
          className={`text-sm transition-opacity ${pending ? "text-muted group-hover:opacity-0" : ""}`}
        />
        {!pending ? (
          <Icon
            name="pencil"
            size={14}
            className="text-faint opacity-0 transition-opacity group-hover:opacity-100"
          />
        ) : null}
      </button>
      {pending ? <PendingActions transaction={transaction} /> : null}
    </li>
  );
}

/** Confirm or skip a recurring occurrence without opening the form. */
function PendingActions({ transaction }: { transaction: Transaction }) {
  const toast = useToast();
  const confirm = useConfirmTransaction();
  const skip = useSkipTransaction();
  const busy = confirm.isPending || skip.isPending;

  async function run(action: "confirm" | "skip") {
    try {
      if (action === "confirm") {
        await confirm.mutateAsync({ id: transaction.id });
        toast("Confirmado");
      } else {
        await skip.mutateAsync(transaction.id);
        toast("Pulado este mês");
      }
    } catch (reason: unknown) {
      toast(errorMessage(reason), "error");
    }
  }

  return (
    <span className="pointer-events-none absolute top-1/2 right-3 flex -translate-y-1/2 gap-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100">
      <button
        type="button"
        disabled={busy}
        className="rounded-lg px-2.5 py-1.5 text-xs text-muted transition-colors hover:bg-white/5 hover:text-foreground"
        onClick={() => void run("skip")}
      >
        Pular
      </button>
      <button
        type="button"
        disabled={busy}
        className="flex items-center gap-1 rounded-lg bg-gold/15 px-2.5 py-1.5 text-xs text-gold transition-colors hover:bg-gold/25"
        onClick={() => void run("confirm")}
      >
        <Icon name="check" size={13} />
        Confirmar
      </button>
    </span>
  );
}
