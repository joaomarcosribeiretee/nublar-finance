import { currentMonth, monthLabel, shiftMonth } from "@/lib/dates";
import { Icon } from "./Icon";

export function MonthPicker({
  month,
  onChange,
}: {
  month: string;
  onChange: (month: string) => void;
}) {
  const isCurrent = month === currentMonth();

  return (
    <div className="no-drag flex items-center gap-1">
      <button
        type="button"
        aria-label="Mês anterior"
        className="rounded-lg p-1.5 text-muted transition-colors hover:bg-white/5 hover:text-foreground"
        onClick={() => onChange(shiftMonth(month, -1))}
      >
        <Icon name="chevronLeft" size={16} />
      </button>
      <span className="w-32 text-center text-sm tabular">{monthLabel(month)}</span>
      <button
        type="button"
        aria-label="Próximo mês"
        className="rounded-lg p-1.5 text-muted transition-colors hover:bg-white/5 hover:text-foreground"
        onClick={() => onChange(shiftMonth(month, 1))}
      >
        <Icon name="chevronRight" size={16} />
      </button>
      <button
        type="button"
        className={`ml-1 rounded-lg px-2 py-1 text-xs text-gold transition-opacity hover:bg-gold/10 ${isCurrent ? "pointer-events-none opacity-0" : "opacity-100"}`}
        onClick={() => onChange(currentMonth())}
        tabIndex={isCurrent ? -1 : 0}
      >
        Hoje
      </button>
    </div>
  );
}
