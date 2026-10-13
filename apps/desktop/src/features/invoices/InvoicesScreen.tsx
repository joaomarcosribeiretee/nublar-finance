import { useState } from "react";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { Money } from "@/components/Money";
import { PageHeader, Panel, ProgressBar } from "@/components/Page";
import { Segmented } from "@/components/Segmented";
import { PayForm, StatusPill } from "@/features/cards/CardsScreen";
import { errorMessage } from "@/lib/api";
import { monthLabel, shiftMonth, shortDate, shortMonthLabel, todayLocal } from "@/lib/dates";
import { percentOf } from "@/lib/money";
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
}: { cardId?: string | null } & Actions) {
  const cards = useCards();
  const [cardId, setCardId] = useState(initialCard ?? "");
  const list = cards.data ?? [];
  const card = list.find((item) => item.id === cardId) ?? list[0] ?? null;

  return (
    <section className="animate-enter">
      <PageHeader
        eyebrow="Cartão de crédito"
        title="Faturas"
        actions={
          list.length > 1 && card ? (
            list.length <= 4 ? (
              <Segmented
                size="sm"
                value={card.id}
                options={list.map((item) => ({ value: item.id, label: item.name }))}
                onChange={setCardId}
              />
            ) : (
              <select
                className="rounded-xl border border-line bg-surface-2 px-3 py-1.5 text-sm"
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
          <p className="text-sm text-negative">{errorMessage(cards.error)}</p>
        ) : cards.isPending ? (
          <div className="skeleton h-64 rounded-3xl" />
        ) : !card ? (
          <EmptyState
            icon="receipt"
            title="Nenhum cartão"
            description="Cadastre um cartão em Cartões para acompanhar as faturas aqui."
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
    <div className={`space-y-4 transition-opacity ${invoice.isPlaceholderData ? "opacity-60" : ""}`}>
      <Panel>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Fatura anterior"
              className="rounded-lg p-1.5 text-muted hover:bg-white/5 hover:text-foreground"
              onClick={() => goTo(shiftMonth(month, -1))}
            >
              <Icon name="chevronLeft" size={16} />
            </button>
            <span className="w-44 text-center text-sm">Fatura de {monthLabel(month).toLowerCase()}</span>
            <button
              type="button"
              aria-label="Próxima fatura"
              className="rounded-lg p-1.5 text-muted hover:bg-white/5 hover:text-foreground"
              onClick={() => goTo(shiftMonth(month, 1))}
            >
              <Icon name="chevronRight" size={16} />
            </button>
          </div>
          {data ? <StatusPill status={data.status} /> : null}
        </div>

        <div className="mt-6 flex items-end justify-between gap-6">
          <div>
            <p className="text-xs text-muted">{paid ? "Fatura paga" : "A pagar"}</p>
            <p className={`mt-1 flex items-center gap-2 font-display text-4xl tracking-tight ${paid ? "text-positive" : ""}`}>
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
                  ? `Paga em ${shortDate(lastPayment.date)}${lastPayment.account ? ` com ${lastPayment.account.name}` : ""}`
                  : `Fecha em ${shortDate(data.closingDate)} · vence em ${shortDate(data.dueDate)}`}
              </p>
            ) : null}
            {partlyPaid ? (
              <p className="mt-1 text-xs text-gold">
                Já pago <Money amount={data.paid} /> de <Money amount={data.total} />
              </p>
            ) : null}
          </div>
          {data && !paid && BigInt(data.remaining) > 0n && !paying ? (
            <Button variant="primary" onClick={() => setPaying(true)}>
              {partlyPaid ? "Pagar o restante" : "Pagar fatura"}
            </Button>
          ) : null}
          {paid ? (
            <Button variant="ghost" onClick={() => goTo(shiftMonth(month, 1))}>
              Próxima fatura
              <Icon name="chevronRight" size={14} />
            </Button>
          ) : null}
        </div>

        <dl className="mt-6 grid grid-cols-4 gap-px overflow-hidden rounded-2xl border border-line bg-line">
          {[
            { label: "Total", value: data?.total },
            { label: "Pago", value: data?.paid },
            { label: "Restante", value: data?.remaining },
            { label: "Previsto", value: data?.scheduled, hint: "Recorrências ainda não confirmadas" },
          ].map((stat) => (
            <div key={stat.label} className="bg-surface-2 px-4 py-3" title={stat.hint}>
              <dt className="text-xs text-muted">{stat.label}</dt>
              <dd className="mt-1">
                {stat.value === undefined ? (
                  <span className="skeleton block h-5 w-20" />
                ) : (
                  <Money amount={stat.value} />
                )}
              </dd>
            </div>
          ))}
        </dl>

        {paying && data ? (
          <div className="mt-4">
            <PayForm card={card} month={month} remaining={data.remaining} onDone={() => setPaying(false)} />
          </div>
        ) : null}

        <div className="mt-6 space-y-2">
          <ProgressBar value={used} tone={used > 90 ? "negative" : "gold"} />
          <p className="flex justify-between text-[11px] text-faint">
            <span>
              Usado <Money amount={card.debt} /> · disponível <Money amount={card.available} />
            </span>
            <span>
              Limite <Money amount={card.limit} />
            </span>
          </p>
        </div>
      </Panel>

      {data ? <Timeline invoice={data} onPick={setMonth} /> : null}

      {data ? (
        <>
          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-faint">
              {data.items.length > 0 ? "Clique em um item para editar." : ""}
            </p>
            <Button
              variant="ghost"
              onClick={() => onAdd({ cardId: card.id, date: purchaseDateFor(data) })}
            >
              <Icon name="plus" size={15} />
              Adicionar compra
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
  const max = invoice.timeline.reduce((top, item) => {
    const value = BigInt(item.total);
    return value > top ? value : top;
  }, 0n);

  return (
    <Panel title="Próximas e anteriores" subtitle="Inclui parcelas e recorrências já previstas">
      <div className="flex h-28 items-end gap-2">
        {invoice.timeline.map((item) => {
          const height = max > 0n ? Number((BigInt(item.total) * 100n) / max) : 0;
          const active = item.month === invoice.month;
          return (
            <button
              key={item.month}
              type="button"
              onClick={() => onPick(item.month)}
              className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5"
              title={`${monthLabel(item.month)}`}
            >
              <span
                className={`w-full rounded-md transition-all duration-500 ${
                  active ? "bg-gold" : item.status === "PAID" ? "bg-positive/30" : "bg-white/10 group-hover:bg-white/20"
                }`}
                style={{ height: `${Math.max(height, item.total === "0" ? 2 : 6)}%` }}
              />
              <span className={`text-[11px] ${active ? "text-foreground" : "text-faint"}`}>
                {shortMonthLabel(item.month)}
              </span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

const groups: { key: string; title: string; match: (item: InvoiceItem) => boolean }[] = [
  {
    key: "installments",
    title: "Parcelas",
    match: (item) => item.type === "EXPENSE" && (item.installmentCount ?? 1) > 1,
  },
  {
    key: "fixed",
    title: "Assinaturas e fixos",
    match: (item) => item.type === "EXPENSE" && item.recurring && (item.installmentCount ?? 1) <= 1,
  },
  {
    key: "purchases",
    title: "Compras",
    match: (item) => item.type === "EXPENSE" && !item.recurring && (item.installmentCount ?? 1) <= 1,
  },
  { key: "payments", title: "Pagamentos", match: (item) => item.type === "CARD_PAYMENT" },
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
  if (items.length === 0) {
    return (
      <Panel>
        <p className="py-8 text-center text-sm text-faint">Nada nesta fatura.</p>
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
            title={`${group.title} · ${rows.length}`}
            actions={<Money amount={total.toString()} className="text-sm text-muted" />}
          >
            <ul>
              {rows.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onEdit(item)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/[0.035]"
                  >
                  <span className="w-14 shrink-0 text-xs text-faint">{shortDate(item.date)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 truncate text-sm">
                      {item.type === "CARD_PAYMENT"
                        ? `Pagamento · ${item.account?.name ?? ""}`
                        : item.description || item.category?.name}
                      {item.status === "PENDING" ? (
                        <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] text-muted">previsto</span>
                      ) : null}
                    </span>
                    {item.type === "EXPENSE" ? (
                      <span className="block truncate text-xs text-muted">
                        {item.category?.name}
                        {(item.installmentCount ?? 1) > 1
                          ? ` · parcela ${item.installmentNumber}/${item.installmentCount}${
                              item.installmentNumber === item.installmentCount
                                ? " · última"
                                : ` · faltam ${(item.installmentCount ?? 0) - (item.installmentNumber ?? 0)}`
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
