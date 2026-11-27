/**
 * Categories every new user starts with. They are stored under their pt-BR
 * name; `key` lets the app show them in the user's language. Categories the
 * user creates keep the name they typed.
 */
export const STARTER_CATEGORIES = [
  { key: "salary", name: "Salário", kind: "INCOME" },
  { key: "freelance", name: "Freelance", kind: "INCOME" },
  { key: "investmentIncome", name: "Rendimentos", kind: "INCOME" },
  { key: "refunds", name: "Reembolsos", kind: "INCOME" },
  { key: "giftsReceived", name: "Presentes recebidos", kind: "INCOME" },
  { key: "otherIncome", name: "Outras receitas", kind: "INCOME" },
  { key: "groceries", name: "Mercado", kind: "EXPENSE" },
  { key: "food", name: "Alimentação", kind: "EXPENSE" },
  { key: "restaurants", name: "Restaurantes e delivery", kind: "EXPENSE" },
  { key: "housing", name: "Moradia", kind: "EXPENSE" },
  { key: "utilities", name: "Contas da casa", kind: "EXPENSE" },
  { key: "transport", name: "Transporte", kind: "EXPENSE" },
  { key: "fuel", name: "Combustível", kind: "EXPENSE" },
  { key: "health", name: "Saúde", kind: "EXPENSE" },
  { key: "pharmacy", name: "Farmácia", kind: "EXPENSE" },
  { key: "education", name: "Educação", kind: "EXPENSE" },
  { key: "leisure", name: "Lazer", kind: "EXPENSE" },
  { key: "travel", name: "Viagens", kind: "EXPENSE" },
  { key: "shopping", name: "Compras", kind: "EXPENSE" },
  { key: "clothing", name: "Vestuário", kind: "EXPENSE" },
  { key: "beauty", name: "Beleza e cuidados", kind: "EXPENSE" },
  { key: "subscriptions", name: "Assinaturas", kind: "EXPENSE" },
  { key: "pets", name: "Pets", kind: "EXPENSE" },
  { key: "gifts", name: "Presentes", kind: "EXPENSE" },
  { key: "insurance", name: "Seguros", kind: "EXPENSE" },
  { key: "taxes", name: "Impostos e taxas", kind: "EXPENSE" },
  { key: "bankFees", name: "Tarifas bancárias", kind: "EXPENSE" },
  { key: "donations", name: "Doações", kind: "EXPENSE" },
  { key: "other", name: "Outros", kind: "EXPENSE" },
] as const;

export type StarterCategoryKey = (typeof STARTER_CATEGORIES)[number]["key"];
