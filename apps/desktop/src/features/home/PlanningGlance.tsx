import { Button } from "@/components/Button";
import { Money } from "@/components/Money";
import { Panel, ProgressBar } from "@/components/Page";
import { formatMinorUnits } from "@/lib/money";
import { useBudgets, useGoals, type BudgetStatus } from "@/lib/queries";

const tone: Record<BudgetStatus, "positive" | "warning" | "negative"> = {
  OK: "positive",
  WARNING: "warning",
  OVER: "negative",
};

/** Budgets closest to the limit and goals in progress, at a glance. */
export function PlanningGlance({
  month,
  onBudgets,
  onGoals,
}: {
  month: string;
  onBudgets: () => void;
  onGoals: () => void;
}) {
  const budgets = useBudgets(month);
  const goals = useGoals();
  const budgetItems = budgets.data?.items.slice(0, 4) ?? [];
  const goalItems = goals.data?.filter((g) => !g.reached).slice(0, 3) ?? [];
  if (budgetItems.length === 0 && goalItems.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <Panel
        title="Orçamentos"
        actions={
          <Button variant="ghost" className="h-8 px-3 text-xs" onClick={onBudgets}>
            Ver todos
          </Button>
        }
      >
        {budgetItems.length === 0 ? (
          <p className="text-sm text-faint">Nenhum orçamento definido.</p>
        ) : (
          <ul className="space-y-3.5">
            {budgetItems.map((item) => (
              <li key={item.id} className="space-y-1.5">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="truncate">{item.category.name}</span>
                  <span className="text-xs text-muted">
                    <Money amount={item.spent} className="text-foreground" /> de {formatMinorUnits(item.limit)}
                  </span>
                </div>
                <ProgressBar value={item.usedBps / 100} tone={tone[item.status]} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel
        title="Metas"
        actions={
          <Button variant="ghost" className="h-8 px-3 text-xs" onClick={onGoals}>
            Ver todas
          </Button>
        }
      >
        {goalItems.length === 0 ? (
          <p className="text-sm text-faint">Nenhuma meta em andamento.</p>
        ) : (
          <ul className="space-y-3.5">
            {goalItems.map((goal) => (
              <li key={goal.id} className="space-y-1.5">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="flex items-center gap-2 truncate">
                    <span className="h-2 w-2 rounded-full" style={{ background: goal.color }} />
                    {goal.name}
                  </span>
                  <span className="text-xs text-muted">
                    <Money amount={goal.saved} className="text-foreground" /> de {formatMinorUnits(goal.target)}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full transition-[width] duration-700"
                    style={{ width: `${Math.max(goal.progressBps / 100, 1.5)}%`, background: goal.color }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
