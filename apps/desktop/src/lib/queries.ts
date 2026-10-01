import {
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "./api";
import type { accountTypeLabels, entryTypeLabels } from "./labels";
import type { FixedIncomeProduct, Indexer, Liquidity } from "./rates";

export type AccountType = keyof typeof accountTypeLabels;
export type EntryType = keyof typeof entryTypeLabels;
export type TransactionType = EntryType | "CARD_PAYMENT" | "INVESTMENT" | "REDEMPTION";
export type AssetClass = "FIXED_INCOME" | "STOCK" | "FII" | "ETF" | "CRYPTO" | "OTHER";
export type CategoryKind = "INCOME" | "EXPENSE";
export type InvoiceStatus = "EMPTY" | "OPEN" | "CLOSED" | "PAID" | "OVERDUE";

type Ref = { id: string; name: string };

export type Institution = {
  id: string;
  name: string;
  color: string;
  cash: string;
  investments: string;
  total: string;
  cardDebt: string;
};

export type Account = {
  id: string;
  /** Optional nickname; `label` is what to show. */
  name: string;
  label: string;
  type: AccountType;
  institution: { id: string; name: string; color: string } | null;
  openingBalance: string;
  balance: string;
};

export type Category = {
  id: string;
  name: string;
  kind: CategoryKind;
  usage: number;
};

export type Transaction = {
  id: string;
  type: TransactionType;
  status: "POSTED" | "PENDING";
  amount: string;
  description: string;
  date: string;
  invoiceMonth: string | null;
  installmentNumber: number | null;
  installmentCount: number | null;
  recurring: boolean;
  account: Ref | null;
  destinationAccount: Ref | null;
  category: Ref | null;
  card: Ref | null;
  investment: Ref | null;
  purchase: {
    id: string;
    amount: string;
    installments: number;
    date: string;
    description: string;
  } | null;
};

export type InvoiceSummary = {
  month: string;
  closingDate: string;
  dueDate: string;
  total: string;
  paid: string;
  remaining: string;
  status: InvoiceStatus;
};

export type Card = {
  id: string;
  name: string;
  limit: string;
  closingDay: number;
  dueDay: number;
  paymentAccountId: string | null;
  institutionId: string | null;
  debt: string;
  available: string;
  currentInvoice: InvoiceSummary;
};

export type InvoiceItem = {
  id: string;
  type: "EXPENSE" | "CARD_PAYMENT";
  amount: string;
  description: string;
  date: string;
  purchaseId: string | null;
  installmentNumber: number | null;
  installmentCount: number | null;
  category: Ref | null;
  account: Ref | null;
};

export type Invoice = InvoiceSummary & {
  card: Omit<Card, "debt" | "available" | "currentInvoice">;
  items: InvoiceItem[];
};

export type RecurringRule = {
  id: string;
  type: CategoryKind;
  /** Per month, or the total when `installments` is set. */
  amount: string;
  installments: number | null;
  description: string;
  dayOfMonth: number;
  startMonth: string;
  endMonth: string | null;
  account: Ref | null;
  card: Ref | null;
  category: Ref;
};

export type Summary = {
  month: string;
  cash: string;
  investments: string;
  netWorth: string;
  income: string;
  expense: string;
  result: string;
  previous: { income: string; expense: string };
  expensesByCategory: { categoryId: string | null; name: string; amount: string }[];
  pending: Transaction[];
  invoices: (InvoiceSummary & { card: Ref })[];
};

export type TransactionInput = {
  type: EntryType;
  accountId: string;
  destinationAccountId?: string;
  categoryId?: string;
  amount: string;
  description: string;
  date: string;
};

export type PurchaseInput = {
  cardId: string;
  categoryId: string;
  amount: string;
  installments: number;
  description: string;
  date: string;
};

export type CardInput = {
  name: string;
  limit: string;
  closingDay: number;
  dueDay: number;
  paymentAccountId: string | null;
  institutionId: string | null;
};

export type RecurringInput = {
  type: CategoryKind;
  accountId?: string | null;
  cardId?: string | null;
  categoryId: string;
  amount: string;
  installments?: number | null;
  description: string;
  dayOfMonth?: number;
  startMonth: string;
  endMonth: string | null;
  /** On a card: purchase date of the first charge. */
  startDate?: string;
  /** Being recorded as it happens: the first occurrence is already real. */
  postFirst?: boolean;
};

export type BudgetStatus = "OK" | "WARNING" | "OVER";

export type Budgets = {
  month: string;
  totals: {
    limit: string;
    spent: string;
    remaining: string;
    usedBps: number;
    status: BudgetStatus;
    unbudgeted: string;
  };
  items: {
    id: string;
    category: Ref;
    limit: string;
    spent: string;
    scheduled: string;
    remaining: string;
    usedBps: number;
    status: BudgetStatus;
  }[];
};

export type Goal = {
  id: string;
  name: string;
  color: string;
  target: string;
  targetDate: string | null;
  manualSaved: string;
  accountIds: string[];
  investmentIds: string[];
  saved: string;
  remaining: string;
  progressBps: number;
  monthsLeft: number | null;
  monthlyNeeded: string | null;
  reached: boolean;
  late: boolean;
};

export type GoalInput = {
  name: string;
  target: string;
  targetDate: string | null;
  manualSaved: string;
  color: string;
  accountIds: string[];
  investmentIds: string[];
};

export type CalendarEvent = {
  id: string;
  kind: string;
  status: string;
  date: string;
  title: string;
  subtitle: string;
  amount: string;
};

export type CalendarMonth = {
  month: string;
  openingCash: string;
  events: CalendarEvent[];
  days: { date: string; cash: string; projected: boolean }[];
};

export type Projection = {
  startCash: string;
  variableEstimate: string;
  basedOnMonths: number;
  months: {
    month: string;
    income: string;
    fixed: string;
    installments: string;
    variableEstimate: string;
    balance: string;
    projectedCash: string;
  }[];
};

export type ImportRow = {
  index: number;
  date: string;
  description: string;
  amount: string;
  type: "INCOME" | "EXPENSE";
  externalId: string | null;
  duplicate: boolean;
  suggestedCategoryId: string | null;
};

export type ImportMapping = { date: number; description: number; amount: number; invert?: boolean };

export type ImportPreview = {
  rows: ImportRow[];
  csv: { header: string[]; mapping: ImportMapping | null; sample: string[][] } | null;
};

type Performance = {
  current: string;
  applied: string;
  redeemed: string;
  gain: string;
  gainBps: number | null;
};

export type InvestmentItem = Performance & {
  id: string;
  name: string;
  assetClass: AssetClass;
  ticker: string;
  quantity: string;
  institution: { id: string; name: string; color: string } | null;
  startDate: string;
  maturityDate: string | null;
  lastValuation: string | null;
  product: FixedIncomeProduct | null;
  indexer: Indexer | null;
  rateBps: number | null;
  liquidity: Liquidity | null;
};

export type Portfolio = {
  totals: Performance;
  allocation: { assetClass: AssetClass; name: string; value: string }[];
  items: InvestmentItem[];
  fixedIncome: {
    daily: string;
    atMaturity: string;
    unknown: string;
    maturities: { id: string; name: string; date: string; value: string }[];
  };
};

export type InvestmentDetail = Performance & {
  id: string;
  name: string;
  assetClass: AssetClass;
  ticker: string;
  quantity: string;
  institutionId: string | null;
  startDate: string;
  maturityDate: string | null;
  product: FixedIncomeProduct | null;
  indexer: Indexer | null;
  rateBps: number | null;
  liquidity: Liquidity | null;
  history: { month: string; value: string }[];
  valuations: { id: string; date: string; value: string }[];
  movements: {
    id: string;
    type: "INVESTMENT" | "REDEMPTION";
    amount: string;
    date: string;
    account: Ref | null;
  }[];
};

export type InvestmentInput = {
  name: string;
  assetClass: AssetClass;
  institutionId: string | null;
  ticker: string;
  quantity: string;
  maturityDate: string | null;
  product: FixedIncomeProduct | null;
  indexer: Indexer | null;
  rateBps: number | null;
  liquidity: Liquidity | null;
};

export type Analytics = {
  from: string;
  to: string;
  kpis: {
    netWorth: string;
    netWorthChange: string;
    netWorthChangeBps: number | null;
    averageIncome: string;
    averageExpense: string;
    savingsRateBps: number | null;
    invested: string;
    trackedMonths: number;
  };
  series: {
    month: string;
    tracked: boolean;
    income: string;
    expense: string;
    result: string;
    invested: string;
    savingsRateBps: number | null;
    fixed: string;
    installments: string;
    variable: string;
    netWorth: string;
    cash: string;
    investments: string;
    cardDebt: string;
  }[];
  categories: {
    categoryId: string | null;
    name: string;
    amount: string;
    previous: string;
    average: string;
  }[];
  allocation: { key: string; name: string; value: string }[];
  commitments: {
    month: string;
    installments: string;
    recurringExpense: string;
    recurringIncome: string;
    balance: string;
  }[];
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const keys = {
  accounts: ["accounts"] as const,
  institutions: ["institutions"] as const,
  categories: ["categories"] as const,
  cards: ["cards"] as const,
  recurring: ["recurring"] as const,
  investments: ["investments"] as const,
  transactions: (month: string) => ["transactions", month] as const,
  summary: (month: string) => ["summary", month] as const,
  invoice: (cardId: string, month: string) => ["invoice", cardId, month] as const,
};

export function useAccounts() {
  return useQuery({ queryKey: keys.accounts, queryFn: () => api<Account[]>("/accounts") });
}

export function useInstitutions() {
  return useQuery({
    queryKey: keys.institutions,
    queryFn: () => api<Institution[]>("/institutions"),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: keys.categories,
    queryFn: () => api<Category[]>("/categories"),
  });
}

export function useCards() {
  return useQuery({ queryKey: keys.cards, queryFn: () => api<Card[]>("/cards") });
}

export function useRecurring() {
  return useQuery({
    queryKey: keys.recurring,
    queryFn: () => api<RecurringRule[]>("/recurring"),
  });
}

export function usePortfolio() {
  return useQuery({
    queryKey: keys.investments,
    queryFn: () => api<Portfolio>("/investments"),
  });
}

export function useInvestment(id: string) {
  return useQuery({
    queryKey: ["investment", id],
    queryFn: () => api<InvestmentDetail>(`/investments/${id}`),
  });
}

export function useAnalytics(to: string, months: number) {
  return useQuery({
    queryKey: ["analytics", to, months],
    queryFn: () => api<Analytics>(`/analytics?to=${to}&months=${months}`),
    placeholderData: (previous) => previous,
  });
}

export function useBudgets(month: string) {
  return useQuery({
    queryKey: ["budgets", month],
    queryFn: () => api<Budgets>(`/budgets?month=${month}`),
    placeholderData: (previous) => previous,
  });
}

export function useGoals() {
  return useQuery({ queryKey: ["goals"], queryFn: () => api<Goal[]>("/goals") });
}

export function useCalendar(month: string) {
  return useQuery({
    queryKey: ["calendar", month],
    queryFn: () => api<CalendarMonth>(`/calendar?month=${month}`),
    placeholderData: (previous) => previous,
  });
}

export function useProjection(months: number) {
  return useQuery({
    queryKey: ["projection", months],
    queryFn: () => api<Projection>(`/projection?months=${months}`),
  });
}

export function useTransactions(month: string) {
  return useQuery({
    queryKey: keys.transactions(month),
    queryFn: () => api<Transaction[]>(`/transactions?month=${month}`),
    placeholderData: (previous) => previous,
  });
}

export function useSummary(month: string) {
  return useQuery({
    queryKey: keys.summary(month),
    queryFn: () => api<Summary>(`/summary?month=${month}`),
    placeholderData: (previous) => previous,
  });
}

export function useInvoice(cardId: string, month: string) {
  return useQuery({
    queryKey: keys.invoice(cardId, month),
    queryFn: () => api<Invoice>(`/cards/${cardId}/invoices/${month}`),
    placeholderData: (previous) => previous,
  });
}

/** Anything that moves money changes balances, lists and the dashboard. */
function useInvalidateMoney() {
  const client = useQueryClient();
  return () =>
    Promise.all(
      [
        ["transactions"],
        ["summary"],
        ["invoice"],
        keys.accounts,
        keys.institutions,
        keys.categories,
        keys.cards,
        keys.recurring,
        keys.investments,
        ["investment"],
        ["analytics"],
        ["budgets"],
        ["goals"],
        ["calendar"],
        ["projection"],
      ].map((queryKey) => client.invalidateQueries({ queryKey })),
    );
}

function useMoneyMutation<Input, Output = unknown>(
  mutationFn: (input: Input) => Promise<Output>,
) {
  const invalidate = useInvalidateMoney();
  return useMutation({ mutationFn, onSuccess: invalidate });
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const useSaveTransaction = () =>
  useMoneyMutation(({ id, input }: { id?: string; input: TransactionInput }) =>
    api<Transaction>(id ? `/transactions/${id}` : "/transactions", json(id ? "PUT" : "POST", input)),
  );

export const useDeleteTransaction = () =>
  useMoneyMutation((id: string) => api<void>(`/transactions/${id}`, json("DELETE")));

export const useConfirmTransaction = () =>
  useMoneyMutation(({ id, amount, date }: { id: string; amount?: string; date?: string }) =>
    api(`/transactions/${id}/confirm`, json("POST", { amount, date })),
  );

export const useSkipTransaction = () =>
  useMoneyMutation((id: string) => api<void>(`/transactions/${id}/skip`, json("POST")));

export const useSavePurchase = () =>
  useMoneyMutation(({ id, input }: { id?: string; input: PurchaseInput }) =>
    api(id ? `/card-purchases/${id}` : "/card-purchases", json(id ? "PUT" : "POST", input)),
  );

export const useDeletePurchase = () =>
  useMoneyMutation((id: string) => api<void>(`/card-purchases/${id}`, json("DELETE")));

export const useSaveCard = () =>
  useMoneyMutation(({ id, input }: { id?: string; input: CardInput }) =>
    api(id ? `/cards/${id}` : "/cards", json(id ? "PUT" : "POST", input)),
  );

export const useDeleteCard = () =>
  useMoneyMutation((id: string) => api<void>(`/cards/${id}`, json("DELETE")));

export const usePayInvoice = () =>
  useMoneyMutation(
    ({ cardId, ...input }: { cardId: string; accountId: string; amount: string; date: string; invoiceMonth: string }) =>
      api(`/cards/${cardId}/payments`, json("POST", input)),
  );

export const useSaveRecurring = () =>
  useMoneyMutation(({ id, input }: { id?: string; input: RecurringInput }) =>
    api(id ? `/recurring/${id}` : "/recurring", json(id ? "PUT" : "POST", input)),
  );

export const useDeleteRecurring = () =>
  useMoneyMutation((id: string) => api<void>(`/recurring/${id}`, json("DELETE")));

export type AccountInput = {
  name: string;
  type: AccountType;
  institutionId: string | null;
  openingBalance: string;
};

export const useCreateAccount = () =>
  useMoneyMutation((input: AccountInput) =>
    api<{ id: string }>("/accounts", json("POST", input)),
  );

export const useUpdateAccount = () =>
  useMoneyMutation(({ id, ...input }: { id: string; name: string; openingBalance: string }) =>
    api(`/accounts/${id}`, json("PATCH", input)),
  );

export const useCreateInstitution = () =>
  useMoneyMutation((input: { name: string; color: string }) =>
    api<{ id: string; name: string; color: string }>("/institutions", json("POST", input)),
  );

export const useUpdateInstitution = () =>
  useMoneyMutation(({ id, ...input }: { id: string; name: string; color: string }) =>
    api(`/institutions/${id}`, json("PATCH", input)),
  );

export const useDeleteInstitution = () =>
  useMoneyMutation((id: string) => api<void>(`/institutions/${id}`, json("DELETE")));

export const useDeleteAccount = () =>
  useMoneyMutation((id: string) => api<void>(`/accounts/${id}`, json("DELETE")));

export const useCreateCategory = () =>
  useMoneyMutation((input: { name: string; kind: CategoryKind }) =>
    api<Category>("/categories", json("POST", input)),
  );

export const useDeleteCategory = () =>
  useMoneyMutation((id: string) => api<void>(`/categories/${id}`, json("DELETE")));

export const useCreateInvestment = () =>
  useMoneyMutation(
    (input: InvestmentInput & { openingApplied?: string; currentValue: string; startDate?: string }) =>
      api<{ id: string }>("/investments", json("POST", input)),
  );

export const useUpdateInvestment = () =>
  useMoneyMutation(({ id, input }: { id: string; input: InvestmentInput }) =>
    api(`/investments/${id}`, json("PUT", input)),
  );

export const useDeleteInvestment = () =>
  useMoneyMutation((id: string) => api<void>(`/investments/${id}`, json("DELETE")));

export const useMoveInvestment = () =>
  useMoneyMutation(
    ({ id, ...input }: { id: string; type: "INVESTMENT" | "REDEMPTION"; accountId: string; amount: string; date: string }) =>
      api(`/investments/${id}/movements`, json("POST", input)),
  );

export const useAddValuations = () =>
  useMoneyMutation((input: { date: string; items: { investmentId: string; value: string }[] }) =>
    api<{ updated: number }>("/investments/valuations", json("POST", input)),
  );

export const useAddValuation = () =>
  useMoneyMutation(({ id, ...input }: { id: string; value: string; date: string }) =>
    api(`/investments/${id}/valuations`, json("POST", input)),
  );

export const useDeleteValuation = () =>
  useMoneyMutation(({ id, valuationId }: { id: string; valuationId: string }) =>
    api<void>(`/investments/${id}/valuations/${valuationId}`, json("DELETE")),
  );

export const useSaveBudget = () =>
  useMoneyMutation((input: { categoryId: string; amount: string }) =>
    api("/budgets", json("PUT", input)),
  );

export const useDeleteBudget = () =>
  useMoneyMutation((id: string) => api<void>(`/budgets/${id}`, json("DELETE")));

export const useSaveGoal = () =>
  useMoneyMutation(({ id, input }: { id?: string; input: GoalInput }) =>
    api(id ? `/goals/${id}` : "/goals", json(id ? "PUT" : "POST", input)),
  );

export const useDeleteGoal = () =>
  useMoneyMutation((id: string) => api<void>(`/goals/${id}`, json("DELETE")));

export const usePreviewImport = () =>
  useMutation({
    mutationFn: (input: { accountId: string; format: "OFX" | "CSV"; content: string; mapping?: ImportMapping }) =>
      api<ImportPreview>("/imports/preview", json("POST", input)),
  });

export const useCommitImport = () =>
  useMoneyMutation(
    (input: {
      accountId: string;
      source: "OFX_IMPORT" | "CSV_IMPORT";
      rows: { date: string; description: string; amount: string; categoryId: string; externalId: string | null }[];
    }) => api<{ imported: number; skipped: number; learned: number }>("/imports/commit", json("POST", input)),
  );
