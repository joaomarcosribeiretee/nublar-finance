import { useState } from "react";
import { useTranslation } from "react-i18next";
import { btcToSats, coinForSymbol, satsToBtc } from "@nublar/validation";
import { Button } from "@/components/Button";
import { controlClass, DecimalInput, Field, MoneyInput, TextInput } from "@/components/Field";
import { FormFooter } from "@/components/Modal";
import { MAX_SATS_DIGITS, satsToInput, typedToSats, type BtcUnit } from "@/lib/bitcoin";
import { sanitizeInteger, sanitizeTicker } from "@/lib/input";
import { Icon } from "@/components/Icon";
import { Segmented } from "@/components/Segmented";
import { BtcUnitToggle, useBtcUnit } from "./BitcoinUnit";
import { useToast } from "@/components/Toast";
import { errorMessage } from "@/lib/api";
import { todayLocal } from "@/lib/dates";
import { assetClassLabels } from "@/lib/labels";
import { parseReaisToMinorUnits } from "@/lib/money";
import {
  useCreateInvestment,
  useDeleteInvestment,
  useInstitutions,
  useUpdateInvestment,
  type AssetClass,
  type InvestmentDetail,
} from "@/lib/queries";
import {
  bpsToPercentInput,
  indexerLabels,
  liquidityLabels,
  parsePercentToBps,
  productDefaults,
  productLabels,
  rateLabel,
  type FixedIncomeProduct,
  type Indexer,
  type Liquidity,
} from "@/lib/rates";

const classes = Object.keys(assetClassLabels) as AssetClass[];
const products: FixedIncomeProduct[] = [
  "CDB",
  "LCI",
  "LCA",
  "TESOURO_SELIC",
  "TESOURO_IPCA",
  "TESOURO_PREFIXADO",
  "DEBENTURE",
  "CRI_CRA",
  "FUND",
  "OTHER",
];

/** Zero is allowed here (e.g. a position that went to nothing). */
function parseNonNegative(input: string): string | null {
  if (!input.trim()) return null;
  if (/^[0.,\s]+$/.test(input.trim())) return "0";
  return parseReaisToMinorUnits(input);
}

const chip = (active: boolean) =>
  `rounded-full border px-3 py-1.5 text-sm transition-colors ${
    active
      ? "border-accent/50 bg-accent/15 text-foreground"
      : "border-line text-muted hover:border-line-strong hover:text-foreground"
  }`;

export function InvestmentForm({
  investment,
  onDone,
  onDeleted,
}: {
  investment: InvestmentDetail | null;
  onDone: () => void;
  onDeleted?: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const institutions = useInstitutions();
  const create = useCreateInvestment();
  const update = useUpdateInvestment();
  const remove = useDeleteInvestment();
  const [assetClass, setAssetClass] = useState<AssetClass>(investment?.assetClass ?? "FIXED_INCOME");
  const [product, setProduct] = useState<FixedIncomeProduct | null>(investment?.product ?? null);
  const [indexer, setIndexer] = useState<Indexer | null>(investment?.indexer ?? null);
  const [rate, setRate] = useState(investment?.rateBps != null ? bpsToPercentInput(investment.rateBps) : "");
  const [liquidity, setLiquidity] = useState<Liquidity | null>(investment?.liquidity ?? null);
  const [name, setName] = useState(investment?.name ?? "");
  const [institutionId, setInstitutionId] = useState(investment?.institutionId ?? "");
  const [ticker, setTicker] = useState(investment?.ticker ?? "");
  const [btcUnit, setBtcUnit] = useBtcUnit();
  // Bitcoin opens in the unit last chosen; the API sends BTC text.
  const [quantity, setQuantity] = useState(() => {
    const sats = investment?.coinId === "bitcoin" ? btcToSats(investment.quantity) : null;
    return sats === null ? (investment?.quantity ?? "") : satsToInput(sats, btcUnit);
  });
  const [maturityDate, setMaturityDate] = useState(investment?.maturityDate ?? "");
  // On by default for coins with a quote; an existing position keeps its choice.
  const [autoQuote, setAutoQuote] = useState(investment?.autoQuote ?? true);
  const [current, setCurrent] = useState("");
  const [knowsHistory, setKnowsHistory] = useState(false);
  const [applied, setApplied] = useState("");
  const [startDate, setStartDate] = useState(todayLocal());
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const fixedIncome = assetClass === "FIXED_INCOME";
  const listed = assetClass === "STOCK" || assetClass === "FII" || assetClass === "ETF" || assetClass === "CRYPTO";
  const institutionName = institutions.data?.find((i) => i.id === institutionId)?.name ?? "";
  const rateBps = rate.trim() ? parsePercentToBps(rate) : null;
  const coinId = assetClass === "CRYPTO" ? coinForSymbol(ticker) : null;
  const quoting = coinId !== null && autoQuote;
  const bitcoin = coinId === "bitcoin";

  /** Switching the unit converts what is typed, so nothing is lost. */
  function chooseBtcUnit(next: BtcUnit) {
    const sats = typedToSats(quantity.replace(/[.,]$/, ""), btcUnit);
    if (sats !== null) setQuantity(satsToInput(sats, next));
    else if (next === "SATS") setQuantity("");
    setBtcUnit(next);
  }

  // A sensible name when the user does not type one: "CDB Nubank 110% do CDI".
  const suggestedName = fixedIncome
    ? [product ? t(productLabels[product]) : t("labels.assetClass.FIXED_INCOME"), institutionName, rateBps !== null ? rateLabel(indexer, rateBps) : null]
        .filter(Boolean)
        .join(" ")
    : t(assetClassLabels[assetClass]);

  function chooseProduct(next: FixedIncomeProduct) {
    setProduct(next);
    const defaults = productDefaults[next];
    if (defaults) {
      setIndexer(defaults.indexer);
      if (defaults.liquidity) setLiquidity(defaults.liquidity);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (rate.trim() && rateBps === null) {
      setError(t("investments.form.errors.rate"));
      return;
    }
    // A trailing separator ("10,") is a number still being typed, not a fraction.
    let typedQuantity = quantity.trim().replace(/[.,]$/, "");
    if (quoting && !/[1-9]/.test(typedQuantity)) {
      setError(t("investments.form.errors.quantity"));
      return;
    }
    // Bitcoin goes to the API as BTC text, which it keeps in whole sats.
    if (bitcoin && typedQuantity) {
      const sats = typedToSats(typedQuantity, btcUnit);
      if (sats === null) {
        setError(t("investments.bitcoin.invalid"));
        return;
      }
      typedQuantity = satsToBtc(sats);
    }
    const details = {
      name: name.trim() || suggestedName,
      assetClass,
      institutionId: institutionId || null,
      ticker: ticker.trim(),
      quantity: typedQuantity,
      maturityDate: maturityDate || null,
      product: fixedIncome ? product : null,
      // Without a rate the index says nothing, so neither is saved.
      indexer: fixedIncome && rateBps !== null ? indexer : null,
      rateBps: fixedIncome && indexer ? rateBps : null,
      liquidity: fixedIncome ? liquidity : null,
      coinId,
      autoQuote: quoting,
    };
    try {
      if (investment) {
        await update.mutateAsync({ id: investment.id, input: details });
        toast(t("investments.form.updated"));
      } else {
        // With the quote on, the API values it: quantity × today's quote.
        const currentValue = quoting ? undefined : parseNonNegative(current);
        if (currentValue === null) {
          setError(t("investments.form.errors.current"));
          return;
        }
        if (knowsHistory) {
          const openingApplied = parseNonNegative(applied);
          if (openingApplied === null) {
            setError(t("investments.form.errors.applied"));
            return;
          }
          await create.mutateAsync({ ...details, currentValue, openingApplied, startDate });
        } else {
          await create.mutateAsync({ ...details, currentValue });
        }
        toast(t("investments.form.created"));
      }
      onDone();
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    }
  }

  async function destroy() {
    if (!investment) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await remove.mutateAsync(investment.id);
      toast(t("investments.form.deleted"));
      onDeleted?.();
    } catch (reason: unknown) {
      setConfirmDelete(false);
      setError(errorMessage(reason));
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-5">
      <Field label={t("investments.form.class")}>
        <div className="flex flex-wrap gap-1.5">
          {classes.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={assetClass === value}
              className={chip(assetClass === value)}
              onClick={() => setAssetClass(value)}
            >
              {t(assetClassLabels[value])}
            </button>
          ))}
        </div>
      </Field>

      {fixedIncome ? (
        <Field label={t("investments.form.product")}>
          <div className="flex flex-wrap gap-1.5">
            {products.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={product === value}
                className={chip(product === value)}
                onClick={() => chooseProduct(value)}
              >
                {t(productLabels[value])}
              </button>
            ))}
          </div>
        </Field>
      ) : null}

      {investment || quoting ? null : (
        <label className="block rounded-2xl border border-line bg-surface-2 px-4 py-3 transition-colors focus-within:border-accent/60">
          <span className="text-xs text-muted">{t("investments.form.current")}</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-lg text-muted">{t("common.money.symbol")}</span>
            <MoneyInput
              autoFocus
              className="tabular w-full min-w-0 bg-transparent font-display text-3xl outline-none placeholder:text-faint focus-visible:outline-none"
              value={current}
              onChange={setCurrent}
            />
          </div>
          <span className="mt-1 block text-[11px] text-faint">
            {t("investments.form.currentHint")}
          </span>
        </label>
      )}

      <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
        <Field label={t("investments.form.name")}>
          <TextInput placeholder={suggestedName} value={name} maxLength={80} onChange={setName} />
        </Field>
        <Field label={t("cards.form.institution")}>
          <select className={controlClass} value={institutionId} onChange={(event) => setInstitutionId(event.target.value)}>
            <option value="">{t("common.none")}</option>
            {institutions.data?.map((institution) => (
              <option key={institution.id} value={institution.id}>
                {institution.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {fixedIncome ? (
        <>
          <Field label={t("investments.form.rate")}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <Segmented
                size="sm"
                label={t("investments.form.indexer")}
                value={indexer ?? ""}
                options={[
                  { value: "", label: t("investments.form.unknown") },
                  { value: "CDI", label: t(indexerLabels.CDI) },
                  { value: "IPCA", label: t(indexerLabels.IPCA) },
                  { value: "PREFIXED", label: t(indexerLabels.PREFIXED) },
                  { value: "SELIC", label: t(indexerLabels.SELIC) },
                ]}
                onChange={(value) => {
                  setIndexer(value === "" ? null : value);
                  if (value === "") setRate("");
                }}
              />
              {indexer ? (
                <div className="animate-enter relative w-32">
                  <DecimalInput
                    aria-label={t("investments.form.rateValue")}
                    className={`${controlClass} tabular pr-14`}
                    wholeDigits={3}
                    placeholder={indexer === "CDI" ? "92" : indexer === "IPCA" ? "6,5" : indexer === "SELIC" ? "0,1" : "12"}
                    value={rate}
                    onChange={setRate}
                  />
                  <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-faint">
                    {indexer === "CDI" ? t("labels.rateSuffix.cdi") : indexer === "PREFIXED" ? t("labels.rateSuffix.yearly") : "%"}
                  </span>
                </div>
              ) : null}
              {indexer && rate.trim() && rateBps !== null ? (
                <span className="text-xs text-muted">{rateLabel(indexer, rateBps)}</span>
              ) : null}
            </div>
            <span className="text-[11px] text-faint">
              {t("investments.form.rateHint")}
            </span>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("investments.form.liquidity")}>
              <Segmented
                size="sm"
                label={t("investments.form.liquidityLabel")}
                value={liquidity ?? ""}
                options={[
                  { value: "", label: t("investments.form.unknown") },
                  { value: "DAILY", label: t(liquidityLabels.DAILY) },
                  { value: "AT_MATURITY", label: t(liquidityLabels.AT_MATURITY) },
                ]}
                onChange={(value) => setLiquidity(value === "" ? null : value)}
              />
            </Field>
            <Field label={t("investments.form.maturity")}>
              <input
                className={controlClass}
                type="date"
                value={maturityDate}
                onChange={(event) => setMaturityDate(event.target.value)}
              />
            </Field>
          </div>
        </>
      ) : listed ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("investments.form.ticker")}>
            <input
              className={controlClass}
              placeholder={assetClass === "CRYPTO" ? "BTC" : "PETR4"}
              autoCapitalize="characters"
              autoComplete="off"
              value={ticker}
              onChange={(event) => setTicker(sanitizeTicker(event.target.value))}
            />
          </Field>
          <Field label={quoting ? t("investments.form.quantityAuto") : t("investments.form.quantity")}>
            {bitcoin ? (
              <span className="relative block">
                {btcUnit === "SATS" ? (
                  <input
                    className={`${controlClass} tabular pr-28`}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="50000000"
                    value={quantity}
                    onChange={(event) => setQuantity(sanitizeInteger(event.target.value, MAX_SATS_DIGITS))}
                  />
                ) : (
                  <DecimalInput className={`${controlClass} tabular pr-28`} placeholder="0,5" decimals={8} wholeDigits={8} value={quantity} onChange={setQuantity} />
                )}
                <span className="absolute top-1/2 right-0.5 -translate-y-1/2">
                  <BtcUnitToggle unit={btcUnit} onChange={chooseBtcUnit} />
                </span>
              </span>
            ) : (
              <DecimalInput placeholder={assetClass === "CRYPTO" ? "0,5" : "100"} decimals={8} wholeDigits={12} value={quantity} onChange={setQuantity} />
            )}
            {bitcoin ? <span className="text-[11px] text-faint">{t("investments.bitcoin.hint")}</span> : null}
          </Field>
          {coinId ? (
            <button
              type="button"
              role="switch"
              aria-checked={autoQuote}
              onClick={() => setAutoQuote((value) => !value)}
              className="col-span-2 flex items-center gap-3 rounded-2xl border border-line px-4 py-3 text-left"
            >
              <span className="flex-1">
                <span className="block text-sm">{t("investments.form.autoQuote")}</span>
                <span className="block text-xs text-faint">{t("investments.form.autoQuoteHint")}</span>
              </span>
              <span
                className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${autoQuote ? "bg-accent" : "bg-line-strong"}`}
              >
                <span
                  className={`absolute top-1 h-4 w-4 rounded-full bg-background transition-[left] ${autoQuote ? "left-5" : "left-1"}`}
                />
              </span>
            </button>
          ) : null}
        </div>
      ) : null}

      {investment ? null : (
        <div className="rounded-2xl border border-line">
          <button
            type="button"
            className="flex w-full items-center gap-3 px-4 py-3 text-left"
            onClick={() => setKnowsHistory((value) => !value)}
            aria-expanded={knowsHistory}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-md border transition-colors ${knowsHistory ? "border-accent bg-accent text-accent-fg" : "border-line-strong"}`}
            >
              {knowsHistory ? <Icon name="check" size={13} /> : null}
            </span>
            <span className="flex-1">
              <span className="block text-sm">{t("investments.form.history")}</span>
              <span className="block text-xs text-faint">
                {t("investments.form.historyHint")}
              </span>
            </span>
          </button>
          {knowsHistory ? (
            <div className="animate-enter grid gap-3 px-4 pb-4 sm:grid-cols-2 sm:pl-12">
              <Field label={t("investments.form.applied")}>
                <MoneyInput value={applied} onChange={setApplied} />
              </Field>
              <Field label={t("investments.form.since")}>
                <input
                  className={controlClass}
                  type="date"
                  value={startDate}
                  max={todayLocal()}
                  onChange={(event) => setStartDate(event.target.value)}
                  required
                />
              </Field>
            </div>
          ) : null}
        </div>
      )}

      <FormFooter error={error}>
        {investment ? (
          <Button
            variant={confirmDelete ? "dangerSolid" : "danger"}
            onClick={() => void destroy()}
            onBlur={() => setConfirmDelete(false)}
            disabled={remove.isPending}
          >
            {confirmDelete ? t("common.actions.confirmDelete") : t("common.actions.delete")}
          </Button>
        ) : null}
        <div className="flex-1" />
        <Button variant="ghost" onClick={onDone}>
          {investment ? t("common.actions.back") : t("common.actions.cancel")}
        </Button>
        <Button variant="primary" type="submit" disabled={create.isPending || update.isPending}>
          {create.isPending || update.isPending ? t("common.save.saving") : t("common.actions.save")}
        </Button>
      </FormFooter>
    </form>
  );
}
