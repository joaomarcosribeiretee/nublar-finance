import { accountLabel } from './account-label';

describe('accountLabel', () => {
  it('reads as institution and type when there is no nickname', () => {
    expect(
      accountLabel({
        name: '',
        type: 'CHECKING',
        institution: { name: 'Nubank' },
      }),
    ).toBe('Nubank · Conta corrente');
  });

  it('prefers the nickname', () => {
    expect(
      accountLabel({
        name: 'Caixinha viagem',
        type: 'SAVINGS',
        institution: { name: 'Nubank' },
      }),
    ).toBe('Nubank · Caixinha viagem');
  });

  it('stands alone outside an institution', () => {
    expect(accountLabel({ name: '', type: 'CASH', institution: null })).toBe(
      'Dinheiro',
    );
  });
});
