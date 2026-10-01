import { useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AccountSelect } from "@/components/AccountSelect";
import { Button } from "@/components/Button";
import { axisProps, lineCursor, TooltipBox, yAxisMoney } from "@/components/charts";
import { controlClass, Field } from "@/components/Field";
import { Icon } from "@/components/Icon";
import { Money } from "@/components/Money";
import { Segmented } from "@/components/Segmented";
import { useToast } from "@/components/Toast";
import { errorMessage } from "@/lib/api";
import { plotValue } from "@/lib/chart";
import { monthLabel, shortDate, shortMonthLabel, todayLocal } from "@/lib/dates";
import { formatMinorUnits, minorUnitsToInput, parseReaisToMinorUnits } from "@/lib/money";
import {
  useAccounts,
  useAddValuation,
  useDeleteTransaction,
  useDeleteValuation,
  useInvestment,
  useMoveInvestment,
  type InvestmentDetail as Detail,
} from "@/lib/queries";
import { liquidityLabels, productLabels, rateLabel } from "@/lib/rates";
import { GainText } from "./GainText";
import { InvestmentForm } from "./InvestmentForm";

type Action = "none" | "INVESTMENT" | "REDEMPTION" | "value" | "edit";

export function InvestmentDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const investment = useInvestment(id);
  const [action, setAction] = useState<Action>("none");
  const data = investment.data;

  if (investment.isError) {
    return <p className="text-sm text-negative">{errorMessage(investment.error)}</p>;
  }
  if (!data) {
    return <div className="skeleton h-80 rounded-2xl" />;
  }
  if (action === "edit") {
    return <InvestmentForm investment={data} onDone={() => setAction("none")} onDeleted={onClose} />;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-px overflow-hidden rounded-2xl border border-line bg-line">
        {[
          { label: "Valor atual", value: <Money amount={data.current} /> },
          { label: "Aplicado", value: <Money amount={data.applied} /> },
          { label: "Ganho", value: <Money amount={data.gain} tone="auto" /> },
          { label: "Rentabilidade", value: <GainText gain={data.gain} bps={data.gainBps} /> },
        ].map((stat) => (
          <div key={stat.label} className="bg-surface-2 px-4 py-3">
            <p className="text-xs text-muted">{stat.label}</p>
            <p className="mt-1 text-base">{stat.value}</p>
          </div>
        ))}
      </div>

      <FixedIncomeFacts data={data} />

      <HistoryChart data={data} />

      {action === "none" ? (
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => setAction("INVESTMENT")}>
            <Icon name="plus" size={15} />
            Aportar
          </Button>
          <Button onClick={() => setAction("REDEMPTION")}>Resgatar</Button>
          <Button onClick={() => setAction("value")}>Atualizar valor</Button>
          <div className="flex-1" />
          <Button variant="ghost" onClick={() => setAction("edit")}>
            <Icon name="pencil" size={14} />
            Editar
          </Button>
        </div>
      ) : action === "value" ? (
        <ValuationForm data={data} onDone={() => setAction("none")} />
      ) : (
        <MovementForm data={data} type={action} onDone={() => setAction("none")} />
      )}

      <Timeline data={data} />
    </div>
  );
}

function HistoryChart({ data }: { data: Detail }) {
  const rows = data.history.map((point) => ({ ...point, plot: plotValue(point.value) }));
  if (rows.length < 2) {
    return null;
  }
  return (
    <div className="h-48">
      <ResponsiveContainer>
        <AreaChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="investmentFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="month" tickFormatter={(m: string) => shortMonthLabel(m)} {...axisProps} minTickGap={24} />
          <YAxis {...yAxisMoney} tickCount={4} />
          <Tooltip
            cursor={lineCursor}
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as (typeof rows)[number] | undefined;
              if (!active || !point) return null;
              return (
                <TooltipBox
                  title={monthLabel(point.month)}
                  rows={[{ label: "Valor", color: "var(--series-1)", value: formatMinorUnits(point.value) }]}
                />
              );
            }}
          />
          <Area
            type="stepAfter"
            dataKey="plot"
            isAnimationActive={false}
            stroke="var(--series-1)"
            strokeWidth={2}
            fill="url(#investmentFill)"
            activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function MovementForm({
  data,
  type,
  onDone,
}: {
  data: Detail;
  type: "INVESTMENT" | "REDEMPTION";
  onDone: () => void;
}) {
  const toast = useToast();
  const accounts = useAccounts();
  const move = useMoveInvestment();
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState(type === "REDEMPTION" ? minorUnitsToInput(data.current) : "");
  const [date, setDate] = useState(todayLocal());
  const [error, setError] = useState<string | null>(null);
  const chosen = accountId || accounts.data?.[0]?.id || "";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const minor = parseReaisToMinorUnits(amount);
    if (!minor) {
      setError("Informe um valor.");
      return;
    }
    try {
      await move.mutateAsync({ id: data.id, type, accountId: chosen, amount: minor, date });
      toast(type === "INVESTMENT" ? "Aporte registrado" : "Resgate registrado");
      onDone();
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="animate-enter space-y-3 rounded-2xl bg-surface-2 p-4">
      <p className="text-sm">{type === "INVESTMENT" ? "Aportar" : "Resgatar"}</p>
      <div className="grid grid-cols-3 gap-3">
        <AccountSelect
          label={type === "INVESTMENT" ? "Sai de" : "Volta para"}
          accounts={accounts.data ?? []}
          value={chosen}
          onChange={setAccountId}
        />
        <Field label="Valor">
          <input
            autoFocus
            className={`${controlClass} tabular`}
            inputMode="decimal"
            placeholder="0,00"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </Field>
        <Field label="Data">
          <input className={controlClass} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
      </div>
      <p className="text-[11px] text-faint">Só muda o dinheiro de lugar: não é despesa nem receita.</p>
      {error ? <p className="text-sm text-negative">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button variant="primary" type="submit" disabled={move.isPending}>
          Confirmar
        </Button>
      </div>
    </form>
  );
}

function ValuationForm({ data, onDone }: { data: Detail; onDone: () => void }) {
  const toast = useToast();
  const add = useAddValuation();
  const [value, setValue] = useState(minorUnitsToInput(data.current));
  const [date, setDate] = useState(todayLocal());
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const minor = /^[0.,\s]*$/.test(value) ? "0" : parseReaisToMinorUnits(value);
    if (minor === null) {
      setError("Valor inválido.");
      return;
    }
    try {
      await add.mutateAsync({ id: data.id, value: minor, date });
      toast("Valor atualizado");
      onDone();
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="animate-enter space-y-3 rounded-2xl bg-surface-2 p-4">
      <p className="text-sm">Quanto vale agora?</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Valor na data">
          <input
            autoFocus
            className={`${controlClass} tabular`}
            inputMode="decimal"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </Field>
        <Field label="Data">
          <input
            className={controlClass}
            type="date"
            value={date}
            max={todayLocal()}
            onChange={(event) => setDate(event.target.value)}
          />
        </Field>
      </div>
      <p className="text-[11px] text-faint">Copie o valor do app do banco ou da corretora. Aportes futuros somam sobre ele.</p>
      {error ? <p className="text-sm text-negative">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button variant="primary" type="submit" disabled={add.isPending}>
          Salvar valor
        </Button>
      </div>
    </form>
  );
}

function Timeline({ data }: { data: Detail }) {
  const toast = useToast();
  const removeMovement = useDeleteTransaction();
  const removeValuation = useDeleteValuation();
  const [tab, setTab] = useState<"movements" | "valuations">("movements");

  async function run(action: () => Promise<unknown>, message: string) {
    try {
      await action();
      toast(message);
    } catch (reason: unknown) {
      toast(errorMessage(reason), "error");
    }
  }

  return (
    <div>
      <Segmented
        size="sm"
        value={tab}
        options={[
          { value: "movements", label: `Aportes e resgates (${data.movements.length})` },
          { value: "valuations", label: `Valores (${data.valuations.length})` },
        ]}
        onChange={setTab}
      />
      <ul className="mt-3 max-h-56 overflow-y-auto">
        {tab === "movements" && data.movements.length === 0 ? (
          <li className="py-6 text-center text-sm text-faint">Nenhum aporte ou resgate ainda.</li>
        ) : null}
        {tab === "movements"
          ? data.movements.map((movement) => (
              <li key={movement.id} className="group flex items-center gap-3 rounded-xl px-2 py-2">
                <span className="w-14 shrink-0 text-xs text-faint">{shortDate(movement.date)}</span>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {movement.type === "INVESTMENT" ? "Aporte" : "Resgate"}
                  <span className="text-muted"> · {movement.account?.name}</span>
                </span>
                <Money amount={movement.amount} sign={movement.type === "INVESTMENT" ? "+" : "-"} className="text-sm" />
                <DeleteButton
                  label="Excluir movimentação"
                  onConfirm={() => run(() => removeMovement.mutateAsync(movement.id), "Excluído")}
                />
              </li>
            ))
          : data.valuations.map((valuation) => (
              <li key={valuation.id} className="group flex items-center gap-3 rounded-xl px-2 py-2">
                <span className="w-14 shrink-0 text-xs text-faint">{shortDate(valuation.date)}</span>
                <span className="flex-1 text-sm text-muted">Valia</span>
                <Money amount={valuation.value} className="text-sm" />
                {data.valuations.length > 1 ? (
                  <DeleteButton
                    label="Excluir valor"
                    onConfirm={() =>
                      run(() => removeValuation.mutateAsync({ id: data.id, valuationId: valuation.id }), "Valor excluído")
                    }
                  />
                ) : (
                  <span className="w-7" />
                )}
              </li>
            ))}
      </ul>
    </div>
  );
}

/** Two clicks to delete: the first arms, the second confirms. */
function DeleteButton({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      onBlur={() => setArmed(false)}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      className={`rounded-lg p-1.5 text-xs transition-all ${
        armed
          ? "bg-negative/15 text-negative opacity-100"
          : "text-faint opacity-0 group-hover:opacity-100 hover:bg-negative/10 hover:text-negative"
      }`}
    >
      {armed ? "Excluir?" : <Icon name="trash" size={14} />}
    </button>
  );
}

/** "CDB · 110% do CDI · Liquidez diária · Vence 10 mar 28" as quiet chips. */
function FixedIncomeFacts({ data }: { data: Detail }) {
  if (data.assetClass !== "FIXED_INCOME") return null;
  const facts = [
    data.product ? productLabels[data.product] : null,
    rateLabel(data.indexer, data.rateBps),
    data.liquidity ? liquidityLabels[data.liquidity] : null,
    data.maturityDate ? `Vence ${shortDate(data.maturityDate)} ${data.maturityDate.slice(2, 4)}` : null,
  ].filter((fact): fact is string => Boolean(fact));
  if (facts.length === 0) return null;
  return (
    <ul className="-mt-2 flex flex-wrap gap-1.5">
      {facts.map((fact) => (
        <li key={fact} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted">
          {fact}
        </li>
      ))}
    </ul>
  );
}
