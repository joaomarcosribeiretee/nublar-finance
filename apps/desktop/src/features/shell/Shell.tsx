import { useEffect, useState } from "react";
import logo from "../../../../../assets/logo_semfundo.png";
import { Icon, type IconName } from "@/components/Icon";
import { MonthPicker } from "@/components/MonthPicker";
import { currentMonth } from "@/lib/dates";
import { getSupabase } from "@/lib/supabase";
import type { Transaction } from "@/lib/queries";
import { InstitutionsScreen } from "@/features/institutions/InstitutionsScreen";
import { AnalyticsScreen } from "@/features/analytics/AnalyticsScreen";
import { CardsScreen } from "@/features/cards/CardsScreen";
import { BudgetsScreen } from "@/features/planning/BudgetsScreen";
import { CalendarScreen } from "@/features/planning/CalendarScreen";
import { GoalsScreen } from "@/features/planning/GoalsScreen";
import { InvestmentsScreen } from "@/features/investments/InvestmentsScreen";
import { CategoriesScreen } from "@/features/categories/CategoriesScreen";
import { RecurringScreen } from "@/features/recurring/RecurringScreen";
import { HomeScreen } from "@/features/home/HomeScreen";
import { TransactionForm } from "@/features/transactions/TransactionForm";
import { TransactionsScreen } from "@/features/transactions/TransactionsScreen";

const screens = {
  home: { label: "Início", icon: "home" },
  transactions: { label: "Lançamentos", icon: "list" },
  accounts: { label: "Instituições", icon: "bank" },
  investments: { label: "Investimentos", icon: "trend" },
  analytics: { label: "Análises", icon: "chart" },
  cards: { label: "Cartões", icon: "card" },
  budgets: { label: "Orçamentos", icon: "gauge" },
  goals: { label: "Metas", icon: "target" },
  calendar: { label: "Calendário", icon: "calendar" },
  recurring: { label: "Recorrentes", icon: "repeat" },
  categories: { label: "Categorias", icon: "tag" },
} as const satisfies Record<string, { label: string; icon: IconName }>;

type Screen = keyof typeof screens;

/** Sidebar sections: overview, where the money is, setup. */
const navGroups: { title?: string; items: Screen[] }[] = [
  { items: ["home", "analytics", "transactions"] },
  { title: "Patrimônio", items: ["accounts", "investments", "cards"] },
  { title: "Planejamento", items: ["budgets", "goals", "calendar"] },
  { title: "Organização", items: ["recurring", "categories"] },
];

/** Screens whose numbers depend on the month being browsed. */
const monthly: Screen[] = ["home", "transactions", "analytics", "budgets", "calendar"];

export function Shell({ email }: { email: string }) {
  const [screen, setScreen] = useState<Screen>("home");
  const [month, setMonth] = useState(currentMonth);
  const [form, setForm] = useState<{ open: boolean; editing: Transaction | null }>({
    open: false,
    editing: null,
  });
  const [creatingAccount, setCreatingAccount] = useState(false);

  const openNew = () => setForm({ open: true, editing: null });
  const openEdit = (transaction: Transaction) => setForm({ open: true, editing: transaction });

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      const typing = ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName);
      if (typing || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (document.querySelector("dialog[open]")) {
        return;
      }
      if (event.key === "n" || event.key === "N") {
        event.preventDefault();
        setForm({ open: true, editing: null });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function goToNewAccount() {
    setScreen("accounts");
    setCreatingAccount(true);
  }

  return (
    <div className="flex h-full">
      <aside className="drag flex w-60 shrink-0 flex-col border-r border-line bg-surface/60 px-4 pt-5 pb-4">
        <div className="flex items-center gap-2.5 px-2">
          <img src={logo} alt="" className="h-9 w-9 object-contain" />
          <span className="font-display text-xl tracking-tight">Nublar</span>
        </div>

        <nav className="no-drag mt-8 flex flex-col gap-1 overflow-y-auto">
          {navGroups.flatMap((group, index) => [
            group.title ? (
              <p
                key={group.title}
                className={`px-3 pb-1 text-[10px] font-medium tracking-[0.14em] text-faint uppercase ${index > 0 ? "pt-5" : ""}`}
              >
                {group.title}
              </p>
            ) : null,
            ...group.items.map((item) => {
            const active = screen === item;
            return (
              <button
                key={item}
                type="button"
                aria-current={active ? "page" : undefined}
                className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors duration-150 ${
                  active
                    ? "bg-white/[0.06] text-foreground"
                    : "text-muted hover:bg-white/[0.03] hover:text-foreground"
                }`}
                onClick={() => setScreen(item)}
              >
                <span
                  className={`absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full bg-gold transition-opacity ${active ? "opacity-100" : "opacity-0"}`}
                />
                <Icon name={screens[item].icon} size={17} />
                {screens[item].label}
              </button>
            );
            }),
          ])}
        </nav>

        <div className="no-drag mt-auto border-t border-line pt-4">
          <p className="truncate px-3 text-xs text-faint" title={email}>
            {email}
          </p>
          <button
            className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-white/[0.03] hover:text-foreground"
            type="button"
            onClick={() => void getSupabase().auth.signOut()}
          >
            <Icon name="logout" size={16} />
            Sair
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="drag flex h-[var(--titlebar)] shrink-0 items-center px-10 pr-40 pt-2">
          {monthly.includes(screen) ? <MonthPicker month={month} onChange={setMonth} /> : null}
        </div>
        <main className="flex-1 overflow-y-auto">
          <div key={screen} className="mx-auto max-w-5xl px-10 pt-4 pb-16">
            {screen === "home" ? (
              <HomeScreen
                month={month}
                onNew={openNew}
                onEdit={openEdit}
                onSeeAll={() => setScreen("transactions")}
                onCreateAccount={goToNewAccount}
                onCards={() => setScreen("cards")}
                onAnalytics={() => setScreen("analytics")}
                onBudgets={() => setScreen("budgets")}
                onGoals={() => setScreen("goals")}
              />
            ) : null}
            {screen === "transactions" ? (
              <TransactionsScreen month={month} onNew={openNew} onEdit={openEdit} />
            ) : null}
            {screen === "accounts" ? (
              <InstitutionsScreen
                month={month}
                adding={creatingAccount}
                onAddingChange={setCreatingAccount}
                onOpenCards={() => setScreen("cards")}
                onOpenInvestments={() => setScreen("investments")}
              />
            ) : null}
            {screen === "cards" ? <CardsScreen /> : null}
            {screen === "budgets" ? <BudgetsScreen month={month} /> : null}
            {screen === "goals" ? <GoalsScreen /> : null}
            {screen === "calendar" ? <CalendarScreen month={month} /> : null}
            {screen === "investments" ? <InvestmentsScreen /> : null}
            {screen === "analytics" ? <AnalyticsScreen month={month} /> : null}
            {screen === "recurring" ? <RecurringScreen /> : null}
            {screen === "categories" ? <CategoriesScreen /> : null}
          </div>
        </main>
      </div>

      <TransactionForm
        open={form.open}
        editing={form.editing}
        month={month}
        onClose={() => setForm((current) => ({ ...current, open: false }))}
        onNeedAccount={goToNewAccount}
      />
    </div>
  );
}
