import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { t } from "@/i18n";
import { Icon, type IconName } from "@/components/Icon";
import { Money } from "@/components/Money";
import { useToast } from "@/components/Toast";
import { errorMessage } from "@/lib/api";
import { useConfirmTransaction, useSkipTransaction, type Transaction } from "@/lib/queries";
import { shortDate } from "@/lib/dates";
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
    return { icon: "trend", badge: "bg-accent/10 text-accent", tone: "transfer" };
  }
  if (transaction.card) {
    return { icon: "card", badge: "bg-negative/10 text-negative", tone: "plain", sign: "-" };
  }
  return { icon: "arrowUp", badge: "bg-negative/10 text-negative", tone: "plain", sign: "-" };
}

/** "Nubank [to] Itaú": where the money left and where it landed. */
function route(from: string | undefined, to: string | undefined): ReactNode {
  return (
    <>
      {from ?? ""}
      <Icon name="arrowRight" size={11} className="mx-1 inline -translate-y-px" />
      <span className="sr-only">{t("transactions.row.to")} </span>
      {to ?? ""}
    </>
  );
}

function subtitleOf(transaction: Transaction): ReactNode {
  if (transaction.type === "TRANSFER") {
    return route(transaction.account?.name, transaction.destinationAccount?.name);
  }
  if (transaction.type === "CARD_PAYMENT") {
    return route(transaction.account?.name, transaction.card?.name);
  }
  if (transaction.type === "INVESTMENT") {
    return route(transaction.account?.name, transaction.investment?.name);
  }
  if (transaction.type === "REDEMPTION") {
    return route(transaction.investment?.name, transaction.account?.name);
  }
  const category = transaction.category?.name ?? t("transactions.noCategory");
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
  showDate,
}: {
  transaction: Transaction;
  onOpen: (transaction: Transaction) => void;
  /** Rows grouped by invoice rather than by day show their own date. */
  showDate?: boolean;
}) {
  const { t } = useTranslation();
  const look = lookOf(transaction);
  const pending = transaction.status === "PENDING";

  return (
    <li className="group relative">
      <button
        type="button"
        className="data-row flex w-full items-center gap-3 rounded-2xl px-3 py-3.5 text-left transition-colors hover:bg-hover"
        onClick={() => onOpen(transaction)}
      >
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${pending ? "border border-dashed border-line-strong text-muted" : look.badge}`}
        >
          <Icon name={transaction.recurring && pending ? "repeat" : look.icon} size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-sm">
            <span className={`truncate ${pending ? "text-muted" : ""}`}>
              {transaction.description ||
                transaction.category?.name ||
                (transaction.type === "CARD_PAYMENT"
                  ? t("transactions.kind.cardPayment")
                  : transaction.type === "INVESTMENT"
                    ? t("transactions.kind.investment")
                    : transaction.type === "REDEMPTION"
                      ? t("transactions.kind.redemption")
                      : t(entryTypeLabels[transaction.type]))}
            </span>
            {pending ? (
              <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-accent uppercase">
                {t("transactions.row.pending")}
              </span>
            ) : null}
          </span>
          <span className="block truncate text-xs text-muted">
            {showDate ? `${shortDate(transaction.date)} · ` : ""}
            {subtitleOf(transaction)}
          </span>
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
            className="hidden text-faint opacity-0 transition-opacity group-hover:opacity-100 hoverable:block"
          />
        ) : null}
      </button>
      {pending ? <PendingActions transaction={transaction} /> : null}
    </li>
  );
}

/** Confirm or skip a recurring occurrence without opening the form. */
function PendingActions({ transaction }: { transaction: Transaction }) {
  const { t } = useTranslation();
  const toast = useToast();
  const confirm = useConfirmTransaction();
  const skip = useSkipTransaction();
  const busy = confirm.isPending || skip.isPending;

  async function run(action: "confirm" | "skip") {
    try {
      if (action === "confirm") {
        await confirm.mutateAsync({ id: transaction.id });
        toast(t("transactions.row.confirmed"));
      } else {
        await skip.mutateAsync(transaction.id);
        toast(t("transactions.row.skipped"));
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
        className="rounded-lg px-2.5 py-1.5 text-xs text-muted transition-colors hover:bg-hover-strong hover:text-foreground disabled:opacity-50"
        onClick={() => void run("skip")}
      >
        {t("transactions.row.skip")}
      </button>
      <button
        type="button"
        disabled={busy}
        className="flex items-center gap-1 rounded-lg bg-accent/15 px-2.5 py-1.5 text-xs text-accent transition-colors hover:bg-accent/25 disabled:opacity-50"
        onClick={() => void run("confirm")}
      >
        <Icon name="check" size={13} />
        {t("common.actions.confirm")}
      </button>
    </span>
  );
}
