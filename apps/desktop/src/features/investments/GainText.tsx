import { formatBps } from "@/lib/chart";

/** Return in percent, green when it earned and red when it lost. */
export function GainText({ gain, bps }: { gain: string; bps: number | null }) {
  const value = BigInt(gain);
  const tone = value > 0n ? "text-positive" : value < 0n ? "text-negative" : "text-muted";
  return <span className={tone}>{formatBps(bps, true)}</span>;
}
