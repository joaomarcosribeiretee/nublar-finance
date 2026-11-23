import type { ReactNode } from "react";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { Money } from "@/components/Money";
import { ErrorNote, PageHeader, Panel, ProgressBar } from "@/components/Page";
import { errorMessage } from "@/lib/api";
import { monthLabel, shortDate, shortMonthLabel, shiftMonth } from "@/lib/dates";
import { invoiceStatusLabels } from "@/lib/labels";
import { formatMinorUnits, percentOf } from "@/lib/money";
import {
  useAccounts,
  useSummary,
  useTransactions,
  type Summary,
  type Transaction,
} from "@/lib/queries";
import { NetWorthSparkline } from "./NetWorthSparkline";
import { ListSkeleton } from "@/features/transactions/TransactionsScreen";
import { TransactionRow } from "@/features/transactions/TransactionRow";
import { BudgetOverview } from "@/features/planning/BudgetOverview";
import type { TransactionFilter } from "@/features/transactions/TransactionsScreen";

export function HomeScreen({
  month,
  onNew,
  onEdit,
  onSeeAll,
  onCreateAccount,
  onCards,
  onAnalytics,
  onBudgets,
}: {
  month: string;
  onNew: () => void;
  onEdit: (transaction: Transaction) => void;
  onSeeAll: (filter?: TransactionFilter) => void;
  onCreateAccount: () => void;
  onCards: (cardId?: string) => void;
  onAnalytics: () => void;
  onBudgets: () => void;
}) {
  const summary = useSummary(month);
  const transactions = useTransactions(month);
  const accounts = useAccounts();
  const data = summary.data;
  const previousLabel = shortMonthLabel(shiftMonth(month, -1));
  const failure = accounts.error ?? summary.error;

  if (failure && (!data || !accounts.data)) {
    return <section className="space-y-6"><PageHeader title="Início" /><ErrorNote>{errorMessage(failure)}</ErrorNote><Button onClick={() => { void accounts.refetch(); void summary.refetch(); }}>Tentar novamente</Button></section>;
  }

  if (accounts.isSuccess && accounts.data.length === 0) {
    return (
      <section className="onboarding animate-enter">
        <p className="design-eyebrow">Um começo simples</p>
        <h1 className="mt-4 max-w-xl font-display text-4xl @2xl:text-5xl">Sua vida financeira.<br /><span className="text-accent">Agora, por inteiro.</span></h1>
        <p className="mt-5 max-w-md text-muted">
          Comece pelos lugares onde seu dinheiro está: bancos, corretoras, carteiras.
        </p>
        <div className="mt-7">
          <Button variant="primary" onClick={onCreateAccount}>
            <Icon name="plus" size={16} /> Adicionar instituição
          </Button>
          <p className="mt-3 text-sm text-muted">Escolha seu banco e adicione suas contas e cartões.</p>
        </div>
        <div className="onboarding-steps mt-9">
          <span><Icon name="bank" size={18} /> Reúna suas contas</span>
          <span><Icon name="list" size={18} /> Registre seu dia a dia</span>
          <span><Icon name="target" size={18} /> Acompanhe seus planos</span>
        </div>
      </section>
    );
  }

  const needsAttention = data ? data.pending.length > 0 || data.invoices.length > 0 : false;
  const incomeValue = data ? BigInt(data.income) : 0n;
  const expenseValue = data ? BigInt(data.expense) : 0n;
  const scale = incomeValue > expenseValue ? incomeValue : expenseValue;
  const widthOf = (value: bigint) => (scale > 0n ? Number((value * 1000n) / scale) / 10 : 0);
  const positive = data ? BigInt(data.result) >= 0n : true;

  return (
    <section className="animate-enter space-y-5 @2xl:space-y-6">
      {summary.isError ? <ErrorNote>{errorMessage(summary.error)}</ErrorNote> : null}

      <header className="month-hero">
        <div className="min-w-0">
          <p className="design-eyebrow">{monthLabel(month)}</p>
          <h1 className="mt-3 text-sm font-normal text-muted">{positive ? "Sobrou este mês" : "Faltou este mês"}</h1>
          <div className="hero-value mt-1 font-display tracking-tight">
            {data ? <Money amount={data.result.replace("-", "")} tone={positive ? "positive" : "negative"} /> : <div className="skeleton h-14 w-72" />}
          </div>
          <dl className="mt-7 space-y-4">
            <FlowBar label="Entrou" amount={data?.income} width={widthOf(incomeValue)} tone="positive" delta={<Delta current={data?.income} previous={data?.previous.income} previousLabel={previousLabel} goodWhenUp />} onOpen={() => onSeeAll({ type: "INCOME" })} />
            <FlowBar label="Saiu" amount={data?.expense} width={widthOf(expenseValue)} tone="negative" delta={<Delta current={data?.expense} previous={data?.previous.expense} previousLabel={previousLabel} goodWhenUp={false} />} onOpen={() => onSeeAll({ type: "EXPENSE" })} />
          </dl>
        </div>
        <aside className="hero-aside">
          <p className="text-sm text-muted">Patrimônio</p>
          <div className="mt-1 text-2xl @2xl:text-3xl">
            {data ? <Money amount={data.netWorth} /> : <div className="skeleton h-8 w-44" />}
          </div>
          {data ? (
            <p className="mt-1 text-xs text-muted">
              {formatMinorUnits(data.cash)} em contas
              {BigInt(data.investments) > 0n ? ` · ${formatMinorUnits(data.investments)} investidos` : ""}
            </p>
          ) : null}
          <NetWorthSparkline month={month} onOpen={onAnalytics} />
        </aside>
      </header>

      <BudgetOverview
        month={month}
        limit={6}
        onManage={onBudgets}
        onCategory={(category) => onSeeAll({ type: "EXPENSE", categoryId: category.id, categoryName: category.name })}
      />

      {needsAttention && data ? <Attention summary={data} onOpen={onEdit} onCards={onCards} /> : null}

      <div className="grid gap-4 @2xl:grid-cols-[1fr_1.15fr]">
        <Panel title="Para onde foi o dinheiro" subtitle="Maiores despesas do mês" actions={<Button variant="ghost" className="h-8 px-3 text-xs" onClick={onAnalytics}>Análises</Button>}>
          {!data ? (
            <div className="space-y-4">{[0, 1, 2].map((index) => <div key={index} className="skeleton h-8" />)}</div>
          ) : data.expensesByCategory.length === 0 ? (
            <p className="text-sm text-faint">Nenhuma despesa em {monthLabel(month).toLowerCase()}.</p>
          ) : (
            <ul className="-mx-2 space-y-1">
              {data.expensesByCategory.slice(0, 5).map((group) => {
                const share = percentOf(group.amount, data.expense);
                return (
                  <li key={group.categoryId ?? "none"}>
                    <button type="button" className="category-drill w-full rounded-xl p-2 text-left transition-colors hover:bg-hover" onClick={() => onSeeAll({ type: "EXPENSE", categoryId: group.categoryId, categoryName: group.name })} aria-label={`Ver lançamentos de ${group.name}`}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="truncate">{group.name}</span>
                        <span className="flex shrink-0 items-baseline gap-2">
                          <span className="text-xs text-faint tabular">{Math.round(share)}%</span>
                          <Money amount={group.amount} />
                        </span>
                      </div>
                      <div className="mt-2"><ProgressBar value={share} /></div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel
          flush
          title="Últimos lançamentos"
          actions={
            <>
              <Button variant="ghost" className="h-8 px-3 text-xs" onClick={() => onSeeAll()}>Ver todos</Button>
              <Button variant="ghost" className="h-8 w-8 px-0" onClick={onNew} aria-label="Novo lançamento"><Icon name="plus" size={16} /></Button>
            </>
          }
        >
          {transactions.isError ? (
            <div className="px-3 py-6"><ErrorNote>{errorMessage(transactions.error)}</ErrorNote></div>
          ) : transactions.isPending ? (
            <ListSkeleton rows={4} />
          ) : (transactions.data?.length ?? 0) === 0 ? (
            <p className="px-3 py-6 text-sm text-faint">
              Nenhum lançamento neste mês.{" "}
              <button type="button" className="text-accent hover:underline" onClick={onNew}>Registrar agora</button>
            </p>
          ) : (
            <ul>{transactions.data?.slice(0, 5).map((transaction) => <TransactionRow key={transaction.id} transaction={transaction} onOpen={onEdit} />)}</ul>
          )}
        </Panel>
      </div>
    </section>
  );
}

/** One bar per flow, same scale for both, so "saiu" reads against "entrou" at a glance. */
function FlowBar({ label, amount, width, tone, delta, onOpen }: { label: string; amount: string | undefined; width: number; tone: "positive" | "negative"; delta: ReactNode; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} aria-label={`Ver lançamentos: ${label.toLowerCase()}`} className="metric-link block w-full rounded-xl text-left">
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-sm text-muted">{label}</dt>
        <dd className="flex items-baseline gap-3">
          {delta}
          <span className="text-lg">{amount === undefined ? <span className="skeleton inline-block h-6 w-28" /> : <Money amount={amount} />}</span>
        </dd>
      </div>
      <div className="mt-2"><ProgressBar value={width} tone={tone} /></div>
    </button>
  );
}

function Delta({ current, previous, previousLabel, goodWhenUp }: { current: string | undefined; previous: string | undefined; previousLabel: string; goodWhenUp: boolean }) {
  if (current === undefined || previous === undefined || BigInt(previous) === 0n) return null;
  const change = BigInt(current) - BigInt(previous);
  if (change === 0n) return <span className="text-xs text-faint">igual a {previousLabel}</span>;
  const percent = Math.round(Number((change * 1000n) / BigInt(previous)) / 10);
  const up = change > 0n;
  return (
    <span className={`text-xs ${up === goodWhenUp ? "text-positive" : "text-negative"}`}>
      <span className="sr-only">{up ? "subiu " : "caiu "}</span>
      {up ? "+" : "−"}{Math.abs(percent)}% vs {previousLabel}
    </span>
  );
}

/** What still has to happen this month: card invoices and pending recurrences. */
function Attention({
  summary,
  onOpen,
  onCards,
}: {
  summary: Summary;
  onOpen: (transaction: Transaction) => void;
  onCards: (cardId?: string) => void;
}) {
  return (
    <article className="min-w-0 rounded-3xl border border-line bg-surface p-2 @2xl:p-3">
      <h2 className="flex items-center gap-2 px-3 pt-3 pb-2 text-sm">
        <Icon name="calendar" size={15} />
        Precisa de atenção
      </h2>
      <ul>
        {summary.invoices.map((invoice) => (
          <li key={invoice.card.id}>
            <button
              type="button"
              onClick={() => onCards(invoice.card.id)}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-hover"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <Icon name="card" size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">Fatura {invoice.card.name}</span>
                <span className="block text-xs text-muted">
                  Vence {shortDate(invoice.dueDate)} · {invoiceStatusLabels[invoice.status].toLowerCase()}
                </span>
              </span>
              <Money
                amount={invoice.status === "PAID" ? invoice.total : invoice.remaining}
                tone={invoice.status === "PAID" ? "positive" : invoice.status === "OVERDUE" ? "negative" : "plain"}
                className="text-sm"
              />
            </button>
          </li>
        ))}
        {summary.pending.map((transaction) => (
          <TransactionRow key={transaction.id} transaction={transaction} onOpen={onOpen} />
        ))}
      </ul>
    </article>
  );
}
