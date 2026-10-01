import {
  guessMapping,
  merchantKey,
  parseAmount,
  parseCsv,
  parseDate,
  parseOfx,
  splitCsvLine,
  suggestCategory,
} from './parsers';

describe('statement parsing', () => {
  it('reads Brazilian and international amounts without floats', () => {
    expect(parseAmount('-1.234,56')).toBe(-123456n);
    expect(parseAmount('1234.56')).toBe(123456n);
    expect(parseAmount('R$ 45,9')).toBe(4590n);
    expect(parseAmount('1.234')).toBe(123400n);
    expect(parseAmount('(12,00)')).toBe(-1200n);
    expect(parseAmount('12,50-')).toBe(-1250n);
    expect(parseAmount('abc')).toBeNull();
  });

  it('reads the usual date formats', () => {
    expect(parseDate('01/10/2026')).toBe('2026-10-01');
    expect(parseDate('2026-10-01')).toBe('2026-10-01');
    expect(parseDate('20261001120000[-3:BRT]')).toBe('2026-10-01');
    expect(parseDate('31/02/2026')).toBeNull();
  });

  it('parses OFX statements with unclosed tags', () => {
    const ofx = `OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261001120000[-3:BRT]
<TRNAMT>-45.90
<FITID>abc123
<MEMO>COMPRA UBER *TRIP
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261005
<TRNAMT>8500,00
<FITID>abc124
<NAME>SALARIO EMPRESA
</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
    expect(parseOfx(ofx)).toEqual([
      {
        date: '2026-10-01',
        amount: -4590n,
        description: 'COMPRA UBER *TRIP',
        externalId: 'abc123',
      },
      {
        date: '2026-10-05',
        amount: 850000n,
        description: 'SALARIO EMPRESA',
        externalId: 'abc124',
      },
    ]);
  });

  it('honours quotes in CSV fields', () => {
    expect(splitCsvLine('01/10/2026;"Mercado; centro";-12,30', ';')).toEqual([
      '01/10/2026',
      'Mercado; centro',
      '-12,30',
    ]);
  });

  it('guesses the columns of common bank exports', () => {
    expect(
      guessMapping(['Data', 'Valor', 'Identificador', 'Descrição']),
    ).toEqual({
      date: 0,
      amount: 1,
      description: 3,
      invert: false,
    });
    expect(guessMapping(['date', 'title', 'amount'])).toMatchObject({
      invert: true,
    });
    expect(guessMapping(['a', 'b'])).toBeNull();
  });

  it('parses a Nubank account CSV', () => {
    const csv =
      'Data,Valor,Identificador,Descrição\n01/10/2026,-23.90,x1,Compra no débito - IFOOD\n02/10/2026,1500.00,x2,Transferência recebida';
    const result = parseCsv(csv);
    expect(result.rows).toEqual([
      {
        date: '2026-10-01',
        amount: -2390n,
        description: 'Compra no débito - IFOOD',
        externalId: null,
      },
      {
        date: '2026-10-02',
        amount: 150000n,
        description: 'Transferência recebida',
        externalId: null,
      },
    ]);
  });

  it('flips card statements where purchases are positive', () => {
    const csv = 'date,title,amount\n2026-10-01,Netflix.com,55.90';
    expect(parseCsv(csv).rows[0].amount).toBe(-5590n);
  });
});

describe('categorization', () => {
  it('extracts the merchant from noisy descriptions', () => {
    expect(merchantKey('COMPRA CARTAO 12/09 UBER *TRIP SP')).toBe(
      'uber trip sp',
    );
    expect(merchantKey('Pix enviado - Padaria São João')).toBe(
      'padaria sao joao',
    );
  });

  it('prefers the user rules and the longest keyword', () => {
    const rules = [
      { keyword: 'padaria', categoryId: 'food' },
      { keyword: 'padaria sao joao', categoryId: 'breakfast' },
    ];
    const defaults = [{ keyword: 'uber', categoryId: 'transport' }];
    expect(
      suggestCategory('Pix enviado - Padaria São João', rules, defaults),
    ).toBe('breakfast');
    expect(suggestCategory('UBER *TRIP', rules, defaults)).toBe('transport');
    expect(suggestCategory('Loja qualquer', rules, defaults)).toBeNull();
    // Keywords match at the start of a word only.
    expect(
      suggestCategory('Pagamento ESTUBERLANDIA', rules, defaults),
    ).toBeNull();
  });
});
