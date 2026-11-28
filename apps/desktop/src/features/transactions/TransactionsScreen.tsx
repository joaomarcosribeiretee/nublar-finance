import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { t, type TranslationKey } from "@/i18n";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { ErrorNote, PageHeader } from "@/components/Page";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { Money } from "@/components/Money";
import { Segmented } from "@/components/Segmented";
import { errorMessage } from "@/lib/api";
import { plotValue } from "@/lib/chart";
import { useFormatMoney, useHideValues } from "@/hooks/useHideValues";
import { currentMonth, shiftMonth } from "@/lib/dates";
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
import { RecurringScreen } from "@/features/recurring/RecurringScreen";
import { categoryLabel } from "@/lib/categories";
import { HIDDEN_MONEY, formatCompactMoney, formatDate, formatMonth } from "@/lib/format";

type Group = { key: string; date: string; title: string; items: Transaction[]; invoice: boolean };

type Filter = "ALL" | EntryType;
export type TransactionFilter = { type?: Filter; categoryId?: string | null; categoryName?: string };

const filters: { value: Filter; label: TranslationKey }[] = [
  { value: "ALL", label: "transactions.filters.all" },
  { value: "EXPENSE", label: "transactions.filters.expense" },
  { value: "INCOME", label: "transactions.filters.income" },
  { value: "TRANSFER", label: "transactions.filters.transfer" },
];

/** What happened, what is coming, and the rules that make what is coming. */
type View = "month" | "upcoming" | "recurring";

export function TransactionsScreen({
  month,
  onMonthChange,
  onNew,
  onEdit,
  initialFilter,
}: {
  month: string;
  onMonthChange: (month: string) => void;
  onNew: () => void;
  onEdit: (transaction: Transaction) => void;
  initialFilter?: TransactionFilter;
}) {
  const { t } = useTranslation();
  const transactions = useTransactions(month);
  const summary = useSummary(month);
  const [filter, setFilter] = useState<Filter>(initialFilter?.type ?? "ALL");
  const [category, setCategory] = useState(initialFilter);
  const [query, setQuery] = useState("");
  const [importing, setImporting] = useState(false);

  const [view, setView] = useState<View>("month");

  const groups = useMemo(
    () => groupEntries(matching(transactions.data ?? [], filter, query).filter((item) =>
      category?.categoryId === undefined || (item.category?.id ?? null) === category.categoryId
    ), category?.categoryId === undefined ? summary.data?.invoices ?? [] : []),
    [transactions.data, summary.data, filter, query, category],
  );

  const hasAny = (transactions.data?.length ?? 0) > 0;

  return (
    <section className="animate-enter">
      <PageHeader
        title={t("transactions.title")}
        actions={
          <>
            <Button variant="ghost" onClick={() => setImporting(true)}>
              <Icon name="upload" size={15} />
              {t("transactions.import")}
            </Button>
            <Button variant="primary" onClick={onNew}>
              <Icon name="plus" size={16} />
              {t("transactions.newShort")}
              <kbd className="ml-1 hidden rounded bg-accent-fg/15 px-1.5 text-[10px] hoverable:inline">N</kbd>
            </Button>
          </>
        }
      />

      <div className="mt-6">
        <Segmented
          label={t("transactions.views.label")}
          value={view}
          options={[
            { value: "month" as const, label: t("transactions.views.month") },
            { value: "upcoming" as const, label: t("transactions.views.upcoming") },
            { value: "recurring" as const, label: t("transactions.views.recurring") },
          ]}
          onChange={(next) => { setView(next); if (next !== "month") setCategory(undefined); }}
        />
      </div>

      {view === "recurring" ? (
        <div className="mt-6">
          <RecurringScreen />
        </div>
      ) : null}

      {view === "month" ? (
        <>
          <MonthStrip month={month} onChange={onMonthChange} />
          <div className="mt-4 grid gap-px overflow-hidden rounded-2xl border border-line bg-line @lg:grid-cols-3">
            <MiniStat label={t("transactions.filters.income")} amount={summary.data?.income} tone="positive" />
            <MiniStat label={t("transactions.filters.expense")} amount={summary.data?.expense} tone="negative" />
            <MiniStat label={t("transactions.result")} amount={summary.data?.result} tone="auto" />
          </div>
        </>
      ) : null}

      {view === "recurring" ? null : (
      <div className="filter-toolbar mt-6 flex flex-wrap items-center gap-3">
        <Segmented size="sm" label={t("transactions.filters.label")} value={filter} options={filters.map((item) => ({ ...item, label: t(item.label) }))} onChange={setFilter} />
        <div className="relative w-full @lg:ml-auto @lg:w-64">
          <Icon
            name="search"
            size={15}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint"
          />
          <input
            type="search"
            aria-label={t("transactions.search.label")}
            className="h-10 w-full rounded-xl border border-line bg-surface-2 pr-3 pl-9 text-base outline-none transition-colors placeholder:text-faint hover:border-line-strong focus:border-accent/60 sm:h-9 sm:text-sm"
            placeholder={t("transactions.search.placeholder")}
            value={query}
            maxLength={80}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>
      )}
      {category?.categoryId !== undefined ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-muted">
          {t("transactions.filter.category", { name: category.categoryName ? categoryLabel(category.categoryName) : t("transactions.noCategory") })}
          <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => setCategory(undefined)}>{t("transactions.filter.clear")} <Icon name="close" size={13} /></Button>
        </div>
      ) : null}

      {view === "recurring" ? null : view === "upcoming" ? (
        <UpcomingMonths from={currentMonth()} filter={filter} query={query} onEdit={onEdit} />
      ) : (
        <div className="mt-6">
          {transactions.isError ? (
            <ErrorNote>{errorMessage(transactions.error)}</ErrorNote>
          ) : transactions.isPending ? (
            <ListSkeleton />
          ) : !hasAny ? (
            <EmptyState
              icon="list"
              title={t("transactions.empty.title", { month: formatMonth(month).toLowerCase() })}
              description={t("transactions.empty.description")}
              action={
                <Button variant="primary" onClick={onNew}>
                  <Icon name="plus" size={16} />
                  {t("transactions.new")}
                </Button>
              }
            />
          ) : groups.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">
              {t("transactions.empty.filtered")}
            </p>
          ) : (
            <GroupList groups={groups} onEdit={onEdit} dim={transactions.isPlaceholderData} />
          )}
        </div>
      )}
      <Modal open={importing} onClose={() => setImporting(false)} title={t("transactions.import")} width={820}>
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
      transaction.category ? categoryLabel(transaction.category.name) : undefined,
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
    title: formatDate(date, "weekday"),
    items,
    invoice: false,
  }));
  for (const [cardId, items] of byCard) {
    const dueDate = invoices.find((entry) => entry.card.id === cardId)?.dueDate ?? items[0].date;
    result.push({
      key: `invoice:${cardId}`,
      date: dueDate,
      title: t("transactions.group.invoice", { name: items[0].card?.name ?? "", date: formatDate(dueDate) }),
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
    <div className={`space-y-5 transition-opacity duration-(--dur-base) ${dim ? "opacity-50" : ""}`}>
      {groups.map((group) => (
        <div
          key={group.key}
          className={group.invoice ? "rounded-2xl border border-line bg-surface/50 py-2" : ""}
        >
          <div className="flex items-center justify-between gap-3 px-3 pb-1">
            <h3 className="flex min-w-0 items-center gap-1.5 text-xs font-medium tracking-wide text-muted uppercase">
              {group.invoice ? <Icon name="receipt" size={13} /> : null}
              <span className="truncate">{group.title}</span>
            </h3>
            <DayNet amount={dayNet(group.items, includePending)} />
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
  const { t } = useTranslation();
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
              aria-expanded={expanded}
              className="flex w-full items-center gap-3 px-4 py-4 text-left @2xl:gap-4 @2xl:px-5"
            >
              <Icon
                name="chevronRight"
                size={15}
                className={`text-muted transition-transform ${expanded ? "rotate-90" : ""}`}
              />
              <span className="flex-1 truncate text-sm">{formatMonth(month)}</span>
              {totals ? (
                <span className="flex items-center gap-5 text-xs">
                  <span className="hidden text-muted @2xl:inline">
                    {t("transactions.filters.income")} <Money amount={totals.income} tone="positive" />
                  </span>
                  <span className="hidden text-muted @2xl:inline">
                    {t("transactions.filters.expense")} <Money amount={totals.expense} />
                  </span>
                  <span className="text-right @2xl:w-28">
                    <Money amount={totals.result} tone="auto" />
                  </span>
                </span>
              ) : (
                <span className="skeleton h-4 w-24 @2xl:w-48" />
              )}
            </button>
            {expanded ? (
              <div className="animate-enter border-t border-line px-2 pt-4 pb-3">
                {lists[index].isError ? (
                  <div className="px-3">
                    <ErrorNote>{errorMessage(lists[index].error)}</ErrorNote>
                  </div>
                ) : !list ? (
                  <ListSkeleton rows={3} />
                ) : groups.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted">{t("transactions.upcoming.empty")}</p>
                ) : (
                  <GroupList groups={groups} onEdit={onEdit} includePending />
                )}
              </div>
            ) : null}
          </article>
        );
      })}
      <p className="px-1 text-xs text-faint">
        {t("transactions.upcoming.note")}
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

/** A day of transfers only nets to nothing, and zero is not worth a line. */
function DayNet({ amount }: { amount: string }) {
  return amount === "0" ? null : <Money amount={amount} tone="auto" className="shrink-0 text-xs" />;
}

/** How many months the strip shows at once. */
const STRIP_MONTHS = 6;

/**
 * Recent months side by side, each with how it ended, so going back is one
 * tap and a bad month is visible before opening it. The arrows page the
 * window; the future lives in "Próximos meses".
 */
function MonthStrip({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  const { t } = useTranslation();
  const money = useFormatMoney();
  const hideValues = useHideValues();
  const today = currentMonth();
  const [last, setEnd] = useState(() => (month > today ? month : today));
  // A month chosen elsewhere (the top bar, Análises) that falls outside the
  // window brings the window along; paging with the arrows does not.
  const [seen, setSeen] = useState(month);
  if (month !== seen) {
    setSeen(month);
    if (month > last || month <= shiftMonth(last, -STRIP_MONTHS)) setEnd(month);
  }
  const months = Array.from({ length: STRIP_MONTHS }, (_, index) => shiftMonth(last, index - STRIP_MONTHS + 1));
  const summaries = useSummariesFor(months);
  const selected = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    selected.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [month]);

  const arrow =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-foreground";

  return (
    <div className="mt-4 flex items-center gap-1">
      <button type="button" aria-label={t("transactions.strip.previous")} className={arrow} onClick={() => setEnd(shiftMonth(last, -STRIP_MONTHS))}>
        <Icon name="chevronLeft" size={16} />
      </button>
      <div role="group" aria-label={t("transactions.strip.choose")} className="scroll-quiet flex min-w-0 flex-1 gap-1 overflow-x-auto">
        {months.map((item, index) => {
          const active = item === month;
          const result = summaries[index].data?.result;
          // A year label where it changes, so "jan" never reads as this year's.
          const showYear = index === 0 || item.endsWith("-01");
          return (
            <button
              key={item}
              ref={active ? selected : undefined}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(item)}
              className={`flex min-w-[4.75rem] flex-1 flex-col items-center gap-0.5 rounded-xl border px-2 py-2 transition-colors ${
                active ? "border-accent/50 bg-accent/10" : "border-transparent hover:bg-hover"
              }`}
            >
              <span className={`text-sm ${active ? "text-foreground" : "text-muted"}`}>
                {formatMonth(item, "short")}
                {showYear ? <span className="text-faint"> {item.slice(2, 4)}</span> : null}
                {item === today ? <span className="sr-only"> {t("transactions.strip.currentMarker")}</span> : null}
              </span>
              {result === undefined ? (
                summaries[index].isError ? (
                  <span className="text-[11px] text-faint">—</span>
                ) : (
                  <span className="skeleton h-3 w-14" />
                )
              ) : result === "0" ? (
                <span className="text-[11px] text-faint">{t("transactions.strip.noData")}</span>
              ) : (
                // Short form: the exact number is in the totals right below.
                <span
                  title={money(result)}
                  className={`text-[11px] whitespace-nowrap tabular ${result.startsWith("-") ? "text-negative" : "text-positive"}`}
                >
                  {result.startsWith("-") ? "−" : "+"}
                  {hideValues ? HIDDEN_MONEY : formatCompactMoney(Math.abs(plotValue(result)))}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {last < today ? (
        <button type="button" aria-label={t("transactions.strip.next")} className={arrow} onClick={() => setEnd(shiftMonth(last, STRIP_MONTHS) > today ? today : shiftMonth(last, STRIP_MONTHS))}>
          <Icon name="chevronRight" size={16} />
        </button>
      ) : (
        <span className="w-9 shrink-0" />
      )}
      {month !== today ? (
        <Button variant="ghost" className="h-9 px-3 text-xs text-accent" onClick={() => { setEnd(today); onChange(today); }}>
          {t("transactions.strip.current")}
        </Button>
      ) : null}
    </div>
  );
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
    <div className="flex items-center justify-between gap-3 bg-surface px-4 py-3 @lg:block @lg:px-5 @lg:py-4">
      <p className="text-xs text-muted">{label}</p>
      <div className="text-base @lg:mt-1 @lg:text-lg">
        {amount === undefined ? (
          <div className="skeleton h-6 w-28" />
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
          <div className="skeleton h-9 w-9 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="skeleton h-3 w-40" />
            <div className="skeleton h-2.5 w-24" />
          </div>
          <div className="skeleton h-3 w-20" />
        </div>
      ))}
    </div>
  );
}
