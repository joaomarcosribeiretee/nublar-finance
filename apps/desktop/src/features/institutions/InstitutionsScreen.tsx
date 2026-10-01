import { useState } from "react";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/Page";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { Modal } from "@/components/Modal";
import { Money } from "@/components/Money";
import { errorMessage } from "@/lib/api";
import { accountTypeLabels } from "@/lib/labels";
import {
  useAccounts,
  useCards,
  useInstitutions,
  useSummary,
  type Account,
  type Card,
  type Institution,
} from "@/lib/queries";
import { CardForm } from "@/features/cards/CardsScreen";
import { AccountForm } from "./AccountForm";
import { AddInstitution } from "./AddInstitution";
import { InstitutionForm } from "./InstitutionForm";

type Dialog =
  | { kind: "add-institution" }
  | { kind: "cash" }
  | { kind: "institution"; institution: Institution }
  | { kind: "account"; account: Account }
  | { kind: "add-to"; institution: Institution; what: "account" | "card" };

export function InstitutionsScreen({
  month,
  adding,
  onAddingChange,
  onOpenCards,
  onOpenInvestments,
}: {
  month: string;
  adding: boolean;
  onAddingChange: (adding: boolean) => void;
  onOpenCards: () => void;
  onOpenInvestments: () => void;
}) {
  const institutions = useInstitutions();
  const accounts = useAccounts();
  const cards = useCards();
  const summary = useSummary(month);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const current: Dialog | null = adding ? { kind: "add-institution" } : dialog;
  const close = () => {
    setDialog(null);
    onAddingChange(false);
  };

  const loose = (accounts.data ?? []).filter((account) => !account.institution);
  const looseCards = (cards.data ?? []).filter((card) => !card.institutionId);
  const loading = institutions.isPending || accounts.isPending;
  const empty = !loading && institutions.data?.length === 0 && loose.length === 0 && looseCards.length === 0;

  return (
    <section className="animate-enter">
      <PageHeader
        eyebrow="Bancos, corretoras e carteiras"
        title={summary.data ? <Money amount={summary.data.cash} /> : <span className="skeleton inline-block h-8 w-56" />}
        actions={
          <>
            <Button variant="ghost" onClick={() => setDialog({ kind: "cash" })}>
              Dinheiro em espécie
            </Button>
            <Button variant="primary" onClick={() => onAddingChange(true)}>
              <Icon name="plus" size={16} />
              Instituição
            </Button>
          </>
        }
      >
        Dinheiro em contas, sem contar investimentos.
      </PageHeader>

      <div className="mt-8 space-y-4">
        {institutions.isError ? (
          <p className="text-sm text-negative">{errorMessage(institutions.error)}</p>
        ) : null}
        {loading ? (
          [0, 1].map((index) => <div key={index} className="skeleton h-36 rounded-3xl" />)
        ) : empty ? (
          <EmptyState
            icon="bank"
            title="Onde está seu dinheiro?"
            description="Adicione seus bancos, corretoras e carteiras. Dentro de cada um você coloca contas, caixinhas e cartões."
            action={
              <Button variant="primary" onClick={() => onAddingChange(true)}>
                Adicionar instituição
              </Button>
            }
          />
        ) : (
          <>
            {institutions.data?.map((institution) => (
              <InstitutionPanel
                key={institution.id}
                institution={institution}
                accounts={(accounts.data ?? []).filter((a) => a.institution?.id === institution.id)}
                cards={(cards.data ?? []).filter((c) => c.institutionId === institution.id)}
                onEdit={() => setDialog({ kind: "institution", institution })}
                onAccount={(account) => setDialog({ kind: "account", account })}
                onCard={onOpenCards}
                onInvestments={onOpenInvestments}
                onAdd={(what) => setDialog({ kind: "add-to", institution, what })}
              />
            ))}
            {loose.length > 0 || looseCards.length > 0 ? (
              <InstitutionPanel
                institution={null}
                accounts={loose}
                cards={looseCards}
                onAccount={(account) => setDialog({ kind: "account", account })}
                onCard={onOpenCards}
              />
            ) : null}
          </>
        )}
      </div>

      <Modal open={current?.kind === "add-institution"} onClose={close} title="Nova instituição" width={560}>
        <AddInstitution onDone={close} />
      </Modal>
      <Modal open={current?.kind === "cash"} onClose={close} title="Dinheiro em espécie">
        <AccountForm account={null} institution={null} fixedType="CASH" onDone={close} />
      </Modal>
      <Modal
        open={current?.kind === "institution"}
        onClose={close}
        title={current?.kind === "institution" ? current.institution.name : ""}
      >
        {current?.kind === "institution" ? (
          <InstitutionForm institution={current.institution} onDone={close} />
        ) : null}
      </Modal>
      <Modal
        open={current?.kind === "account"}
        onClose={close}
        title={current?.kind === "account" ? current.account.label : ""}
      >
        {current?.kind === "account" ? (
          <AccountForm account={current.account} institution={current.account.institution} onDone={close} />
        ) : null}
      </Modal>
      <Modal
        open={current?.kind === "add-to"}
        onClose={close}
        title={
          current?.kind === "add-to"
            ? `${current.what === "card" ? "Novo cartão" : "Nova conta"} · ${current.institution.name}`
            : ""
        }
      >
        {current?.kind === "add-to" ? (
          current.what === "card" ? (
            <CardForm card={null} institutionId={current.institution.id} onDone={close} />
          ) : (
            <AccountForm account={null} institution={current.institution} onDone={close} />
          )
        ) : null}
      </Modal>
    </section>
  );
}

function InstitutionPanel({
  institution,
  accounts,
  cards,
  onEdit,
  onAccount,
  onCard,
  onInvestments,
  onAdd,
}: {
  institution: Institution | null;
  accounts: Account[];
  cards: Card[];
  onEdit?: () => void;
  onAccount: (account: Account) => void;
  onCard: () => void;
  onInvestments?: () => void;
  onAdd?: (what: "account" | "card") => void;
}) {
  const color = institution?.color ?? "#56655c";

  return (
    <article className="overflow-hidden rounded-3xl border border-line bg-surface">
      <header className="flex items-center gap-3 px-5 pt-5 pb-3">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-medium text-white"
          style={{ background: color }}
        >
          {institution ? institution.name.slice(0, 1).toUpperCase() : <Icon name="wallet" size={16} />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate">{institution?.name ?? "Fora de instituições"}</h2>
          {institution && BigInt(institution.cardDebt) > 0n ? (
            <p className="text-xs text-muted">
              Cartões devem <Money amount={institution.cardDebt} />
            </p>
          ) : null}
        </div>
        {institution ? (
          <Money amount={institution.total} className="text-xl" />
        ) : null}
        {onEdit ? (
          <button
            type="button"
            aria-label="Editar instituição"
            className="rounded-lg p-2 text-faint transition-colors hover:bg-white/5 hover:text-foreground"
            onClick={onEdit}
          >
            <Icon name="pencil" size={14} />
          </button>
        ) : null}
      </header>

      <ul className="px-2">
        {accounts.map((account) => (
          <li key={account.id}>
            <button
              type="button"
              onClick={() => onAccount(account)}
              className="group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-white/[0.035]"
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">
                  {account.name || accountTypeLabels[account.type]}
                </span>
                {account.name ? (
                  <span className="block text-xs text-muted">{accountTypeLabels[account.type]}</span>
                ) : null}
              </span>
              <Money
                amount={account.balance}
                tone={account.balance.startsWith("-") ? "negative" : "plain"}
                className="text-sm"
              />
            </button>
          </li>
        ))}
        {institution && BigInt(institution.investments) > 0n ? (
          <li>
            <button
              type="button"
              onClick={onInvestments}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-white/[0.035]"
            >
              <Icon name="trend" size={14} className="text-muted" />
              <span className="flex-1 text-sm">Investimentos</span>
              <Money amount={institution.investments} className="text-sm" />
            </button>
          </li>
        ) : null}
        {cards.map((card) => (
          <li key={card.id}>
            <button
              type="button"
              onClick={onCard}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-white/[0.035]"
            >
              <Icon name="card" size={14} className="text-muted" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">Cartão {card.name}</span>
                <span className="block text-xs text-muted">
                  Disponível <Money amount={card.available} />
                </span>
              </span>
              <span className="text-right">
                <Money amount={card.currentInvoice.remaining} className="block text-sm" />
                <span className="block text-[11px] text-faint">fatura</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {onAdd ? (
        <footer className="flex gap-1 px-4 pt-1 pb-4">
          <button
            type="button"
            onClick={() => onAdd("account")}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted transition-colors hover:bg-white/5 hover:text-foreground"
          >
            <Icon name="plus" size={13} />
            Conta
          </button>
          <button
            type="button"
            onClick={() => onAdd("card")}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted transition-colors hover:bg-white/5 hover:text-foreground"
          >
            <Icon name="plus" size={13} />
            Cartão
          </button>
        </footer>
      ) : (
        <div className="h-3" />
      )}
    </article>
  );
}
