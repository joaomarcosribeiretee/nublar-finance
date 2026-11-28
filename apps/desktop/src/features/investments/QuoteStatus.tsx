import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { cryptoCoins, type CoinId } from "@nublar/validation";
import { IconButton } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/Toast";
import { errorMessage } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { useRefreshQuotes, type QuoteInfo } from "@/lib/queries";
import { formatQuoteAge, quotedValue } from "@/lib/quotes";

/** Re-renders every 30 s so "há 3 min" keeps counting. */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

/** "Atualizado há 3 min" with a refresh button. */
export function QuoteAge({ quote, className = "" }: { quote: QuoteInfo; className?: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const refresh = useRefreshQuotes();
  const now = useNow();
  const age = quote.fetchedAt ? formatQuoteAge(quote.fetchedAt, now) : null;

  async function run() {
    try {
      await refresh.mutateAsync();
    } catch (reason: unknown) {
      toast(errorMessage(reason), "error");
    }
  }

  return (
    <span className={`inline-flex items-center gap-1 text-xs text-muted ${className}`}>
      {quote.fetchedAt ? (age ? t("investments.quote.updated", { time: age }) : t("investments.quote.updatedNow")) : null}
      <IconButton
        label={t("investments.quote.refresh")}
        className={`!h-7 !w-7 ${refresh.isPending ? "animate-spin" : ""}`}
        disabled={refresh.isPending}
        onClick={() => void run()}
      >
        <Icon name="refresh" size={13} />
      </IconButton>
    </span>
  );
}

/** A quiet note when the source failed: the value shown is the last known one. */
export function QuoteWarning({ quote }: { quote: QuoteInfo }) {
  const { t } = useTranslation();
  if (!quote.stale) return null;
  return (
    <p role="status" className="text-[11px] text-warning">
      {quote.price ? t("investments.quote.stale") : t("investments.quote.unavailable")}
    </p>
  );
}

/** "1 BTC = R$ 512.345,12 · Atualizado há 3 min ↻", for the detail screen. */
export function QuoteStatus({ coinId, quote }: { coinId: CoinId | null; quote: QuoteInfo }) {
  const { t } = useTranslation();
  const symbol = cryptoCoins.find((coin) => coin.id === coinId)?.symbol ?? "";
  const unit = quote.price ? quotedValue("1", quote.price) : null;
  return (
    <div className="-mt-2 space-y-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {unit ? (
          // A public price, not the user's money: privacy mode leaves it visible.
          <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted tabular">
            {t("investments.quote.price", { symbol, price: formatMoney(unit) })}
          </span>
        ) : null}
        <QuoteAge quote={quote} />
      </div>
      <QuoteWarning quote={quote} />
    </div>
  );
}
