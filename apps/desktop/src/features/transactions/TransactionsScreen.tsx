import { useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/Page";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { Money } from "@/components/Money";
import { Segmented } from "@/components/Segmented";
import { errorMessage } from "@/lib/api";
import { dayLabel, monthLabel } from "@/lib/dates";
import { useSummary, useTransactions, type EntryType, type Transaction } from "@/lib/queries";
import { TransactionRow } from "./TransactionRow";
import { ImportFlow } from "@/features/imports/ImportFlow";

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

  const groups = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("pt-BR");
    const visible = (transactions.data ?? []).filter((transaction) => {
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

    const byDay = new Map<string, Transaction[]>();
    for (const transaction of visible) {
      byDay.set(transaction.date, [...(byDay.get(transaction.date) ?? []), transaction]);
    }
    return [...byDay.entries()];
  }, [transactions.data, filter, query]);

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

      <div className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-line bg-line">
        <MiniStat label="Receitas" amount={summary.data?.income} tone="positive" />
        <MiniStat label="Despesas" amount={summary.data?.expense} tone="negative" />
        <MiniStat label="Resultado" amount={summary.data?.result} tone="auto" />
      </div>

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
          <div
            className={`space-y-5 transition-opacity ${transactions.isPlaceholderData ? "opacity-50" : ""}`}
          >
            {groups.map(([date, items]) => (
              <div key={date}>
                <div className="flex items-center justify-between px-3 pb-1">
                  <h3 className="text-xs font-medium tracking-wide text-muted uppercase">
                    {dayLabel(date)}
                  </h3>
                  <Money amount={dayNet(items)} tone="auto" className="text-xs" />
                </div>
                <ul>
                  {items.map((transaction) => (
                    <TransactionRow
                      key={transaction.id}
                      transaction={transaction}
                      onOpen={onEdit}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
      <Modal open={importing} onClose={() => setImporting(false)} title="Importar extrato" width={820}>
        {importing ? <ImportFlow onDone={() => setImporting(false)} /> : null}
      </Modal>
    </section>
  );
}

/**
 * Day subtotal for display only. Transfers and card payments do not change
 * what the user has, and pending entries have not happened yet.
 */
function dayNet(items: Transaction[]): string {
  let total = 0n;
  for (const item of items) {
    if (item.status === "PENDING") continue;
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
