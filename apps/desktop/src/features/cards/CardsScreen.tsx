import { useState } from "react";
import { AccountSelect } from "@/components/AccountSelect";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/Page";
import { EmptyState } from "@/components/EmptyState";
import { controlClass, Field } from "@/components/Field";
import { Icon } from "@/components/Icon";
import { Modal } from "@/components/Modal";
import { Money } from "@/components/Money";
import { useToast } from "@/components/Toast";
import { errorMessage } from "@/lib/api";
import { monthLabel, shiftMonth, shortDate, todayLocal } from "@/lib/dates";
import { invoiceStatusLabels } from "@/lib/labels";
import { minorUnitsToInput, parseReaisToMinorUnits, percentOf } from "@/lib/money";
import {
  useAccounts,
  useCards,
  useDeleteCard,
  useInstitutions,
  useInvoice,
  usePayInvoice,
  useSaveCard,
  type Card,
  type InvoiceStatus,
} from "@/lib/queries";

const statusStyle: Record<InvoiceStatus, string> = {
  EMPTY: "bg-white/5 text-faint",
  OPEN: "bg-transfer/10 text-transfer",
  CLOSED: "bg-gold/15 text-gold",
  PAID: "bg-positive/10 text-positive",
  OVERDUE: "bg-negative/15 text-negative",
};

function StatusPill({ status }: { status: InvoiceStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusStyle[status]}`}>
      {invoiceStatusLabels[status]}
    </span>
  );
}

export function CardsScreen() {
  const cards = useCards();
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = cards.data?.find((card) => card.id === openId) ?? null;

  return (
    <section className="animate-enter">
      <PageHeader
        eyebrow="Faturas e limites"
        title="Cartões"
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Icon name="plus" size={16} />
            Novo cartão
          </Button>
        }
      />

      <div className="mt-8">
        {cards.isError ? (
          <p className="text-sm text-negative">{errorMessage(cards.error)}</p>
        ) : cards.isPending ? (
          <div className="grid grid-cols-2 gap-4">
            {[0, 1].map((index) => (
              <div key={index} className="skeleton h-48 rounded-3xl" />
            ))}
          </div>
        ) : cards.data.length === 0 ? (
          <EmptyState
            icon="card"
            title="Nenhum cartão"
            description="Cadastre seus cartões para acompanhar faturas, parcelas e limite."
            action={
              <Button variant="primary" onClick={() => setCreating(true)}>
                Cadastrar cartão
              </Button>
            }
          />
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
            {cards.data.map((card) => (
              <li key={card.id}>
                <CardTile card={card} onOpen={() => setOpenId(card.id)} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal open={creating} onClose={() => setCreating(false)} title="Novo cartão">
        <CardForm card={null} onDone={() => setCreating(false)} />
      </Modal>
      <Modal open={open !== null} onClose={() => setOpenId(null)} title={open?.name ?? ""} width={640}>
        {open ? <CardDetail card={open} onClose={() => setOpenId(null)} /> : null}
      </Modal>
    </section>
  );
}

function CardTile({ card, onOpen }: { card: Card; onOpen: () => void }) {
  const invoice = card.currentInvoice;
  const used = percentOf(card.debt, card.limit);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative flex h-48 w-full flex-col overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-raised via-surface-2 to-surface p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-line-strong"
    >
      <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-gold/10 blur-2xl transition-opacity group-hover:opacity-80" />
      <div className="relative flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm">
          <Icon name="card" size={16} className="text-muted" />
          {card.name}
        </span>
        <StatusPill status={invoice.status} />
      </div>
      <div className="relative mt-auto">
        <p className="text-xs text-muted">
          Fatura de {monthLabel(invoice.month).split(" ")[0].toLowerCase()} · vence {shortDate(invoice.dueDate)}
        </p>
        <p className="mt-1 font-display text-3xl tracking-tight">
          <Money amount={invoice.status === "PAID" ? invoice.total : invoice.remaining} />
        </p>
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-black/30">
          <div
            className={`h-full rounded-full transition-[width] duration-700 ${used > 90 ? "bg-negative" : "bg-gold"}`}
            style={{ width: `${Math.min(used, 100)}%` }}
          />
        </div>
        <p className="mt-2 flex justify-between text-[11px] text-faint">
          <span>
            Disponível <Money amount={card.available} />
          </span>
          <span>
            Limite <Money amount={card.limit} />
          </span>
        </p>
      </div>
    </button>
  );
}

function CardDetail({ card, onClose }: { card: Card; onClose: () => void }) {
  const [month, setMonth] = useState(card.currentInvoice.month);
  const [view, setView] = useState<"invoice" | "pay" | "edit">("invoice");
  const invoice = useInvoice(card.id, month);
  const data = invoice.data;

  if (view === "edit") {
    return <CardForm card={card} onDone={() => setView("invoice")} onDeleted={onClose} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Fatura anterior"
            className="rounded-lg p-1.5 text-muted hover:bg-white/5 hover:text-foreground"
            onClick={() => setMonth(shiftMonth(month, -1))}
          >
            <Icon name="chevronLeft" size={16} />
          </button>
          <span className="w-36 text-center text-sm">Fatura de {monthLabel(month).toLowerCase()}</span>
          <button
            type="button"
            aria-label="Próxima fatura"
            className="rounded-lg p-1.5 text-muted hover:bg-white/5 hover:text-foreground"
            onClick={() => setMonth(shiftMonth(month, 1))}
          >
            <Icon name="chevronRight" size={16} />
          </button>
        </div>
        {data ? <StatusPill status={data.status} /> : null}
      </div>

      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-line bg-line">
        {[
          { label: "Total", value: data?.total },
          { label: "Pago", value: data?.paid },
          { label: "Restante", value: data?.remaining },
        ].map((stat) => (
          <div key={stat.label} className="bg-surface-2 px-4 py-3">
            <p className="text-xs text-muted">{stat.label}</p>
            <p className="mt-1 text-lg">
              {stat.value === undefined ? <span className="skeleton block h-6 w-20" /> : <Money amount={stat.value} />}
            </p>
          </div>
        ))}
      </div>
      {data ? (
        <p className="-mt-2 text-xs text-faint">
          Fecha em {shortDate(data.closingDate)} · vence em {shortDate(data.dueDate)}
        </p>
      ) : null}

      {view === "pay" && data ? (
        <PayForm card={card} month={month} remaining={data.remaining} onDone={() => setView("invoice")} />
      ) : (
        <ul className={`max-h-72 overflow-y-auto transition-opacity ${invoice.isPlaceholderData ? "opacity-50" : ""}`}>
          {data?.items.length === 0 ? (
            <li className="py-8 text-center text-sm text-faint">Nenhuma compra nesta fatura.</li>
          ) : null}
          {data?.items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
              <span className="w-14 shrink-0 text-xs text-faint">{shortDate(item.date)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">
                  {item.type === "CARD_PAYMENT"
                    ? `Pagamento · ${item.account?.name ?? ""}`
                    : item.description || item.category?.name}
                </span>
                {item.type === "EXPENSE" ? (
                  <span className="block truncate text-xs text-muted">
                    {item.category?.name}
                    {(item.installmentCount ?? 1) > 1
                      ? ` · parcela ${item.installmentNumber}/${item.installmentCount}`
                      : ""}
                  </span>
                ) : null}
              </span>
              <Money
                amount={item.amount}
                tone={item.type === "CARD_PAYMENT" ? "positive" : "plain"}
                sign={item.type === "CARD_PAYMENT" ? "-" : undefined}
                className="text-sm"
              />
            </li>
          ))}
        </ul>
      )}

      {view === "invoice" ? (
        <footer className="flex items-center gap-2 border-t border-line pt-4">
          <Button variant="ghost" onClick={() => setView("edit")}>
            <Icon name="pencil" size={14} />
            Editar cartão
          </Button>
          <div className="flex-1" />
          <Button
            variant="primary"
            onClick={() => setView("pay")}
            disabled={!data || BigInt(data.remaining) <= 0n}
          >
            Pagar fatura
          </Button>
        </footer>
      ) : null}
    </div>
  );
}

function PayForm({
  card,
  month,
  remaining,
  onDone,
}: {
  card: Card;
  month: string;
  remaining: string;
  onDone: () => void;
}) {
  const toast = useToast();
  const accounts = useAccounts();
  const pay = usePayInvoice();
  const [accountId, setAccountId] = useState(card.paymentAccountId ?? "");
  const [amount, setAmount] = useState(minorUnitsToInput(remaining));
  const [date, setDate] = useState(todayLocal());
  const [error, setError] = useState<string | null>(null);
  const chosen = accountId || accounts.data?.[0]?.id || "";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const minor = parseReaisToMinorUnits(amount);
    if (!minor) {
      setError("Informe um valor válido.");
      return;
    }
    try {
      await pay.mutateAsync({ cardId: card.id, accountId: chosen, amount: minor, date, invoiceMonth: month });
      toast("Pagamento registrado");
      onDone();
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="animate-enter space-y-4 rounded-2xl bg-surface-2 p-4">
      <div className="grid grid-cols-3 gap-3">
        <AccountSelect
          label="Pagar com"
          accounts={accounts.data ?? []}
          value={chosen}
          onChange={setAccountId}
        />
        <Field label="Valor">
          <input
            autoFocus
            className={`${controlClass} tabular`}
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </Field>
        <Field label="Data">
          <input className={controlClass} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
      </div>
      <p className="text-xs text-faint">
        Sai da conta e abate a dívida do cartão. Não é despesa: as compras já contaram na fatura.
      </p>
      {error ? <p className="text-sm text-negative">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button variant="primary" type="submit" disabled={pay.isPending}>
          Confirmar pagamento
        </Button>
      </div>
    </form>
  );
}

export function CardForm({
  card,
  onDone,
  onDeleted,
  institutionId: presetInstitution,
}: {
  card: Card | null;
  onDone: () => void;
  onDeleted?: () => void;
  institutionId?: string;
}) {
  const toast = useToast();
  const accounts = useAccounts();
  const institutions = useInstitutions();
  const save = useSaveCard();
  const remove = useDeleteCard();
  const [institutionId, setInstitutionId] = useState(
    card?.institutionId ?? presetInstitution ?? "",
  );
  const institutionName = institutions.data?.find((i) => i.id === institutionId)?.name ?? "";
  const [name, setName] = useState(card?.name ?? "");
  const [limit, setLimit] = useState(card ? minorUnitsToInput(card.limit) : "");
  const [closingDay, setClosingDay] = useState(card?.closingDay ?? 3);
  const [dueDay, setDueDay] = useState(card?.dueDay ?? 10);
  const [paymentAccountId, setPaymentAccountId] = useState(card?.paymentAccountId ?? "");
  // Until chosen, suggest the checking account of the same institution.
  const paymentAccount =
    paymentAccountId ||
    (card
      ? ""
      : (accounts.data?.find(
          (account) => account.institution?.id === institutionId && account.type === "CHECKING",
        )?.id ?? ""));
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const minor = limit.trim() ? parseReaisToMinorUnits(limit) : "0";
    if (minor === null) {
      setError("Limite inválido.");
      return;
    }
    try {
      await save.mutateAsync({
        id: card?.id,
        input: {
          name: name.trim() || institutionName,
          limit: minor,
          closingDay,
          dueDay,
          paymentAccountId: paymentAccount || null,
          institutionId: institutionId || null,
        },
      });
      toast(card ? "Cartão atualizado" : "Cartão criado");
      onDone();
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    }
  }

  async function destroy() {
    if (!card) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await remove.mutateAsync(card.id);
      toast("Cartão excluído");
      onDeleted?.();
    } catch (reason: unknown) {
      setConfirmDelete(false);
      setError(errorMessage(reason));
    }
  }

  const days = Array.from({ length: 31 }, (_, index) => index + 1);

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-5">
      {presetInstitution ? null : (
        <Field label="Instituição">
          <select
            className={controlClass}
            value={institutionId}
            onChange={(event) => setInstitutionId(event.target.value)}
          >
            <option value="">Nenhuma</option>
            {institutions.data?.map((institution) => (
              <option key={institution.id} value={institution.id}>
                {institution.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <div className="grid grid-cols-[1fr_180px] gap-3">
        <Field label="Nome do cartão">
          <input
            autoFocus
            className={controlClass}
            placeholder={institutionName || "Ex.: Nubank"}
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            required={!institutionName}
          />
        </Field>
        <Field label="Limite">
          <input
            className={`${controlClass} tabular`}
            inputMode="decimal"
            placeholder="0,00"
            value={limit}
            onChange={(event) => setLimit(event.target.value)}
          />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Fecha dia">
          <select className={controlClass} value={closingDay} onChange={(event) => setClosingDay(Number(event.target.value))}>
            {days.map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Vence dia">
          <select className={controlClass} value={dueDay} onChange={(event) => setDueDay(Number(event.target.value))}>
            {days.map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>
        </Field>
        <AccountSelect
          label="Paga com"
          accounts={accounts.data ?? []}
          value={paymentAccount}
          onChange={setPaymentAccountId}
          allowEmpty="—"
        />
      </div>
      <p className="text-xs text-faint">
        Compras no dia do fechamento ou depois entram na fatura seguinte.
        {card ? " Mudar as datas vale para novas compras." : ""}
      </p>
      {error ? <p className="text-sm text-negative">{error}</p> : null}
      <footer className="flex items-center gap-2">
        {card ? (
          <Button
            variant={confirmDelete ? "dangerSolid" : "danger"}
            onClick={() => void destroy()}
            onBlur={() => setConfirmDelete(false)}
            disabled={remove.isPending}
          >
            {confirmDelete ? "Confirmar exclusão" : "Excluir"}
          </Button>
        ) : null}
        <div className="flex-1" />
        <Button variant="ghost" onClick={onDone}>
          {card ? "Voltar" : "Cancelar"}
        </Button>
        <Button variant="primary" type="submit" disabled={save.isPending}>
          Salvar
        </Button>
      </footer>
    </form>
  );
}
