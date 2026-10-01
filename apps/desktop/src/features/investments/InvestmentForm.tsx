import { useState } from "react";
import { Button } from "@/components/Button";
import { controlClass, Field } from "@/components/Field";
import { Icon } from "@/components/Icon";
import { Segmented } from "@/components/Segmented";
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
  `rounded-full border px-3 py-1.5 text-sm transition-all duration-150 ${
    active
      ? "border-gold/50 bg-gold/15 text-foreground"
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
  const [quantity, setQuantity] = useState(investment?.quantity ?? "");
  const [maturityDate, setMaturityDate] = useState(investment?.maturityDate ?? "");
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

  // A sensible name when the user does not type one: "CDB Nubank 110% do CDI".
  const suggestedName = fixedIncome
    ? [product ? productLabels[product] : "Renda fixa", institutionName, rateBps !== null ? rateLabel(indexer, rateBps) : null]
        .filter(Boolean)
        .join(" ")
    : assetClassLabels[assetClass];

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
      setError("Taxa inválida. Use algo como 110 ou 6,5.");
      return;
    }
    const details = {
      name: name.trim() || suggestedName,
      assetClass,
      institutionId: institutionId || null,
      ticker: ticker.trim(),
      quantity: quantity.trim(),
      maturityDate: maturityDate || null,
      product: fixedIncome ? product : null,
      // Without a rate the index says nothing, so neither is saved.
      indexer: fixedIncome && rateBps !== null ? indexer : null,
      rateBps: fixedIncome && indexer ? rateBps : null,
      liquidity: fixedIncome ? liquidity : null,
    };
    try {
      if (investment) {
        await update.mutateAsync({ id: investment.id, input: details });
        toast("Investimento atualizado");
      } else {
        const currentValue = parseNonNegative(current);
        if (currentValue === null) {
          setError("Informe quanto você tem hoje.");
          return;
        }
        if (knowsHistory) {
          const openingApplied = parseNonNegative(applied);
          if (openingApplied === null) {
            setError("Informe quanto você aplicou.");
            return;
          }
          await create.mutateAsync({ ...details, currentValue, openingApplied, startDate });
        } else {
          await create.mutateAsync({ ...details, currentValue });
        }
        toast("Investimento cadastrado");
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
      toast("Investimento excluído");
      onDeleted?.();
    } catch (reason: unknown) {
      setConfirmDelete(false);
      setError(errorMessage(reason));
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-5">
      <Field label="Classe">
        <div className="flex flex-wrap gap-1.5">
          {classes.map((value) => (
            <button key={value} type="button" className={chip(assetClass === value)} onClick={() => setAssetClass(value)}>
              {assetClassLabels[value]}
            </button>
          ))}
        </div>
      </Field>

      {fixedIncome ? (
        <Field label="Produto">
          <div className="flex flex-wrap gap-1.5">
            {products.map((value) => (
              <button key={value} type="button" className={chip(product === value)} onClick={() => chooseProduct(value)}>
                {productLabels[value]}
              </button>
            ))}
          </div>
        </Field>
      ) : null}

      {investment ? null : (
        <label className="block rounded-2xl border border-line bg-surface-2 px-4 py-3 transition-colors focus-within:border-gold/60">
          <span className="text-xs text-muted">Quanto você tem hoje</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-lg text-muted">R$</span>
            <input
              autoFocus
              inputMode="decimal"
              placeholder="0,00"
              className="tabular w-full bg-transparent font-display text-3xl outline-none placeholder:text-faint"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
            />
          </div>
          <span className="mt-1 block text-[11px] text-faint">
            O valor que aparece hoje no app do banco ou da corretora. Entra no patrimônio, não como despesa.
          </span>
        </label>
      )}

      <div className="grid grid-cols-[1fr_200px] gap-3">
        <Field label="Nome (opcional)">
          <input
            className={controlClass}
            placeholder={suggestedName}
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field label="Instituição">
          <select className={controlClass} value={institutionId} onChange={(event) => setInstitutionId(event.target.value)}>
            <option value="">Nenhuma</option>
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
          <Field label="Rentabilidade contratada (opcional)">
            <div className="flex items-center gap-3">
              <Segmented
                size="sm"
                value={indexer ?? ""}
                options={[
                  { value: "", label: "Não sei" },
                  { value: "CDI", label: "% do CDI" },
                  { value: "IPCA", label: "IPCA +" },
                  { value: "PREFIXED", label: "Prefixado" },
                  { value: "SELIC", label: "Selic +" },
                ]}
                onChange={(value) => {
                  setIndexer(value === "" ? null : value);
                  if (value === "") setRate("");
                }}
              />
              {indexer ? (
                <div className="animate-enter relative w-32">
                  <input
                    className={`${controlClass} tabular pr-14`}
                    inputMode="decimal"
                    placeholder={indexer === "CDI" ? "92" : indexer === "IPCA" ? "6,5" : indexer === "SELIC" ? "0,1" : "12"}
                    value={rate}
                    onChange={(event) => setRate(event.target.value)}
                  />
                  <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-faint">
                    {indexer === "CDI" ? "% CDI" : indexer === "PREFIXED" ? "% a.a." : "%"}
                  </span>
                </div>
              ) : null}
              {indexer && rate.trim() && rateBps !== null ? (
                <span className="text-xs text-muted">{rateLabel(indexer, rateBps)}</span>
              ) : null}
            </div>
            <span className="text-[11px] text-faint">
              Só informativo. Está nos detalhes da aplicação no app do banco (ex.: “92% do CDI”).
            </span>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quando dá para sacar">
              <Segmented
                size="sm"
                value={liquidity ?? ""}
                options={[
                  { value: "", label: "Não sei" },
                  { value: "DAILY", label: liquidityLabels.DAILY },
                  { value: "AT_MATURITY", label: liquidityLabels.AT_MATURITY },
                ]}
                onChange={(value) => setLiquidity(value === "" ? null : value)}
              />
            </Field>
            <Field label="Vencimento (opcional)">
              <input
                className={controlClass}
                type="date"
                value={maturityDate}
                onChange={(event) => setMaturityDate(event.target.value)}
              />
            </Field>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {listed ? (
            <>
              <Field label="Código (opcional)">
                <input
                  className={controlClass}
                  placeholder="PETR4"
                  value={ticker}
                  maxLength={20}
                  onChange={(event) => setTicker(event.target.value.toUpperCase())}
                />
              </Field>
              <Field label="Quantidade (opcional)">
                <input
                  className={controlClass}
                  inputMode="decimal"
                  placeholder="100"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
              </Field>
            </>
          ) : null}
        </div>
      )}

      {investment ? null : (
        <div className="rounded-2xl border border-line">
          <button
            type="button"
            className="flex w-full items-center gap-3 px-4 py-3 text-left"
            onClick={() => setKnowsHistory((value) => !value)}
            aria-expanded={knowsHistory}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-md border transition-colors ${knowsHistory ? "border-gold bg-gold text-background" : "border-line-strong"}`}
            >
              {knowsHistory ? <Icon name="check" size={13} /> : null}
            </span>
            <span className="flex-1">
              <span className="block text-sm">Sei quanto e quando apliquei</span>
              <span className="block text-xs text-faint">
                Opcional. Sem isso, o rendimento passa a ser contado a partir de hoje.
              </span>
            </span>
          </button>
          {knowsHistory ? (
            <div className="animate-enter grid grid-cols-2 gap-3 px-4 pb-4 pl-12">
              <Field label="Valor aplicado">
                <input
                  className={`${controlClass} tabular`}
                  inputMode="decimal"
                  placeholder="0,00"
                  value={applied}
                  onChange={(event) => setApplied(event.target.value)}
                />
              </Field>
              <Field label="Desde">
                <input
                  className={controlClass}
                  type="date"
                  value={startDate}
                  max={todayLocal()}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </Field>
            </div>
          ) : null}
        </div>
      )}

      {error ? <p className="text-sm text-negative">{error}</p> : null}
      <footer className="flex items-center gap-2">
        {investment ? (
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
          {investment ? "Voltar" : "Cancelar"}
        </Button>
        <Button variant="primary" type="submit" disabled={create.isPending || update.isPending}>
          Salvar
        </Button>
      </footer>
    </form>
  );
}
