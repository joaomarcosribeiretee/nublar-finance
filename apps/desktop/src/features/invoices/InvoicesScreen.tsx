import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import type { TranslationKey } from "@/i18n";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { Money } from "@/components/Money";
import { ErrorNote, PageHeader, Panel, ProgressBar, StatStrip, Stepper } from "@/components/Page";
import { Segmented } from "@/components/Segmented";
import { PayForm, StatusPill } from "@/features/cards/CardsScreen";
import { errorMessage } from "@/lib/api";
import { monthLabel, shiftMonth, shortDate, shortMonthLabel, todayLocal } from "@/lib/dates";
import { formatMinorUnits, percentOf } from "@/lib/money";
import {
  useCards,
  useInvoice,
  type Card,
  type Invoice,
  type InvoiceItem,
  type Transaction,
} from "@/lib/queries";
import type { FormPreset } from "@/features/transactions/TransactionForm";

type Actions = {
  onEdit: (transaction: Transaction) => void;
  onAdd: (preset: FormPreset) => void;
};

/** One screen per bill: what is on it, how it moves month to month, paying it. */
export function InvoicesScreen({
  cardId: initialCard,
  onEdit,
  onAdd,
  onOpenCards,
}: { cardId?: string | null; onOpenCards: () => void } & Actions) {
  const { t } = useTranslation();
  const cards = useCards();
  const [cardId, setCardId] = useState(initialCard ?? "");
  const list = cards.data ?? [];
  const card = list.find((item) => item.id === cardId) ?? list[0] ?? null;

  return (
    <section className="animate-enter">
      <PageHeader
        eyebrow={t("transactions.form.payWith.card")}
        title={t("shell.screens.invoices")}
        actions={
          list.length > 1 && card ? (
            list.length <= 4 ? (
              <Segmented
                size="sm"
                label={t("transactions.form.card")}
                value={card.id}
                options={list.map((item) => ({ value: item.id, label: item.name }))}
                onChange={setCardId}
              />
            ) : (
              <select
                aria-label={t("transactions.form.card")}
                className="h-10 max-w-full rounded-xl border border-line bg-surface-2 px-3 text-sm outline-none transition-colors hover:border-line-strong focus:border-accent/60"
                value={card.id}
                onChange={(event) => setCardId(event.target.value)}
              >
                {list.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            )
          ) : null
        }
      />

      <div className="mt-8">
        {cards.isError ? (
          <ErrorNote>{errorMessage(cards.error)}</ErrorNote>
        ) : cards.isPending ? (
          <div className="skeleton h-64 rounded-3xl" />
        ) : !card ? (
          <EmptyState
            icon="receipt"
            title={t("cards.empty.title")}
            description={t("invoices.empty.description")}
            action={
              <Button variant="primary" onClick={onOpenCards}>
                {t("invoices.empty.action")}
              </Button>
            }
          />
        ) : (
          // Remount per card so the month starts at that card's current bill.
          <CardInvoices key={card.id} card={card} onEdit={onEdit} onAdd={onAdd} />
        )}
      </div>
    </section>
  );
}

function CardInvoices({ card, onEdit, onAdd }: { card: Card } & Actions) {
  const { t } = useTranslation();
  const [month, setMonth] = useState(card.currentInvoice.month);
  const [paying, setPaying] = useState(false);
  const invoice = useInvoice(card.id, month);
  const data = invoice.data;
  const used = percentOf(card.debt, card.limit);
  const paid = data?.status === "PAID";
  const partlyPaid = data && !paid && BigInt(data.paid) > 0n;
  const lastPayment = data?.items.find((item) => item.type === "CARD_PAYMENT");

  function goTo(next: string) {
    setMonth(next);
    setPaying(false);
  }

  return (
    <div className={`space-y-4 transition-opacity duration-(--dur-base) ${invoice.isPlaceholderData ? "opacity-60" : ""}`}>
      {invoice.isError ? <ErrorNote>{errorMessage(invoice.error)}</ErrorNote> : null}
      <Panel className="invoice-overview">
        <div className="flex items-center justify-between gap-3">
          <Stepper
            className="-ml-2"
            label={monthLabel(month)}
            previousLabel={t("cards.detail.previous")}
            nextLabel={t("cards.detail.next")}
            onPrevious={() => goTo(shiftMonth(month, -1))}
            onNext={() => goTo(shiftMonth(month, 1))}
          />
          {data ? <StatusPill status={data.status} /> : null}
        </div>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <p className="text-xs text-muted">{paid ? t("cards.pay.paid") : t("invoices.toPay")}</p>
            <p className={`mt-1 flex items-center gap-2 font-display text-3xl tracking-tight @2xl:text-4xl ${paid ? "text-positive" : ""}`}>
              {data ? (
                <>
                  {paid ? <Icon name="check" size={28} /> : null}
                  <Money amount={paid ? data.paid : data.remaining} />
                </>
              ) : (
                <span className="skeleton block h-10 w-48" />
              )}
            </p>
            {data ? (
              <p className="mt-2 text-xs text-faint">
                {paid && lastPayment
                  ? lastPayment.account
                    ? t("invoices.paidOnWith", { date: shortDate(lastPayment.date), account: lastPayment.account.name })
                    : t("invoices.paidOn", { date: shortDate(lastPayment.date) })
                  : t("cards.detail.dates", { closing: shortDate(data.closingDate), due: shortDate(data.dueDate) })}
              </p>
            ) : null}
            {partlyPaid ? (
              <p className="mt-1 text-xs text-accent">
                <Trans
                  i18nKey="invoices.partlyPaid"
                  components={{ paid: <Money amount={data.paid} />, total: <Money amount={data.total} /> }}
                />
              </p>
            ) : null}
          </div>
          {data && !paid && BigInt(data.remaining) > 0n && !paying ? (
            <Button variant="primary" onClick={() => setPaying(true)}>
              {partlyPaid ? t("invoices.payRest") : t("cards.pay.action")}
            </Button>
          ) : null}
          {paid ? (
            <Button variant="ghost" onClick={() => goTo(shiftMonth(month, 1))}>
              {t("cards.detail.next")}
              <Icon name="chevronRight" size={14} />
            </Button>
          ) : null}
        </div>

        <div className="mt-6">
          <StatStrip
            columns="grid-cols-2 @2xl:grid-cols-4"
            items={[
              { label: t("cards.detail.total"), value: data?.total },
              { label: t("cards.detail.paid"), value: data?.paid },
              { label: t("cards.detail.remaining"), value: data?.remaining },
              { label: t("invoices.scheduled"), value: data?.scheduled, hint: t("invoices.scheduledHint") },
            ].map((stat) => ({
              label: stat.label,
              hint: stat.hint,
              value:
                stat.value === undefined ? <span className="skeleton block h-5 w-20" /> : <Money amount={stat.value} />,
            }))}
          />
        </div>

        {paying && data ? (
          <div className="mt-4">
            <PayForm card={card} month={month} remaining={data.remaining} onDone={() => setPaying(false)} />
          </div>
        ) : null}

        <div className="mt-6 space-y-2">
          {used <= 100 ? <ProgressBar value={used} tone={used > 90 ? "negative" : "accent"} /> : <p className="text-sm text-negative">{t("cards.tile.overLimit")} <Money amount={(BigInt(card.debt) - BigInt(card.limit)).toString()} /></p>}
          <p className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-[11px] text-faint">
            <span>
              <Trans
                i18nKey="invoices.usage"
                components={{ used: <Money amount={card.debt} />, available: <Money amount={card.available} /> }}
              />
            </span>
            <span>
              {t("institutions.add.limit")} <Money amount={card.limit} />
            </span>
          </p>
        </div>
      </Panel>

      {data ? <Timeline invoice={data} onPick={goTo} /> : null}

      {data ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <p className="text-xs text-faint">
              {data.items.length > 0 ? t("invoices.tapToEdit") : ""}
            </p>
            <Button
              variant="ghost"
              onClick={() => onAdd({ cardId: card.id, date: purchaseDateFor(data) })}
            >
              <Icon name="plus" size={15} />
              {t("invoices.addPurchase")}
            </Button>
          </div>
          <Items items={data.items} onEdit={onEdit} />
        </>
      ) : (
        <div className="skeleton h-48 rounded-3xl" />
      )}
    </div>
  );
}

/** Neighbouring bills as bars; the browsed one is highlighted. */
function Timeline({ invoice, onPick }: { invoice: Invoice; onPick: (month: string) => void }) {
  const { t } = useTranslation();
  const max = invoice.timeline.reduce((top, item) => {
    const value = BigInt(item.total);
    return value > top ? value : top;
  }, 0n);

  return (
    <Panel title={t("invoices.timeline.title")} subtitle={t("invoices.timeline.subtitle")}>
      <div className="flex h-28 items-end gap-1 @2xl:gap-2">
        {invoice.timeline.map((item) => {
          const height = max > 0n ? Number((BigInt(item.total) * 100n) / max) : 0;
          const active = item.month === invoice.month;
          return (
            <button
              key={item.month}
              type="button"
              onClick={() => onPick(item.month)}
              aria-current={active ? "true" : undefined}
              className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
              title={`${monthLabel(item.month)}: ${formatMinorUnits(item.total)}`}
            >
              <span
                className={`w-full rounded-md transition-colors ${
                  active ? "bg-accent" : item.status === "PAID" ? "bg-positive/30" : "bg-hover-strong group-hover:bg-line-strong"
                }`}
                style={{ height: `${Math.max(height, item.total === "0" ? 2 : 6)}%` }}
              />
              <span className={`max-w-full truncate text-[11px] ${active ? "text-foreground" : "text-faint"}`}>
                {shortMonthLabel(item.month)}
              </span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

const groups: { key: string; title: TranslationKey; match: (item: InvoiceItem) => boolean }[] = [
  {
    key: "installments",
    title: "invoices.groups.installments",
    match: (item) => item.type === "EXPENSE" && (item.installmentCount ?? 1) > 1,
  },
  {
    key: "fixed",
    title: "invoices.groups.fixed",
    match: (item) => item.type === "EXPENSE" && item.recurring && (item.installmentCount ?? 1) <= 1,
  },
  {
    key: "purchases",
    title: "invoices.groups.purchases",
    match: (item) => item.type === "EXPENSE" && !item.recurring && (item.installmentCount ?? 1) <= 1,
  },
  { key: "payments", title: "invoices.groups.payments", match: (item) => item.type === "CARD_PAYMENT" },
];

/**
 * A purchase date that lands on this invoice: today when it is the cycle
 * still open, otherwise the last day before it closes.
 */
function purchaseDateFor(invoice: Invoice): string {
  const today = todayLocal();
  const previousClosing = shiftMonth(invoice.closingDate.slice(0, 7), -1) + invoice.closingDate.slice(7);
  if (today < invoice.closingDate && today >= previousClosing) {
    return today;
  }
  const day = new Date(`${invoice.closingDate}T12:00:00`);
  day.setDate(day.getDate() - 1);
  return todayLocal(day);
}

function Items({ items, onEdit }: { items: InvoiceItem[]; onEdit: Actions["onEdit"] }) {
  const { t } = useTranslation();
  if (items.length === 0) {
    return (
      <Panel>
        <p className="py-8 text-center text-sm text-faint">{t("invoices.empty.items")}</p>
      </Panel>
    );
  }

  return (
    <div className="grid gap-4">
      {groups.map((group) => {
        const rows = items.filter(group.match);
        if (rows.length === 0) return null;
        const total = rows.reduce((sum, row) => sum + BigInt(row.amount), 0n);
        return (
          <Panel
            key={group.key}
            flush
            title={`${t(group.title)} · ${rows.length}`}
            actions={<Money amount={total.toString()} className="text-sm text-muted" />}
          >
            <ul>
              {rows.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onEdit(item)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-hover"
                  >
                  <span className="w-12 shrink-0 text-xs text-faint">{shortDate(item.date)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm">
                      <span className="truncate">
                        {item.type === "CARD_PAYMENT"
                          ? t("cards.detail.payment", { account: item.account?.name ?? "" })
                          : item.description || item.category?.name}
                      </span>
                      {item.status === "PENDING" ? (
                        <span className="shrink-0 rounded-full bg-hover-strong px-1.5 py-0.5 text-[10px] text-muted">{t("invoices.scheduledBadge")}</span>
                      ) : null}
                    </span>
                    {item.type === "EXPENSE" ? (
                      <span className="block truncate text-xs text-muted">
                        {item.category?.name}
                        {(item.installmentCount ?? 1) > 1
                          ? ` · ${t("cards.detail.installment", { number: item.installmentNumber, count: item.installmentCount })} · ${
                              item.installmentNumber === item.installmentCount
                                ? t("invoices.lastInstallment")
                                : t("invoices.installmentsLeft", { count: (item.installmentCount ?? 0) - (item.installmentNumber ?? 0) })
                            }`
                          : ""}
                      </span>
                    ) : null}
                  </span>
                  <Money
                    amount={item.amount}
                    tone={item.type === "CARD_PAYMENT" ? "positive" : "plain"}
                    sign={item.type === "CARD_PAYMENT" ? "-" : undefined}
                    className={`text-sm ${item.status === "PENDING" ? "opacity-70" : ""}`}
                  />
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        );
      })}
    </div>
  );
}
