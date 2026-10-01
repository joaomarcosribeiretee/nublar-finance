export const accountTypeNames = {
  CHECKING: 'Conta corrente',
  SAVINGS: 'Poupança',
  CASH: 'Dinheiro',
  BROKERAGE: 'Saldo na corretora',
  CRYPTO: 'Carteira cripto',
  OTHER: 'Outra conta',
} as const;

type Labelled = {
  name: string;
  type: keyof typeof accountTypeNames;
  institution: { name: string } | null;
};

/**
 * "Nubank · Conta corrente", "Nubank · Caixinha viagem" or "Dinheiro".
 * Everywhere an account is shown it is shown this way.
 */
export function accountLabel(account: Labelled): string {
  const own = account.name.trim() || accountTypeNames[account.type];
  return account.institution ? `${account.institution.name} · ${own}` : own;
}

/** Prisma select for an account reference that can be labelled. */
export const accountRefSelect = {
  id: true,
  name: true,
  type: true,
  institution: { select: { name: true } },
} as const;

export function toAccountRef(
  account: (Labelled & { id: string }) | null,
): { id: string; name: string } | null {
  return account ? { id: account.id, name: accountLabel(account) } : null;
}
