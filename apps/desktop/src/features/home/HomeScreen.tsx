import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { Money } from "@/components/Money";
import { errorMessage } from "@/lib/api";
import { monthLabel, shortDate, shortMonthLabel, shiftMonth } from "@/lib/dates";
import { invoiceStatusLabels } from "@/lib/labels";
import { percentOf } from "@/lib/money";
import {
  useAccounts,
  useSummary,
  useTransactions,
  type Summary,
  type Transaction,
} from "@/lib/queries";
import { NetWorthSparkline } from "./NetWorthSparkline";
import { PlanningGlance } from "./PlanningGlance";
import { ListSkeleton } from "@/features/transactions/TransactionsScreen";
import { TransactionRow } from "@/features/transactions/TransactionRow";

export function HomeScreen({
  month,
  onNew,
  onEdit,
  onSeeAll,
  onCreateAccount,
  onCards,
  onAnalytics,
  onBudgets,
  onGoals,
}: {
  month: string;
  onNew: () => void;
  onEdit: (transaction: Transaction) => void;
  onSeeAll: () => void;
  onCreateAccount: () => void;
  onCards: () => void;
  onAnalytics: () => void;
  onBudgets: () => void;
  onGoals: () => void;
}) {
  const summary = useSummary(month);
  const transactions = useTransactions(month);
  const accounts = useAccounts();
  const data = summary.data;
  const previousLabel = shortMonthLabel(shiftMonth(month, -1));

  if (accounts.isSuccess && accounts.data.length === 0) {
    return (
      <section className="animate-enter mx-auto max-w-xl pt-16">
        <h1 className="text-center font-display text-4xl">Bem-vindo ao Nublar</h1>
        <p className="mt-3 text-center text-muted">
          Comece pelos lugares onde seu dinheiro está: bancos, corretoras, carteiras.
        </p>
        <div className="mt-10">
          <EmptyState
            icon="bank"
            title="Adicione seu primeiro banco"
            description="Escolha a instituição e marque o que você tem lá: conta corrente, caixinha, cartão."
            action={
              <Button variant="primary" onClick={onCreateAccount}>
                <Icon name="plus" size={16} />
                Adicionar instituição
              </Button>
            }
          />
        </div>
      </section>
    );
  }

  return (
    <section className="animate-enter space-y-8">
      <header className="flex items-end gap-10">
        <div>
          <p className="text-sm text-muted">Patrimônio</p>
          <div className="mt-1 font-display text-5xl tracking-tight">
            {data ? <Money amount={data.netWorth} /> : <div className="skeleton h-12 w-64" />}
          </div>
        </div>
        <div className="pb-1.5">
          <p className="text-sm text-muted">Em contas</p>
          <div className="mt-1 text-xl">
            {data ? <Money amount={data.cash} /> : <div className="skeleton h-6 w-32" />}
          </div>
        </div>
        {data && BigInt(data.investments) > 0n ? (
          <div className="pb-1.5">
            <p className="text-sm text-muted">Investido</p>
            <div className="mt-1 text-xl">
              <Money amount={data.investments} />
            </div>
          </div>
        ) : null}
        <NetWorthSparkline month={month} onOpen={onAnalytics} />
        {summary.isError ? (
          <p className="pb-2 text-sm text-negative">{errorMessage(summary.error)}</p>
        ) : null}
      </header>

      <div className="grid grid-cols-3 gap-4">
        <Stat
          label="Receitas"
          amount={data?.income}
          previous={data?.previous.income}
          previousLabel={previousLabel}
          tone="positive"
          goodWhenUp
        />
        <Stat
          label="Despesas"
          amount={data?.expense}
          previous={data?.previous.expense}
          previousLabel={previousLabel}
          tone="negative"
          goodWhenUp={false}
        />
        <div className="rounded-3xl border border-line bg-surface p-5">
          <p className="text-sm text-muted">Resultado do mês</p>
          <div className="mt-2 text-2xl">
            {data ? <Money amount={data.result} tone="auto" /> : <div className="skeleton h-7 w-32" />}
          </div>
          <p className="mt-2 text-xs text-faint">
            {data
              ? BigInt(data.result) >= 0n
                ? "Você gastou menos do que recebeu."
                : "Você gastou mais do que recebeu."
              : " "}
          </p>
        </div>
      </div>

      {data && (data.pending.length > 0 || data.invoices.length > 0) ? (
        <Commitments summary={data} onOpen={onEdit} onCards={onCards} />
      ) : null}

      <div className="grid grid-cols-[1fr_1.25fr] gap-4">
        <article className="rounded-3xl border border-line bg-surface p-6">
          <h2 className="text-sm">Para onde foi o dinheiro</h2>
          {!data ? (
            <div className="mt-5 space-y-4">
              {[0, 1, 2].map((index) => (
                <div key={index} className="skeleton h-8" />
              ))}
            </div>
          ) : data.expensesByCategory.length === 0 ? (
            <p className="mt-6 text-sm text-faint">
              Nenhuma despesa em {monthLabel(month).toLowerCase()}.
            </p>
          ) : (
            <ul className="mt-5 space-y-4">
              {data.expensesByCategory.slice(0, 6).map((group) => {
                const share = percentOf(group.amount, data.expense);
                return (
                  <li key={group.categoryId ?? "none"}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span>{group.name}</span>
                      <span className="flex items-baseline gap-2">
                        <span className="text-xs text-faint tabular">
                          {Math.round(share)}%
                        </span>
                        <Money amount={group.amount} />
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-gold/70 to-gold transition-[width] duration-700 ease-out"
                        style={{ width: `${Math.max(share, 2)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </article>

        <article className="rounded-3xl border border-line bg-surface p-3">
          <header className="flex items-center justify-between px-3 pt-3 pb-2">
            <h2 className="text-sm">Últimos lançamentos</h2>
            <div className="flex gap-1">
              <Button variant="ghost" className="h-8 px-3 text-xs" onClick={onSeeAll}>
                Ver todos
              </Button>
              <Button variant="ghost" className="h-8 w-8 px-0" onClick={onNew} aria-label="Novo lançamento">
                <Icon name="plus" size={16} />
              </Button>
            </div>
          </header>
          {transactions.isPending ? (
            <ListSkeleton rows={4} />
          ) : (transactions.data?.length ?? 0) === 0 ? (
            <p className="px-3 py-6 text-sm text-faint">
              Nenhum lançamento neste mês.{" "}
              <button type="button" className="text-gold hover:underline" onClick={onNew}>
                Registrar agora
              </button>
            </p>
          ) : (
            <ul>
              {transactions.data?.slice(0, 6).map((transaction) => (
                <TransactionRow key={transaction.id} transaction={transaction} onOpen={onEdit} />
              ))}
            </ul>
          )}
        </article>
      </div>
      <PlanningGlance month={month} onBudgets={onBudgets} onGoals={onGoals} />
    </section>
  );
}

function Stat({
  label,
  amount,
  previous,
  previousLabel,
  tone,
  goodWhenUp,
}: {
  label: string;
  amount: string | undefined;
  previous: string | undefined;
  previousLabel: string;
  tone: "positive" | "negative";
  goodWhenUp: boolean;
}) {
  return (
    <div className="rounded-3xl border border-line bg-surface p-5">
      <p className="text-sm text-muted">{label}</p>
      <div className="mt-2 text-2xl">
        {amount === undefined ? (
          <div className="skeleton h-7 w-32" />
        ) : (
          <Money amount={amount} tone={tone} />
        )}
      </div>
      <Delta
        current={amount}
        previous={previous}
        previousLabel={previousLabel}
        goodWhenUp={goodWhenUp}
      />
    </div>
  );
}

function Delta({
  current,
  previous,
  previousLabel,
  goodWhenUp,
}: {
  current: string | undefined;
  previous: string | undefined;
  previousLabel: string;
  goodWhenUp: boolean;
}) {
  if (current === undefined || previous === undefined || BigInt(previous) === 0n) {
    return <p className="mt-2 text-xs text-faint">Sem comparação com {previousLabel}</p>;
  }
  const change = BigInt(current) - BigInt(previous);
  const percent = Math.round(Number((change * 1000n) / BigInt(previous)) / 10);
  const up = change > 0n;
  const good = change === 0n ? null : up === goodWhenUp;

  return (
    <p className="mt-2 flex items-center gap-1 text-xs">
      <span className={good === null ? "text-faint" : good ? "text-positive" : "text-negative"}>
        {up ? "↑" : change < 0n ? "↓" : "="} {Math.abs(percent)}%
      </span>
      <span className="text-faint">vs {previousLabel}</span>
    </p>
  );
}

/** What still has to happen this month: card invoices and pending recurrences. */
function Commitments({
  summary,
  onOpen,
  onCards,
}: {
  summary: Summary;
  onOpen: (transaction: Transaction) => void;
  onCards: () => void;
}) {
  return (
    <article className="rounded-3xl border border-line bg-surface p-3">
      <h2 className="flex items-center gap-2 px-3 pt-3 pb-2 text-sm">
        <Icon name="calendar" size={15} />
        Compromissos do mês
      </h2>
      <ul>
        {summary.invoices.map((invoice) => (
          <li key={invoice.card.id}>
            <button
              type="button"
              onClick={onCards}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-white/[0.035]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold">
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
