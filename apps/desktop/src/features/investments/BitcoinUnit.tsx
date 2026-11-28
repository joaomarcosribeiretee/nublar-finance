import { useState } from "react";
import { useTranslation } from "react-i18next";
import { btcToSats } from "@nublar/validation";
import { Segmented } from "@/components/Segmented";
import { useHideValues } from "@/hooks/useHideValues";
import { formatSats, loadBtcUnit, saveBtcUnit, type BtcUnit } from "@/lib/bitcoin";

/** BTC or sats, remembered on this device so every screen opens in the same unit. */
export function useBtcUnit(): [BtcUnit, (unit: BtcUnit) => void] {
  const [unit, setUnit] = useState(loadBtcUnit);
  return [
    unit,
    (next) => {
      setUnit(next);
      saveBtcUnit(next);
    },
  ];
}

export function BtcUnitToggle({ unit, onChange }: { unit: BtcUnit; onChange: (unit: BtcUnit) => void }) {
  const { t } = useTranslation();
  return (
    <Segmented
      size="sm"
      label={t("investments.bitcoin.unit")}
      value={unit}
      options={[
        { value: "BTC", label: t("investments.bitcoin.btc") },
        { value: "SATS", label: t("investments.bitcoin.sats") },
      ]}
      onChange={onChange}
    />
  );
}

/** "Você tem 0,5 BTC" ⇄ "Você tem 50.000.000 sats", for the detail screen. */
export function BitcoinHolding({ quantity }: { quantity: string }) {
  const { t } = useTranslation();
  const hidden = useHideValues();
  const [unit, setUnit] = useBtcUnit();
  const sats = btcToSats(quantity);
  if (sats === null) return null;
  const amount = hidden ? "••••" : formatSats(sats, unit);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <p className="text-sm text-muted">
        {t("investments.bitcoin.holding")}{" "}
        <span className="tabular text-foreground">{t(`investments.bitcoin.amount.${unit}`, { amount })}</span>
      </p>
      <BtcUnitToggle unit={unit} onChange={setUnit} />
    </div>
  );
}
