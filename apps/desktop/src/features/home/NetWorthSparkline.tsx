import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";
import { TooltipBox } from "@/components/charts";
import { formatBps, plotValue } from "@/lib/chart";
import { monthLabel } from "@/lib/dates";
import { formatMinorUnits } from "@/lib/money";
import { useAnalytics } from "@/lib/queries";

/** Last 12 months of net worth, as a quiet trend next to the headline. */
export function NetWorthSparkline({ month, onOpen }: { month: string; onOpen: () => void }) {
  const analytics = useAnalytics(month, 12);
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
      className="group ml-auto flex items-end gap-3 rounded-2xl px-3 py-2 text-left transition-colors hover:bg-white/[0.03]"
      aria-label="Ver análises"
    >
      <div className="h-12 w-40">
        <ResponsiveContainer>
          <AreaChart data={rows} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
            <defs>
              <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--gold)" stopOpacity={0.25} />
                <stop offset="100%" stopColor="var(--gold)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Tooltip
              cursor={false}
              content={({ active, payload }) => {
                const point = payload?.[0]?.payload as (typeof rows)[number] | undefined;
                if (!active || !point) return null;
                return (
                  <TooltipBox
                    title={monthLabel(point.month)}
                    rows={[{ label: "Patrimônio", color: "var(--gold)", value: formatMinorUnits(point.netWorth) }]}
                  />
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="plot"
              stroke="var(--gold)"
              strokeWidth={1.5}
              fill="url(#sparkFill)"
              dot={false}
              activeDot={{ r: 3, stroke: "var(--surface)", strokeWidth: 2, fill: "var(--gold)" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="pb-0.5 text-xs">
        <p className="text-muted">12 meses</p>
        <p className={change > 0n ? "text-positive" : change < 0n ? "text-negative" : "text-muted"}>
          {data.kpis.netWorthChangeBps !== null ? formatBps(data.kpis.netWorthChangeBps, true) : formatMinorUnits(data.kpis.netWorthChange)}
        </p>
      </div>
    </button>
  );
}
