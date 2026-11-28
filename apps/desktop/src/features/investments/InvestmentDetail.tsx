import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AccountSelect } from "@/components/AccountSelect";
import { Button } from "@/components/Button";
import { axisProps, lineCursor, TooltipBox, useMoneyChart } from "@/components/charts";
import { controlClass, DecimalInput, Field, MoneyInput } from "@/components/Field";
import { Icon } from "@/components/Icon";
import { Money } from "@/components/Money";
import { ErrorNote, StatStrip } from "@/components/Page";
import { Segmented } from "@/components/Segmented";
import { useToast } from "@/components/Toast";
import { errorMessage } from "@/lib/api";
import { plotValue } from "@/lib/chart";
import { todayLocal } from "@/lib/dates";
import { minorUnitsToInput, parseReaisToMinorUnits } from "@/lib/money";
import {
  useAccounts,
  useAddValuation,
  useDeleteTransaction,
  useDeleteValuation,
  useInvestment,
  useMoveInvestment,
  type InvestmentDetail as Detail,
} from "@/lib/queries";
import { bpsToPercentInput, liquidityLabels, parsePercentToBps, productLabels, rateLabel } from "@/lib/rates";
import { cdiPreview, isTaxExempt, loadCdiBps, saveCdiBps } from "@/lib/yield";
import { GainText } from "./GainText";
import { InvestmentForm } from "./InvestmentForm";
import { QuoteStatus } from "./QuoteStatus";
import { formatDate, formatMonth } from "@/lib/format";

type Action = "none" | "INVESTMENT" | "REDEMPTION" | "value" | "edit";

export function InvestmentDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation();
  const investment = useInvestment(id);
  const [action, setAction] = useState<Action>("none");
  const data = investment.data;

  if (investment.isError) {
    return <ErrorNote>{errorMessage(investment.error)}</ErrorNote>;
  }
  if (!data) {
    return <div className="skeleton h-80 rounded-2xl" />;
  }
  if (action === "edit") {
    return <InvestmentForm investment={data} onDone={() => setAction("none")} onDeleted={onClose} />;
  }

  return (
    <div className="space-y-5">
      <StatStrip
        columns="grid-cols-2 sm:grid-cols-4"
        items={[
          { label: t("investments.stats.current"), value: <Money amount={data.current} /> },
          { label: t("investments.stats.applied"), value: <Money amount={data.applied} /> },
          { label: t("investments.stats.gain"), value: <Money amount={data.gain} tone="auto" /> },
          { label: t("investments.stats.return"), value: <GainText gain={data.gain} bps={data.gainBps} /> },
        ]}
      />

      <FixedIncomeFacts data={data} />

      {data.autoQuote && data.quote ? <QuoteStatus coinId={data.coinId} quote={data.quote} /> : null}

      <CdiPreview data={data} />

      <HistoryChart data={data} />

      {action === "none" ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => setAction("INVESTMENT")}>
            <Icon name="plus" size={15} />
            {t("investments.detail.invest")}
          </Button>
          <Button onClick={() => setAction("REDEMPTION")}>{t("investments.detail.redeem")}</Button>
          {data.autoQuote ? null : <Button onClick={() => setAction("value")}>{t("investments.detail.updateValue")}</Button>}
          <div className="flex-1" />
          <Button variant="ghost" onClick={() => setAction("edit")}>
            <Icon name="pencil" size={14} />
            {t("investments.detail.edit")}
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
  const { t } = useTranslation();
  const chart = useMoneyChart();
  const fill = useId();
  const rows = data.history.map((point) => ({ ...point, plot: plotValue(point.value) }));
  if (rows.length < 2) {
    return null;
  }
  return (
    <div className="h-48">
      <ResponsiveContainer>
        <AreaChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="month" tickFormatter={(m: string) => formatMonth(m, "short")} {...axisProps} minTickGap={24} />
          <YAxis {...chart.yAxis} tickCount={4} />
          <Tooltip
            {...chart.tooltip}
            cursor={lineCursor}
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as (typeof rows)[number] | undefined;
              if (!active || !point) return null;
              return (
                <TooltipBox
                  title={formatMonth(point.month)}
                  rows={[{ label: t("transactions.form.amount.single"), color: "var(--series-1)", value: <Money amount={point.value} /> }]}
                />
              );
            }}
          />
          <Area isAnimationActive={false}
            type="stepAfter"
            dataKey="plot"
            stroke="var(--series-1)"
            strokeWidth={2}
            fill={`url(#${fill})`}
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
  const { t } = useTranslation();
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
      setError(t("investments.detail.errors.amount"));
      return;
    }
    if (!chosen) {
      setError(t("investments.detail.errors.noAccount"));
      return;
    }
    try {
      await move.mutateAsync({ id: data.id, type, accountId: chosen, amount: minor, date });
      toast(type === "INVESTMENT" ? t("investments.detail.invested") : t("investments.detail.redeemed"));
      onDone();
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="animate-enter space-y-3 rounded-2xl bg-surface-2 p-4">
      <p className="text-sm">{type === "INVESTMENT" ? t("investments.detail.invest") : t("investments.detail.redeem")}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <AccountSelect
          label={type === "INVESTMENT" ? t("investments.detail.from") : t("investments.detail.to")}
          accounts={accounts.data ?? []}
          value={chosen}
          onChange={setAccountId}
        />
        <Field label={t("transactions.form.amount.single")}>
          <MoneyInput autoFocus value={amount} onChange={setAmount} />
        </Field>
        <Field label={t("transactions.form.date")}>
          <input
            className={controlClass}
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </Field>
      </div>
      <p className="text-[11px] text-faint">{t("investments.detail.movementHint")}</p>
      {error ? (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          {t("common.actions.cancel")}
        </Button>
        <Button variant="primary" type="submit" disabled={move.isPending}>
          {type === "INVESTMENT" ? t("investments.detail.submitInvest") : t("investments.detail.submitRedeem")}
        </Button>
      </div>
    </form>
  );
}

function ValuationForm({ data, onDone }: { data: Detail; onDone: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const add = useAddValuation();
  const [value, setValue] = useState(minorUnitsToInput(data.current));
  const [date, setDate] = useState(todayLocal());
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!value.trim()) {
      setError(t("investments.detail.errors.value"));
      return;
    }
    const minor = /^[0.,\s]*$/.test(value) ? "0" : parseReaisToMinorUnits(value);
    if (minor === null) {
      setError(t("investments.detail.errors.invalidValue"));
      return;
    }
    try {
      await add.mutateAsync({ id: data.id, value: minor, date });
      toast(t("investments.detail.valueUpdated"));
      onDone();
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="animate-enter space-y-3 rounded-2xl bg-surface-2 p-4">
      <p className="text-sm">{t("investments.detail.valueQuestion")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("investments.detail.valueOnDate")}>
          <MoneyInput autoFocus value={value} onChange={setValue} />
        </Field>
        <Field label={t("transactions.form.date")}>
          <input
            className={controlClass}
            type="date"
            value={date}
            max={todayLocal()}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </Field>
      </div>
      <p className="text-[11px] text-faint">{t("investments.detail.valueHint")}</p>
      {error ? (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          {t("common.actions.cancel")}
        </Button>
        <Button variant="primary" type="submit" disabled={add.isPending}>
          {t("investments.detail.saveValue")}
        </Button>
      </div>
    </form>
  );
}

function Timeline({ data }: { data: Detail }) {
  const { t } = useTranslation();
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
        label={t("investments.detail.history")}
        value={tab}
        options={[
          { value: "movements", label: t("investments.detail.movements", { count: data.movements.length }) },
          { value: "valuations", label: t("investments.detail.valuations", { count: data.valuations.length }) },
        ]}
        onChange={setTab}
      />
      <ul className="-mx-2 mt-3">
        {tab === "movements" && data.movements.length === 0 ? (
          <li className="py-6 text-center text-sm text-faint">{t("investments.detail.noMovements")}</li>
        ) : null}
        {tab === "movements"
          ? data.movements.map((movement) => (
              <li key={movement.id} className="group flex items-center gap-3 rounded-xl px-2 py-2">
                <span className="w-14 shrink-0 text-xs text-faint">{formatDate(movement.date)}</span>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {movement.type === "INVESTMENT" ? t("transactions.kind.investment") : t("transactions.kind.redemption")}
                  <span className="text-muted"> · {movement.account?.name}</span>
                </span>
                <Money amount={movement.amount} sign={movement.type === "INVESTMENT" ? "+" : "-"} className="text-sm" />
                <DeleteButton
                  label={t("investments.detail.deleteMovement")}
                  onConfirm={() => run(() => removeMovement.mutateAsync(movement.id), t("transactions.form.toasts.movementDeleted"))}
                />
              </li>
            ))
          : data.valuations.map((valuation) => (
              <li key={valuation.id} className="group flex items-center gap-3 rounded-xl px-2 py-2">
                <span className="w-14 shrink-0 text-xs text-faint">{formatDate(valuation.date)}</span>
                <span className="flex-1 text-sm text-muted">
                  {valuation.auto ? t("investments.detail.quotedValue") : t("investments.detail.reportedValue")}
                </span>
                <Money amount={valuation.value} className="text-sm" />
                {data.valuations.length > 1 ? (
                  <DeleteButton
                    label={t("investments.detail.deleteValue")}
                    onConfirm={() =>
                      run(() => removeValuation.mutateAsync({ id: data.id, valuationId: valuation.id }), t("investments.detail.valueDeleted"))
                    }
                  />
                ) : (
                  <span className="w-8" />
                )}
              </li>
            ))}
      </ul>
    </div>
  );
}

/** Two clicks to delete: the first arms, the second confirms. */
function DeleteButton({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  const { t } = useTranslation();
  const [armed, setArmed] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      onBlur={() => setArmed(false)}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      className={`flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg px-1.5 text-xs transition-[opacity,color,background-color] ${
        armed
          ? "bg-negative/15 text-negative"
          : "text-faint group-hover:opacity-100 hover:bg-negative/10 hover:text-negative focus-visible:opacity-100 hoverable:opacity-0"
      }`}
    >
      {armed ? t("investments.detail.deleteConfirm") : <Icon name="trash" size={14} />}
    </button>
  );
}

/** "CDB · 110% do CDI · Liquidez diária · Vence 10 mar 28" as quiet chips. */
function FixedIncomeFacts({ data }: { data: Detail }) {
  const { t } = useTranslation();
  if (data.assetClass !== "FIXED_INCOME") return null;
  const facts = [
    data.product ? t(productLabels[data.product]) : null,
    rateLabel(data.indexer, data.rateBps),
    data.liquidity ? t(liquidityLabels[data.liquidity]) : null,
    data.maturityDate ? t("investments.detail.matures", { date: `${formatDate(data.maturityDate)} ${data.maturityDate.slice(2, 4)}` }) : null,
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

/** What a CDI-indexed position would earn at a CDI the user can adjust. */
function CdiPreview({ data }: { data: Detail }) {
  const { t } = useTranslation();
  const [cdiBps, setCdiBps] = useState(loadCdiBps);
  const [cdiInput, setCdiInput] = useState(() => bpsToPercentInput(loadCdiBps()));
  if (data.assetClass !== "FIXED_INCOME" || data.indexer !== "CDI" || BigInt(data.current) <= 0n) {
    return null;
  }
  const percentOfCdi = data.rateBps ?? 10000;
  const horizons = cdiPreview({
    current: data.current,
    cdiBps,
    percentOfCdiBps: percentOfCdi,
    product: data.product,
    startDate: data.startDate,
    maturityDate: data.maturityDate,
    today: todayLocal(),
  });
  if (horizons.length === 0) {
    return null;
  }
  const exempt = isTaxExempt(data.product);

  function commit(value: string) {
    const bps = parsePercentToBps(value);
    if (bps && bps > 0) {
      setCdiBps(bps);
      saveCdiBps(bps);
      setCdiInput(bpsToPercentInput(bps));
    } else {
      setCdiInput(bpsToPercentInput(cdiBps));
    }
  }

  return (
    <div className="rounded-2xl border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm">{t("investments.preview.title")}</p>
          <p className="mt-0.5 text-xs text-muted">
            {t("investments.preview.subtitle", { rate: bpsToPercentInput(percentOfCdi) })} · {exempt ? t("investments.preview.exempt") : t("investments.preview.net")}
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted">
          {t("investments.preview.cdi")}
          <DecimalInput
            aria-label={t("investments.preview.cdiLabel")}
            className={`${controlClass} !h-9 !w-20 text-right tabular`}
            wholeDigits={2}
            value={cdiInput}
            onChange={setCdiInput}
            onBlur={(event) => commit(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") commit(event.currentTarget.value);
            }}
          />
          {t("labels.rateSuffix.yearly")}
        </label>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
        {horizons.map((horizon) => (
          <div key={horizon.label} className="bg-surface-2 px-3 py-2.5">
            <dt className="text-[11px] text-muted">{horizon.label}</dt>
            <dd className="mt-1 text-sm">
              <Money amount={horizon.net} tone="positive" sign="+" />
            </dd>
            {!exempt ? (
              <dd className="text-[11px] text-faint">
                {t("investments.preview.gross")} <Money amount={horizon.gross} />
              </dd>
            ) : null}
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[11px] text-faint">
        {t("investments.preview.note")}
      </p>
    </div>
  );
}
