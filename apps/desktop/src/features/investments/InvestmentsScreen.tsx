import { useState } from "react";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/Page";
import { StatTile } from "@/components/charts";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { Modal } from "@/components/Modal";
import { Money } from "@/components/Money";
import { errorMessage } from "@/lib/api";
import { allocationColors } from "@/lib/chart";
import { GainText } from "./GainText";
import { shortDate } from "@/lib/dates";
import { assetClassLabels } from "@/lib/labels";
import { percentOf } from "@/lib/money";
import { usePortfolio, type AssetClass, type InvestmentItem } from "@/lib/queries";
import { InvestmentDetail } from "./InvestmentDetail";
import { InvestmentForm } from "./InvestmentForm";
import { BulkValuations } from "./BulkValuations";
import { liquidityLabels, rateLabel } from "@/lib/rates";

const classOrder: AssetClass[] = ["FIXED_INCOME", "STOCK", "FII", "ETF", "CRYPTO", "OTHER"];

export function InvestmentsScreen() {
  const portfolio = usePortfolio();
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const data = portfolio.data;
  const totals = data?.totals;

  return (
    <section className="animate-enter space-y-6">
      <PageHeader
        eyebrow="Renda fixa, ações, FIIs, cripto"
        title="Investimentos"
        actions={
          <>
            {data && data.items.length > 0 ? (
              <Button variant="ghost" onClick={() => setUpdating(true)}>
                Atualizar valores
              </Button>
            ) : null}
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Icon name="plus" size={16} />
              Novo investimento
            </Button>
          </>
        }
      />

      {portfolio.isError ? <p className="text-sm text-negative">{errorMessage(portfolio.error)}</p> : null}

      {data && data.items.length === 0 ? (
        <EmptyState
          icon="trend"
          title="Nenhum investimento"
          description="Basta dizer quanto você tem hoje em cada aplicação. Depois é só atualizar o valor de vez em quando."
          action={
            <Button variant="primary" onClick={() => setCreating(true)}>
              Cadastrar investimento
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-4 gap-3">
            <StatTile label="Valor atual" loading={!totals} value={totals ? <Money amount={totals.current} /> : null} />
            <StatTile
              label="Aplicado"
              loading={!totals}
              value={totals ? <Money amount={totals.applied} /> : null}
              detail={totals && BigInt(totals.redeemed) > 0n ? <>resgatado <Money amount={totals.redeemed} /></> : null}
            />
            <StatTile
              label="Ganho"
              loading={!totals}
              value={totals ? <Money amount={totals.gain} tone="auto" /> : null}
              detail="valor + resgates − aplicado"
            />
            <StatTile
              label="Rentabilidade"
              loading={!totals}
              value={totals ? <GainText gain={totals.gain} bps={totals.gainBps} /> : null}
              detail="sobre o aplicado"
            />
          </div>

          {data && data.allocation.length > 0 ? <AllocationBar data={data.allocation} total={data.totals.current} /> : null}

          {data && data.items.some((item) => item.assetClass === "FIXED_INCOME") ? (
            <FixedIncomePanel summary={data.fixedIncome} onOpen={setOpenId} />
          ) : null}

          <div className="space-y-4">
            {!data
              ? [0, 1].map((i) => <div key={i} className="skeleton h-32 rounded-3xl" />)
              : classOrder.map((assetClass) => {
                  const items = data.items.filter((item) => item.assetClass === assetClass);
                  if (items.length === 0) return null;
                  return (
                    <ClassGroup
                      key={assetClass}
                      assetClass={assetClass}
                      items={items}
                      onOpen={(item) => setOpenId(item.id)}
                    />
                  );
                })}
          </div>
        </>
      )}

      <Modal open={updating} onClose={() => setUpdating(false)} title="Atualizar valores" width={560}>
        {data ? <BulkValuations items={data.items} onDone={() => setUpdating(false)} /> : null}
      </Modal>
      <Modal open={creating} onClose={() => setCreating(false)} title="Novo investimento" width={600}>
        <InvestmentForm investment={null} onDone={() => setCreating(false)} />
      </Modal>
      <Modal
        open={openId !== null}
        onClose={() => setOpenId(null)}
        title={data?.items.find((i) => i.id === openId)?.name ?? "Investimento"}
        width={720}
      >
        {openId ? <InvestmentDetail id={openId} onClose={() => setOpenId(null)} /> : null}
      </Modal>
    </section>
  );
}

/** Part-to-whole as one bar: segments separated by a 2px surface gap. */
function AllocationBar({
  data,
  total,
}: {
  data: { assetClass: AssetClass; name: string; value: string }[];
  total: string;
}) {
  return (
    <article className="rounded-3xl border border-line bg-surface p-5">
      <h2 className="text-sm">Distribuição</h2>
      <div className="mt-4 flex h-3 gap-[2px] overflow-hidden rounded-full">
        {data.map((slice) => (
          <div
            key={slice.assetClass}
            className="h-full transition-[width] duration-700 first:rounded-l-full last:rounded-r-full"
            style={{
              width: `${Math.max(percentOf(slice.value, total), 1)}%`,
              background: allocationColors[slice.assetClass],
            }}
            title={`${slice.name}: ${Math.round(percentOf(slice.value, total))}%`}
          />
        ))}
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {data.map((slice) => (
          <li key={slice.assetClass} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: allocationColors[slice.assetClass] }} />
            {slice.name}
            <span className="text-xs text-faint tabular">{Math.round(percentOf(slice.value, total))}%</span>
            <Money amount={slice.value} className="text-xs text-muted" />
          </li>
        ))}
      </ul>
    </article>
  );
}

function ClassGroup({
  assetClass,
  items,
  onOpen,
}: {
  assetClass: AssetClass;
  items: InvestmentItem[];
  onOpen: (item: InvestmentItem) => void;
}) {
  const total = items.reduce((sum, item) => sum + BigInt(item.current), 0n).toString();
  return (
    <article className="rounded-3xl border border-line bg-surface p-3">
      <header className="flex items-center gap-2 px-3 pt-2 pb-2">
        <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: allocationColors[assetClass] }} />
        <h2 className="text-sm text-muted">{assetClassLabels[assetClass]}</h2>
        <Money amount={total} className="ml-auto text-sm" />
      </header>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onOpen(item)}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-white/[0.035]"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm">
                  <span className="truncate">{item.name}</span>
                  {item.ticker ? (
                    <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">{item.ticker}</span>
                  ) : null}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  {item.institution ? (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: item.institution.color }} />
                      {item.institution.name} ·{" "}
                    </>
                  ) : null}
                  {describe(item)}
                </span>
              </span>
              <span className="text-right">
                <Money amount={item.current} className="block text-sm" />
                <span className="text-xs">
                  <GainText gain={item.gain} bps={item.gainBps} />
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </article>
  );
}

/** "110% do CDI · liquidez diária · vence 10 mar 28 · valor de 2 out". */
function describe(item: InvestmentItem): string {
  const parts = [
    item.assetClass === "FIXED_INCOME" ? rateLabel(item.indexer, item.rateBps) : null,
    item.liquidity ? liquidityLabels[item.liquidity].toLowerCase() : null,
    item.maturityDate ? `vence ${shortDate(item.maturityDate)} ${item.maturityDate.slice(2, 4)}` : null,
    item.lastValuation ? `atualizado ${shortDate(item.lastValuation)}` : "sem valor",
  ];
  return parts.filter(Boolean).join(" · ");
}

/** Fixed income at a glance: what can be withdrawn now and what matures soon. */
function FixedIncomePanel({
  summary,
  onOpen,
}: {
  summary: NonNullable<ReturnType<typeof usePortfolio>["data"]>["fixedIncome"];
  onOpen: (id: string) => void;
}) {
  const unknown = BigInt(summary.unknown);
  return (
    <article className="grid grid-cols-[1fr_1.2fr] gap-px overflow-hidden rounded-3xl border border-line bg-line">
      <div className="space-y-4 bg-surface p-5">
        <h2 className="text-sm">Renda fixa: quando dá para sacar</h2>
        <div>
          <p className="text-xs text-muted">A qualquer momento</p>
          <Money amount={summary.daily} className="text-2xl" />
          <p className="mt-0.5 text-[11px] text-faint">Bom lugar para a reserva de emergência.</p>
        </div>
        <div>
          <p className="text-xs text-muted">Só no vencimento</p>
          <Money amount={summary.atMaturity} className="text-lg" />
        </div>
        {unknown > 0n ? (
          <p className="text-[11px] text-faint">
            <Money amount={summary.unknown} /> sem liquidez informada. Edite o investimento para classificar.
          </p>
        ) : null}
      </div>
      <div className="bg-surface p-5">
        <h2 className="text-sm">Vencimentos nos próximos 12 meses</h2>
        {summary.maturities.length === 0 ? (
          <p className="mt-4 text-sm text-faint">Nada vence nos próximos 12 meses.</p>
        ) : (
          <ul className="mt-3 space-y-1">
            {summary.maturities.map((maturity) => (
              <li key={maturity.id}>
                <button
                  type="button"
                  onClick={() => onOpen(maturity.id)}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white/[0.035]"
                >
                  <span className="w-20 shrink-0 text-xs text-muted">
                    {shortDate(maturity.date)} {maturity.date.slice(2, 4)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{maturity.name}</span>
                  <Money amount={maturity.value} className="text-sm" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

