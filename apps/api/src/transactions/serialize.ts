import {
  toAccountRef,
  accountRefSelect,
  type accountTypeNames,
} from '../accounts/account-label';

/** Relations every transaction response carries. */
export const withRelations = {
  account: { select: accountRefSelect },
  destinationAccount: { select: accountRefSelect },
  category: { select: { id: true, name: true, kind: true } },
  card: { select: { id: true, name: true } },
  investment: { select: { id: true, name: true } },
  purchase: {
    select: {
      id: true,
      amount: true,
      installments: true,
      date: true,
      description: true,
    },
  },
} as const;

export type AccountRefRow = {
  id: string;
  name: string;
  type: keyof typeof accountTypeNames;
  institution: { name: string } | null;
};

export type TransactionWithRelations = {
  id: string;
  type: string;
  status: string;
  amount: bigint;
  currency: string;
  description: string;
  date: Date;
  invoiceMonth: string | null;
  installmentNumber: number | null;
  installmentCount: number | null;
  recurringRuleId: string | null;
  account: AccountRefRow | null;
  destinationAccount: AccountRefRow | null;
  category: { id: string; name: string; kind: string } | null;
  card: { id: string; name: string } | null;
  investment: { id: string; name: string } | null;
  purchase: {
    id: string;
    amount: bigint;
    installments: number;
    date: Date;
    description: string;
  } | null;
};

export function serialize(transaction: TransactionWithRelations) {
  return {
    id: transaction.id,
    type: transaction.type,
    status: transaction.status,
    amount: transaction.amount.toString(),
    currency: transaction.currency,
    description: transaction.description,
    date: transaction.date.toISOString().slice(0, 10),
    invoiceMonth: transaction.invoiceMonth,
    installmentNumber: transaction.installmentNumber,
    installmentCount: transaction.installmentCount,
    recurring: transaction.recurringRuleId !== null,
    account: toAccountRef(transaction.account),
    destinationAccount: toAccountRef(transaction.destinationAccount),
    category: transaction.category,
    card: transaction.card,
    investment: transaction.investment,
    purchase: transaction.purchase
      ? {
          id: transaction.purchase.id,
          amount: transaction.purchase.amount.toString(),
          installments: transaction.purchase.installments,
          date: transaction.purchase.date.toISOString().slice(0, 10),
          description: transaction.purchase.description,
        }
      : null,
  };
}
