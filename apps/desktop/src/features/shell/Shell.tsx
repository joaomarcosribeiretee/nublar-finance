import { useEffect, useRef, useState } from "react";
import logo from "../../../../../assets/logo_semfundo.png";
import { Icon, type IconName } from "@/components/Icon";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { MonthPicker } from "@/components/MonthPicker";
import { currentMonth } from "@/lib/dates";
import { getSupabase } from "@/lib/supabase";
import { usePreferences } from "@/hooks/usePreferences";
import type { Transaction } from "@/lib/queries";
import { InstitutionsScreen } from "@/features/institutions/InstitutionsScreen";
import { AnalyticsScreen } from "@/features/analytics/AnalyticsScreen";
import { CardsScreen } from "@/features/cards/CardsScreen";
import { InvoicesScreen } from "@/features/invoices/InvoicesScreen";
import { BudgetsScreen } from "@/features/planning/BudgetsScreen";
import { CalendarScreen } from "@/features/planning/CalendarScreen";
import { GoalsScreen } from "@/features/planning/GoalsScreen";
import { InvestmentsScreen } from "@/features/investments/InvestmentsScreen";
import { CategoriesScreen } from "@/features/categories/CategoriesScreen";
import { HomeScreen } from "@/features/home/HomeScreen";
import { TransactionForm, type FormPreset } from "@/features/transactions/TransactionForm";
import { TransactionsScreen, type TransactionFilter } from "@/features/transactions/TransactionsScreen";

const screens = {
  home: { label: "Início", icon: "home" },
  transactions: { label: "Lançamentos", icon: "list" },
  accounts: { label: "Instituições", icon: "bank" },
  investments: { label: "Investimentos", icon: "trend" },
  analytics: { label: "Análises", icon: "chart" },
  cards: { label: "Cartões", icon: "card" },
  invoices: { label: "Faturas", icon: "receipt" },
  budgets: { label: "Orçamentos", icon: "gauge" },
  goals: { label: "Metas", icon: "target" },
  calendar: { label: "Calendário", icon: "calendar" },
  categories: { label: "Categorias", icon: "tag" },
} as const satisfies Record<string, { label: string; icon: IconName }>;

type Screen = keyof typeof screens;

/** Sidebar sections: overview, where the money is, setup. */
const navGroups: { title?: string; items: Screen[] }[] = [
  { items: ["home", "analytics", "transactions"] },
  { title: "Patrimônio", items: ["accounts", "investments", "cards", "invoices"] },
  { title: "Planejamento", items: ["budgets", "goals", "calendar"] },
  { title: "Organização", items: ["categories"] },
];

/** The phone tab bar: the daily screens, with the new-entry button between them. */
const tabs: Screen[] = ["home", "transactions", "invoices"];

/**
 * Screens whose numbers depend on the month being browsed. Lançamentos picks
 * its month in the page itself, so the top bar does not repeat it there.
 */
const monthly: Screen[] = ["home", "analytics", "budgets", "calendar"];

export function Shell({ email }: { email: string }) {
  // Loads the saved theme and language and keeps them applied.
  usePreferences();
  const [screen, setScreen] = useState<Screen>("home");
  const [month, setMonth] = useState(currentMonth);
  const [form, setForm] = useState<{
    open: boolean;
    editing: Transaction | null;
    preset?: FormPreset | null;
  }>({
    open: false,
    editing: null,
  });
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [invoiceCard, setInvoiceCard] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [transactionFilter, setTransactionFilter] = useState<TransactionFilter | undefined>();
  const main = useRef<HTMLElement>(null);

  const openNew = () => setForm({ open: true, editing: null });
  const openEdit = (transaction: Transaction) => setForm({ open: true, editing: transaction });

  function go(next: Screen) {
    if (next === "transactions") setTransactionFilter(undefined);
    setScreen(next);
    setMenuOpen(false);
    // A new screen starts at its top, not where the last one was left.
    main.current?.scrollTo({ top: 0 });
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      const typing = ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName) || target.isContentEditable;
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
    go("accounts");
    setCreatingAccount(true);
  }

  const signOut = () => void getSupabase().auth.signOut();

  const navList = (
    <>
      {navGroups.flatMap((group, index) => [
        group.title ? (
          <p
            key={group.title}
            className={`px-3 pb-1 text-[10px] font-medium tracking-[0.14em] text-faint uppercase ${index > 0 ? "pt-4" : ""}`}
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
              className={`nav-item relative flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                active ? "nav-item-active text-accent" : "text-muted hover:bg-hover hover:text-foreground"
              }`}
              onClick={() => go(item)}
            >
              <span
                className={`absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent transition-opacity ${active ? "opacity-100" : "opacity-0"}`}
              />
              <Icon name={screens[item].icon} size={17} />
              {screens[item].label}
            </button>
          );
        }),
      ])}
    </>
  );

  return (
    <div className="app-shell flex h-full">
      <aside className="app-sidebar drag hidden w-64 shrink-0 flex-col px-5 pt-7 pb-5 lg:flex">
        <div className="flex items-center gap-2.5 px-2">
          <img src={logo} alt="" className="h-9 w-9 object-contain" />
          <span className="font-display text-2xl tracking-tight">Nublar</span>
        </div>
        <Button variant="primary" className="no-drag mt-7 w-full" onClick={openNew}>
          <Icon name="plus" size={17} /> Novo lançamento
          <kbd className="ml-auto text-xs opacity-60">N</kbd>
        </Button>

        <nav aria-label="Principal" className="no-drag scroll-quiet mt-6 flex min-h-0 flex-col gap-1 overflow-y-auto">
          {navList}
        </nav>

        <div className="no-drag mt-auto shrink-0 border-t border-line pt-4">
          <p className="truncate px-3 text-xs text-faint" title={email}>
            {email}
          </p>
          <button
            className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-hover hover:text-foreground"
            type="button"
            onClick={signOut}
          >
            <Icon name="logout" size={16} />
            Sair
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Desktop: the window's drag strip. Phone: the app bar. */}
        <div className="app-toolbar drag flex h-14 shrink-0 items-center gap-2 border-b border-line px-4 lg:h-16 lg:px-10 lg:pr-40">
          <img src={logo} alt="" className="h-7 w-7 object-contain lg:hidden" />
          <span className="hidden items-center gap-2 text-xs text-muted lg:flex"><span className="h-1.5 w-1.5 rounded-full bg-accent" />Meu espaço<span className="px-2 text-faint">/</span><span className="text-foreground">{screens[screen].label}</span></span>
          {monthly.includes(screen) ? (
            <div className="ml-auto">
              <MonthPicker month={month} onChange={setMonth} />
            </div>
          ) : (
            <span className="font-display text-lg tracking-tight lg:hidden">Nublar</span>
          )}
        </div>
        <main ref={main} className="flex-1 overflow-x-hidden overflow-y-auto">
          <div
            key={screen}
            className="app-content @container mx-auto max-w-7xl px-4 pt-7 pb-[calc(var(--tabbar)+env(safe-area-inset-bottom,0px)+32px)] sm:px-6 lg:px-10 lg:pt-9 lg:pb-16"
          >
            {screen === "home" ? (
              <HomeScreen
                month={month}
                onNew={openNew}
                onEdit={openEdit}
                onSeeAll={(filter) => { go("transactions"); setTransactionFilter(filter); }}
                onCreateAccount={goToNewAccount}
                onCards={(cardId) => {
                  setInvoiceCard(cardId ?? null);
                  go("invoices");
                }}
                onAnalytics={() => go("analytics")}
                onBudgets={() => go("budgets")}
              />
            ) : null}
            {screen === "transactions" ? (
              <TransactionsScreen month={month} onMonthChange={setMonth} onNew={openNew} onEdit={openEdit} initialFilter={transactionFilter} />
            ) : null}
            {screen === "accounts" ? (
              <InstitutionsScreen
                month={month}
                adding={creatingAccount}
                onAddingChange={setCreatingAccount}
                onOpenCards={() => go("cards")}
                onOpenInvestments={() => go("investments")}
              />
            ) : null}
            {screen === "cards" ? (
              <CardsScreen
                onOpenInvoices={(cardId) => {
                  setInvoiceCard(cardId);
                  go("invoices");
                }}
              />
            ) : null}
            {screen === "invoices" ? (
              <InvoicesScreen
                cardId={invoiceCard}
                onEdit={openEdit}
                onAdd={(preset) => setForm({ open: true, editing: null, preset })}
                onOpenCards={() => go("cards")}
              />
            ) : null}
            {screen === "budgets" ? <BudgetsScreen month={month} /> : null}
            {screen === "goals" ? <GoalsScreen /> : null}
            {screen === "calendar" ? <CalendarScreen month={month} /> : null}
            {screen === "investments" ? <InvestmentsScreen /> : null}
            {screen === "analytics" ? (
              <AnalyticsScreen
                month={month}
                onInspectMonth={(selectedMonth) => { setMonth(selectedMonth); go("transactions"); }}
                onBudgets={() => go("budgets")}
                onInspectCategory={(category) => {
                  go("transactions");
                  setTransactionFilter({ type: "EXPENSE", categoryId: category.id, categoryName: category.name });
                }}
              />
            ) : null}
            {screen === "categories" ? <CategoriesScreen /> : null}
          </div>
        </main>
      </div>

      <nav
        aria-label="Principal"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface lg:hidden"
      >
        <div className="mx-auto grid h-(--tabbar) max-w-xl grid-cols-5 items-center px-1">
          {tabs.slice(0, 2).map((item) => (
            <Tab
              key={item}
              icon={screens[item].icon}
              label={screens[item].label}
              active={screen === item && !menuOpen}
              onClick={() => go(item)}
            />
          ))}
          <button
            type="button"
            aria-label="Novo lançamento"
            className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-accent-fg shadow-lg shadow-shadow/40 transition-[filter,scale] active:scale-95 active:brightness-95"
            onClick={openNew}
          >
            <Icon name="plus" size={20} />
          </button>
          {tabs.slice(2).map((item) => (
            <Tab
              key={item}
              icon={screens[item].icon}
              label={screens[item].label}
              active={screen === item && !menuOpen}
              onClick={() => go(item)}
            />
          ))}
          <Tab
            icon="grid"
            label="Mais"
            active={menuOpen || !tabs.includes(screen)}
            onClick={() => setMenuOpen(true)}
          />
        </div>
      </nav>

      <Modal open={menuOpen} onClose={() => setMenuOpen(false)} title="Nublar">
        <nav aria-label="Todas as telas" className="flex flex-col gap-1">
          {navList}
        </nav>
        <div className="mt-5 border-t border-line pt-4">
          <p className="truncate px-3 text-xs text-faint">{email}</p>
          <button
            className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-muted transition-colors hover:bg-hover hover:text-foreground"
            type="button"
            onClick={signOut}
          >
            <Icon name="logout" size={16} />
            Sair
          </button>
        </div>
      </Modal>

      <TransactionForm
        open={form.open}
        editing={form.editing}
        preset={form.preset}
        month={month}
        onClose={() => setForm((current) => ({ ...current, open: false }))}
        onNeedAccount={goToNewAccount}
      />
    </div>
  );
}

function Tab({
  icon,
  label,
  active,
  onClick,
}: {
  icon: IconName;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      className={`flex h-full min-w-0 flex-col items-center justify-center gap-1 text-[10px] transition-colors ${
        active ? "text-accent" : "text-muted"
      }`}
      onClick={onClick}
    >
      <Icon name={icon} size={20} />
      <span className="max-w-full truncate px-0.5">{label}</span>
    </button>
  );
}
