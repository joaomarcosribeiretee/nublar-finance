export const accountTypeLabels = {
  CHECKING: "Conta corrente",
  SAVINGS: "Poupança / Caixinha",
  CASH: "Dinheiro",
  BROKERAGE: "Saldo na corretora",
  CRYPTO: "Carteira cripto",
  OTHER: "Outra conta",
} as const;

export const entryTypeLabels = {
  INCOME: "Receita",
  EXPENSE: "Despesa",
  TRANSFER: "Transferência",
} as const;

export const assetClassLabels = {
  FIXED_INCOME: "Renda fixa",
  STOCK: "Ações",
  FII: "FIIs",
  ETF: "ETFs",
  CRYPTO: "Cripto",
  OTHER: "Outros",
} as const;

export const invoiceStatusLabels = {
  EMPTY: "Sem compras",
  OPEN: "Aberta",
  CLOSED: "Fechada",
  PAID: "Paga",
  OVERDUE: "Vencida",
} as const;
