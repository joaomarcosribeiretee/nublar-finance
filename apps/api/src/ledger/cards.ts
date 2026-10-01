import { shiftMonth } from './month';

/** Rules from docs/decisions/0001-regras-de-compromissos.md. */

export type CardCycle = { closingDay: number; dueDay: number };

function daysIn(month: string): number {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

/** Day of a month, clamped so 31 in February becomes the 28th/29th. */
export function dayOf(month: string, day: number): string {
  const clamped = Math.min(day, daysIn(month));
  return `${month}-${String(clamped).padStart(2, '0')}`;
}

/**
 * Invoice (named by its due month) that a purchase on `date` falls into.
 * Purchases on the closing day or later go to the next cycle.
 */
export function invoiceMonthFor(date: string, card: CardCycle): string {
  const purchaseMonth = date.slice(0, 7);
  const closingDate = dayOf(purchaseMonth, card.closingDay);
  const closingMonth =
    date >= closingDate ? shiftMonth(purchaseMonth, 1) : purchaseMonth;
  return card.dueDay > card.closingDay
    ? closingMonth
    : shiftMonth(closingMonth, 1);
}

/** Closing and due dates of the invoice due in `invoiceMonth`. */
export function invoiceDates(
  invoiceMonth: string,
  card: CardCycle,
): { closingDate: string; dueDate: string } {
  const closingMonth =
    card.dueDay > card.closingDay ? invoiceMonth : shiftMonth(invoiceMonth, -1);
  return {
    closingDate: dayOf(closingMonth, card.closingDay),
    dueDate: dayOf(invoiceMonth, card.dueDay),
  };
}

/** Splits in whole cents; the remainder goes to the first installment. */
export function splitInstallments(total: bigint, count: number): bigint[] {
  if (count < 1 || total <= 0n) {
    throw new Error('Invalid installment plan');
  }
  const n = BigInt(count);
  const base = total / n;
  const remainder = total % n;
  return Array.from({ length: count }, (_, index) =>
    index === 0 ? base + remainder : base,
  );
}

export type InvoiceStatus = 'EMPTY' | 'OPEN' | 'CLOSED' | 'PAID' | 'OVERDUE';

export function invoiceStatus(input: {
  total: bigint;
  paid: bigint;
  today: string;
  closingDate: string;
  dueDate: string;
}): InvoiceStatus {
  if (input.total <= 0n) {
    return 'EMPTY';
  }
  if (input.paid >= input.total) {
    return 'PAID';
  }
  if (input.today < input.closingDate) {
    return 'OPEN';
  }
  if (input.today <= input.dueDate) {
    return 'CLOSED';
  }
  return 'OVERDUE';
}
