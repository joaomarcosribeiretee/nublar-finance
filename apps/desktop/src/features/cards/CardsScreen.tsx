import { useState } from "react";
import { AccountSelect } from "@/components/AccountSelect";
import { Button } from "@/components/Button";
import { ErrorNote, PageHeader, ProgressBar, StatStrip, Stepper } from "@/components/Page";
import { EmptyState } from "@/components/EmptyState";
import { controlClass, Field, MoneyInput, TextInput } from "@/components/Field";
import { Icon } from "@/components/Icon";
import { FormFooter, Modal } from "@/components/Modal";
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
  EMPTY: "bg-hover-strong text-muted",
  OPEN: "bg-transfer/10 text-transfer",
  CLOSED: "bg-accent/15 text-accent",
  PAID: "bg-positive/10 text-positive",
  OVERDUE: "bg-negative/15 text-negative",
};

export function StatusPill({ status }: { status: InvoiceStatus }) {
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusStyle[status]}`}>
      {invoiceStatusLabels[status]}
    </span>
  );
}

export function CardsScreen({ onOpenInvoices }: { onOpenInvoices?: (cardId: string) => void }) {
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
      {cards.isSuccess && cards.data.length > 0 ? <div className="mt-6"><StatStrip columns="grid-cols-1 @lg:grid-cols-3" items={[
        { label: "Comprometido nos cartões", value: <Money amount={cards.data.reduce((sum, card) => sum + BigInt(card.debt), 0n).toString()} /> },
        { label: "Limite disponível", value: <Money amount={cards.data.reduce((sum, card) => sum + BigInt(card.available), 0n).toString()} /> },
        { label: "Cartões cadastrados", value: cards.data.length },
      ]} /></div> : null}

      <div className="mt-8">
        {cards.isError ? (
          <ErrorNote>{errorMessage(cards.error)}</ErrorNote>
        ) : cards.isPending ? (
          <div className="grid gap-4 @2xl:grid-cols-2">
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
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-4">
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
        {open ? (
          <CardDetail
            card={open}
            onClose={() => setOpenId(null)}
            onOpenInvoices={onOpenInvoices ? () => onOpenInvoices(open.id) : undefined}
          />
        ) : null}
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
      className="credit-card relative flex min-h-60 w-full flex-col overflow-hidden rounded-3xl border border-line-strong bg-surface p-6 text-left transition-colors hover:border-accent/40"
    >
      <div className="relative flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2 text-sm">
          <Icon name="card" size={16} className="text-muted" />
          <span className="truncate">{card.name}</span>
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
        <div className="mt-4">
          {used <= 100 ? <ProgressBar size="xs" value={used} tone={used > 90 ? "negative" : "accent"} /> : <p className="text-xs text-negative">Limite excedido em <Money amount={(BigInt(card.debt) - BigInt(card.limit)).toString()} /></p>}
        </div>
        <p className="mt-2 flex justify-between gap-3 text-[11px] text-faint">
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

function CardDetail({
  card,
  onClose,
  onOpenInvoices,
}: {
  card: Card;
  onClose: () => void;
  onOpenInvoices?: () => void;
}) {
  const [month, setMonth] = useState(card.currentInvoice.month);
  const [view, setView] = useState<"invoice" | "pay" | "edit">("invoice");
  const invoice = useInvoice(card.id, month);
  const data = invoice.data;

  // Another bill has another amount due: an open payment form would be stale.
  function goTo(next: string) {
    setMonth(next);
    setView("invoice");
  }

  if (view === "edit") {
    return <CardForm card={card} onDone={() => setView("invoice")} onDeleted={onClose} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Stepper
          className="-ml-2"
          label={monthLabel(month)}
          previousLabel="Fatura anterior"
          nextLabel="Próxima fatura"
          onPrevious={() => goTo(shiftMonth(month, -1))}
          onNext={() => goTo(shiftMonth(month, 1))}
        />
        {data ? <StatusPill status={data.status} /> : null}
      </div>

      {invoice.isError ? <ErrorNote>{errorMessage(invoice.error)}</ErrorNote> : null}

      <StatStrip
        items={[
          { label: "Total", value: data?.total },
          { label: "Pago", value: data?.paid },
          { label: "Restante", value: data?.remaining },
        ].map((stat) => ({
          label: stat.label,
          value: stat.value === undefined ? <span className="skeleton block h-5 w-16" /> : <Money amount={stat.value} />,
        }))}
      />
      {data ? (
        <p className="-mt-2 text-xs text-faint">
          Fecha em {shortDate(data.closingDate)} · vence em {shortDate(data.dueDate)}
        </p>
      ) : null}

      {view === "pay" && data ? (
        <PayForm card={card} month={month} remaining={data.remaining} onDone={() => setView("invoice")} />
      ) : (
        <ul className={`-mx-2 transition-opacity duration-(--dur-base) ${invoice.isPlaceholderData ? "opacity-50" : ""}`}>
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
        <FormFooter>
          <Button variant="ghost" onClick={() => setView("edit")}>
            <Icon name="pencil" size={14} />
            Editar cartão
          </Button>
          {onOpenInvoices ? (
            <Button variant="ghost" onClick={onOpenInvoices}>
              <Icon name="receipt" size={14} />
              Ver faturas
            </Button>
          ) : null}
          <div className="flex-1" />
          {data?.status === "PAID" ? (
            <span className="flex items-center gap-1.5 text-sm text-positive">
              <Icon name="check" size={15} />
              Fatura paga
            </span>
          ) : data && BigInt(data.remaining) > 0n ? (
            <Button variant="primary" onClick={() => setView("pay")}>
              Pagar fatura
            </Button>
          ) : null}
        </FormFooter>
      ) : null}
    </div>
  );
}

export function PayForm({
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
      setError("Informe um valor, por exemplo 250,00.");
      return;
    }
    if (!chosen) {
      setError("Escolha a conta de onde sai o pagamento.");
      return;
    }
    try {
      if (BigInt(minor) > BigInt(remaining)) {
        setError("O valor passa do que falta pagar nesta fatura.");
        return;
      }
      await pay.mutateAsync({ cardId: card.id, accountId: chosen, amount: minor, date, invoiceMonth: month });
      toast(minor === remaining ? "Fatura paga" : "Pagamento parcial registrado");
      onDone();
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="animate-enter space-y-4 rounded-2xl bg-surface-2 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <AccountSelect
          label="Pagar com"
          accounts={accounts.data ?? []}
          value={chosen}
          onChange={setAccountId}
        />
        <Field label="Valor">
          <MoneyInput autoFocus value={amount} onChange={setAmount} />
        </Field>
        <Field label="Data">
          <input
            className={controlClass}
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </Field>
      </div>
      <p className="text-xs text-faint">
        Sai da conta e abate a dívida do cartão. Não é despesa: as compras já contaram na fatura. As
        cobranças previstas desta fatura são confirmadas junto.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button variant="primary" type="submit" disabled={pay.isPending}>
          {pay.isPending ? "Registrando…" : "Confirmar pagamento"}
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
    // An empty or zeroed limit means "no limit tracked", not a mistake.
    const minor = /^[0.,\s]*$/.test(limit) ? "0" : parseReaisToMinorUnits(limit);
    if (minor === null) {
      setError("Limite inválido. Use algo como 5.000,00.");
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
      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
        <Field label="Nome do cartão">
          <TextInput
            autoFocus
            placeholder={institutionName || "Ex.: Nubank"}
            value={name}
            maxLength={80}
            onChange={setName}
            required={!institutionName}
          />
        </Field>
        <Field label="Limite">
          <MoneyInput value={limit} onChange={setLimit} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
        <div className="col-span-2 sm:col-span-1">
          <AccountSelect
            label="Paga com"
            accounts={accounts.data ?? []}
            value={paymentAccount}
            onChange={setPaymentAccountId}
            allowEmpty="Nenhuma"
          />
        </div>
      </div>
      <p className="text-xs text-faint">
        Compras no dia do fechamento ou depois entram na fatura seguinte.
        {card ? " Mudar as datas vale para novas compras." : ""}
      </p>
      <FormFooter error={error}>
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
          {save.isPending ? "Salvando…" : "Salvar"}
        </Button>
      </FormFooter>
    </form>
  );
}
