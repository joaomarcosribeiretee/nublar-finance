import { installmentRows } from './cards.service';

describe('installmentRows', () => {
  const card = {
    id: 'card',
    name: 'Nubank',
    limit: 500000n,
    closingDay: 3,
    dueDay: 10,
    paymentAccountId: null,
    institutionId: null,
  };

  it('bills one installment per consecutive invoice', () => {
    const rows = installmentRows('user', 'purchase', card, {
      cardId: 'card',
      categoryId: 'tech',
      amount: 10000n,
      installments: 3,
      date: '2026-10-20',
    });

    expect(
      rows.map((row) => [row.installmentNumber, row.invoiceMonth, row.amount]),
    ).toEqual([
      [1, '2026-11', 3334n],
      [2, '2026-12', 3333n],
      [3, '2027-01', 3333n],
    ]);
    expect(rows.every((row) => row.accountId === null)).toBe(true);
  });
});
