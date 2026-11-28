import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";
import { TooltipBox, useMoneyChart } from "@/components/charts";
import { plotValue } from "@/lib/chart";
import { Money } from "@/components/Money";
import { useAnalytics } from "@/lib/queries";
import { formatMonth, formatPercent } from "@/lib/format";

/** Last 12 months of net worth, as a quiet trend next to the headline. */
export function NetWorthSparkline({ month, onOpen }: { month: string; onOpen: () => void }) {
  const { t } = useTranslation();
  const analytics = useAnalytics(month, 12);
  const fill = useId();
  const chart = useMoneyChart();
  const data = analytics.data;
  if (!data || data.kpis.trackedMonths < 2) {
    return null;
  }
  const rows = data.series.map((point) => ({ ...point, plot: plotValue(point.netWorth) }));
  const change = BigInt(data.kpis.netWorthChange);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="-mx-3 flex items-end gap-3 rounded-2xl px-3 py-2 text-left transition-colors hover:bg-hover @2xl:mx-0 @2xl:ml-auto"
      aria-label={t("home.sparkline.open")}
    >
      <div className="h-12 w-40">
        <ResponsiveContainer>
          <AreaChart data={rows} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
            <defs>
              <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.25} />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Tooltip
              {...chart.tooltip}
              cursor={false}
              content={({ active, payload }) => {
                const point = payload?.[0]?.payload as (typeof rows)[number] | undefined;
                if (!active || !point) return null;
                return (
                  <TooltipBox
                    title={formatMonth(point.month)}
                    rows={[{ label: t("home.netWorth"), color: "var(--accent)", value: <Money amount={point.netWorth} /> }]}
                  />
                );
              }}
            />
            <Area isAnimationActive={false}
              type="monotone"
              dataKey="plot"
              stroke="var(--accent)"
              strokeWidth={1.5}
              fill={`url(#${fill})`}
              dot={false}
              activeDot={{ r: 3, stroke: "var(--surface)", strokeWidth: 2, fill: "var(--accent)" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="pb-0.5 text-xs">
        <p className="text-muted">{t("home.sparkline.period")}</p>
        <p className={change > 0n ? "text-positive" : change < 0n ? "text-negative" : "text-muted"}>
          {data.kpis.netWorthChangeBps !== null ? formatPercent(data.kpis.netWorthChangeBps, true) : <Money amount={data.kpis.netWorthChange} />}
        </p>
      </div>
    </button>
  );
}
