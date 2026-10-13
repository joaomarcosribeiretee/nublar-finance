import { useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/Page";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { Money } from "@/components/Money";
import { Segmented } from "@/components/Segmented";
import { errorMessage } from "@/lib/api";
import { dayLabel, monthLabel, shiftMonth, shortDate } from "@/lib/dates";
import {
  useSummariesFor,
  useSummary,
  useTransactions,
  useTransactionsFor,
  type EntryType,
  type Summary,
  type Transaction,
} from "@/lib/queries";
import { TransactionRow } from "./TransactionRow";
import { ImportFlow } from "@/features/imports/ImportFlow";

type Group = { key: string; date: string; title: string; items: Transaction[]; invoice: boolean };

type Filter = "ALL" | EntryType;

const filters: { value: Filter; label: string }[] = [
  { value: "ALL", label: "Todos" },
  { value: "EXPENSE", label: "Despesas" },
  { value: "INCOME", label: "Receitas" },
  { value: "TRANSFER", label: "Transferências" },
];

export function TransactionsScreen({
  month,
  onNew,
  onEdit,
}: {
  month: string;
  onNew: () => void;
  onEdit: (transaction: Transaction) => void;
}) {
  const transactions = useTransactions(month);
  const summary = useSummary(month);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
  const [importing, setImporting] = useState(false);

  const [view, setView] = useState<"month" | "upcoming">("month");

  const groups = useMemo(
    () => groupEntries(matching(transactions.data ?? [], filter, query), summary.data?.invoices ?? []),
    [transactions.data, summary.data, filter, query],
  );

  const hasAny = (transactions.data?.length ?? 0) > 0;

  return (
    <section className="animate-enter">
      <PageHeader
        eyebrow={monthLabel(month)}
        title="Lançamentos"
        actions={
          <>
            <Button variant="ghost" onClick={() => setImporting(true)}>
              <Icon name="upload" size={15} />
              Importar extrato
            </Button>
            <Button variant="primary" onClick={onNew}>
              <Icon name="plus" size={16} />
              Novo
              <kbd className="ml-1 rounded bg-black/15 px-1.5 text-[10px]">N</kbd>
            </Button>
          </>
        }
      />

      <div className="mt-6">
        <Segmented
          size="sm"
          value={view}
          options={[
            { value: "month" as const, label: monthLabel(month) },
            { value: "upcoming" as const, label: "Próximos meses" },
          ]}
          onChange={setView}
        />
      </div>

      {view === "month" ? (
        <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-line bg-line">
          <MiniStat label="Receitas" amount={summary.data?.income} tone="positive" />
          <MiniStat label="Despesas" amount={summary.data?.expense} tone="negative" />
          <MiniStat label="Resultado" amount={summary.data?.result} tone="auto" />
        </div>
      ) : null}

      <div className="mt-6 flex items-center gap-3">
        <Segmented size="sm" value={filter} options={filters} onChange={setFilter} />
        <div className="relative ml-auto w-64">
          <Icon
            name="search"
            size={15}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint"
          />
          <input
            className="h-9 w-full rounded-xl border border-line bg-surface-2 pr-3 pl-9 text-sm outline-none transition-colors placeholder:text-faint focus:border-gold/60"
            placeholder="Buscar"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>

      {view === "upcoming" ? (
        <UpcomingMonths from={month} filter={filter} query={query} onEdit={onEdit} />
      ) : (
        <div className="mt-6">
          {transactions.isError ? (
            <p className="text-sm text-negative">{errorMessage(transactions.error)}</p>
          ) : transactions.isPending ? (
            <ListSkeleton />
          ) : !hasAny ? (
            <EmptyState
              icon="list"
              title={`Nada em ${monthLabel(month).toLowerCase()}`}
              description="Registre receitas, despesas e transferências para acompanhar para onde o dinheiro vai."
              action={
                <Button variant="primary" onClick={onNew}>
                  <Icon name="plus" size={16} />
                  Novo lançamento
                </Button>
              }
            />
          ) : groups.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">
              Nenhum lançamento com esse filtro.
            </p>
          ) : (
            <GroupList groups={groups} onEdit={onEdit} dim={transactions.isPlaceholderData} />
          )}
        </div>
      )}
      <Modal open={importing} onClose={() => setImporting(false)} title="Importar extrato" width={820}>
        {importing ? <ImportFlow onDone={() => setImporting(false)} /> : null}
      </Modal>
    </section>
  );
}

function matching(list: Transaction[], filter: Filter, query: string): Transaction[] {
  const needle = query.trim().toLocaleLowerCase("pt-BR");
  return list.filter((transaction) => {
    if (filter !== "ALL" && transaction.type !== filter) {
      return false;
    }
    if (!needle) {
      return true;
    }
    return [
      transaction.description,
      transaction.category?.name,
      transaction.account?.name,
      transaction.destinationAccount?.name,
      transaction.card?.name,
    ].some((text) => text?.toLocaleLowerCase("pt-BR").includes(needle));
  });
}

/**
 * Days, newest first. Card expenses count in the invoice month, so they sit
 * together in their invoice (placed on its due date) instead of on purchase days.
 */
function groupEntries(list: Transaction[], invoices: Summary["invoices"]): Group[] {
  const byDay = new Map<string, Transaction[]>();
  const byCard = new Map<string, Transaction[]>();
  for (const transaction of list) {
    if (transaction.card && transaction.type === "EXPENSE") {
      byCard.set(transaction.card.id, [...(byCard.get(transaction.card.id) ?? []), transaction]);
    } else {
      byDay.set(transaction.date, [...(byDay.get(transaction.date) ?? []), transaction]);
    }
  }
  const result: Group[] = [...byDay.entries()].map(([date, items]) => ({
    key: date,
    date,
    title: dayLabel(date),
    items,
    invoice: false,
  }));
  for (const [cardId, items] of byCard) {
    const dueDate = invoices.find((entry) => entry.card.id === cardId)?.dueDate ?? items[0].date;
    result.push({
      key: `invoice:${cardId}`,
      date: dueDate,
      title: `Fatura ${items[0].card?.name ?? ""} · vence ${shortDate(dueDate)}`,
      items,
      invoice: true,
    });
  }
  return result.sort((a, b) => b.date.localeCompare(a.date));
}

function GroupList({
  groups,
  onEdit,
  dim,
  includePending,
}: {
  groups: Group[];
  onEdit: (transaction: Transaction) => void;
  dim?: boolean;
  /** Future months are mostly scheduled entries: count them in subtotals. */
  includePending?: boolean;
}) {
  return (
    <div className={`space-y-5 transition-opacity ${dim ? "opacity-50" : ""}`}>
      {groups.map((group) => (
        <div
          key={group.key}
          className={group.invoice ? "rounded-2xl border border-line bg-surface/50 py-2" : ""}
        >
          <div className="flex items-center justify-between px-3 pb-1">
            <h3 className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted uppercase">
              {group.invoice ? <Icon name="receipt" size={13} /> : null}
              {group.title}
            </h3>
            <Money amount={dayNet(group.items, includePending)} tone="auto" className="text-xs" />
          </div>
          <ul>
            {group.items.map((transaction) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                onOpen={onEdit}
                showDate={group.invoice}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

const UPCOMING_MONTHS = 6;

/** The coming months stacked, each with what is already scheduled in it. */
function UpcomingMonths({
  from,
  filter,
  query,
  onEdit,
}: {
  from: string;
  filter: Filter;
  query: string;
  onEdit: (transaction: Transaction) => void;
}) {
  const months = Array.from({ length: UPCOMING_MONTHS }, (_, index) => shiftMonth(from, index + 1));
  const lists = useTransactionsFor(months);
  const summaries = useSummariesFor(months);
  const [open, setOpen] = useState<string | null>(months[0]);

  return (
    <div className="mt-6 space-y-3">
      {months.map((month, index) => {
        const list = lists[index].data;
        const totals = list ? scheduledTotals(list) : null;
        const groups = list
          ? groupEntries(matching(list, filter, query), summaries[index].data?.invoices ?? [])
          : [];
        const expanded = open === month;
        return (
          <article key={month} className="rounded-3xl border border-line bg-surface">
            <button
              type="button"
              onClick={() => setOpen(expanded ? null : month)}
              className="flex w-full items-center gap-4 px-5 py-4 text-left"
            >
              <Icon
                name="chevronRight"
                size={15}
                className={`text-muted transition-transform ${expanded ? "rotate-90" : ""}`}
              />
              <span className="flex-1 text-sm">{monthLabel(month)}</span>
              {totals ? (
                <span className="flex items-center gap-5 text-xs">
                  <span className="text-muted">
                    Receitas <Money amount={totals.income} tone="positive" />
                  </span>
                  <span className="text-muted">
                    Despesas <Money amount={totals.expense} />
                  </span>
                  <span className="w-28 text-right">
                    <Money amount={totals.result} tone="auto" />
                  </span>
                </span>
              ) : (
                <span className="skeleton h-4 w-48" />
              )}
            </button>
            {expanded ? (
              <div className="animate-enter border-t border-line px-2 pt-4 pb-3">
                {lists[index].isError ? (
                  <p className="px-3 text-sm text-negative">{errorMessage(lists[index].error)}</p>
                ) : !list ? (
                  <ListSkeleton rows={3} />
                ) : groups.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted">Nada previsto neste mês.</p>
                ) : (
                  <GroupList groups={groups} onEdit={onEdit} includePending />
                )}
              </div>
            ) : null}
          </article>
        );
      })}
      <p className="px-1 text-xs text-faint">
        Previsto: recorrências, parcelas e compras já lançadas, confirmadas ou não. Meses pulados ficam fora.
      </p>
    </div>
  );
}

/** Income and expense of a month counting what is still scheduled. */
function scheduledTotals(list: Transaction[]) {
  let income = 0n;
  let expense = 0n;
  for (const item of list) {
    if (item.type === "INCOME") income += BigInt(item.amount);
    if (item.type === "EXPENSE") expense += BigInt(item.amount);
  }
  return {
    income: income.toString(),
    expense: expense.toString(),
    result: (income - expense).toString(),
  };
}

/**
 * Day subtotal for display only. Transfers and card payments do not change
 * what the user has, and pending entries have not happened yet.
 */
function dayNet(items: Transaction[], includePending = false): string {
  let total = 0n;
  for (const item of items) {
    if (item.status === "PENDING" && !includePending) continue;
    if (item.type === "INCOME") total += BigInt(item.amount);
    if (item.type === "EXPENSE") total -= BigInt(item.amount);
  }
  return total.toString();
}

function MiniStat({
  label,
  amount,
  tone,
}: {
  label: string;
  amount: string | undefined;
  tone: "positive" | "negative" | "auto";
}) {
  return (
    <div className="bg-surface px-5 py-4">
      <p className="text-xs text-muted">{label}</p>
      <div className="mt-1 text-lg">
        {amount === undefined ? (
          <div className="skeleton mt-1 h-6 w-28" />
        ) : (
          <Money amount={amount} tone={tone} />
        )}
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 px-3">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 py-2">
          <div className="skeleton h-9 w-9 rounded-xl" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3 w-40" />
            <div className="skeleton h-2.5 w-24" />
          </div>
          <div className="skeleton h-3 w-20" />
        </div>
      ))}
    </div>
  );
}
