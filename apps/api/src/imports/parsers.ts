/**
 * Statement parsing for imports. Everything here is pure: text in, rows out.
 * Amounts are read as text and turned into minor units without floats.
 */

export type ParsedRow = {
  date: string;
  description: string;
  /** Signed minor units: negative = money left the account. */
  amount: bigint;
  /** Bank id of the entry when the file has one (OFX FITID). */
  externalId: string | null;
};

/**
 * "-1.234,56", "1234.56", "R$ 45,90", "(12,00)" → minor units.
 * With both separators, the last one is the decimal mark.
 */
export function parseAmount(raw: string): bigint | null {
  let text = raw
    .trim()
    .replace(/^R\$\s*/i, '')
    .replace(/\s/g, '');
  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  if (text.startsWith('-')) {
    negative = !negative;
    text = text.slice(1);
  } else if (text.startsWith('+')) {
    text = text.slice(1);
  }
  if (text.endsWith('-')) {
    negative = !negative;
    text = text.slice(0, -1);
  }
  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');
  let decimal: ',' | '.' | null = null;
  if (lastComma >= 0 && lastDot >= 0) {
    decimal = lastComma > lastDot ? ',' : '.';
  } else if (lastComma >= 0) {
    decimal = ',';
  } else if (lastDot >= 0) {
    // "1.234" is a thousand; "12.5" and "12.50" are decimals.
    decimal =
      /\.\d{1,2}$/.test(text) && text.split('.').length === 2 ? '.' : null;
  }
  let whole = text;
  let fraction = '';
  if (decimal) {
    const index = text.lastIndexOf(decimal);
    whole = text.slice(0, index);
    fraction = text.slice(index + 1);
  }
  whole = whole.replace(/[.,]/g, '');
  if (!/^\d+$/.test(whole || '0') || !/^\d{0,2}$/.test(fraction)) {
    return null;
  }
  const value =
    BigInt(whole || '0') * 100n + BigInt(fraction.padEnd(2, '0') || '0');
  return negative ? -value : value;
}

/** "01/10/2026", "2026-10-01", "01-10-2026", "20261001…" → "2026-10-01". */
export function parseDate(raw: string): string | null {
  const text = raw.trim();
  let match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (match) return valid(match[1], match[2], match[3]);
  match = /^(\d{2})[/.-](\d{2})[/.-](\d{4})/.exec(text);
  if (match) return valid(match[3], match[2], match[1]);
  match = /^(\d{2})[/.-](\d{2})[/.-](\d{2})$/.exec(text);
  if (match) return valid(`20${match[3]}`, match[2], match[1]);
  match = /^(\d{4})(\d{2})(\d{2})/.exec(text);
  if (match) return valid(match[1], match[2], match[3]);
  return null;
}

function valid(year: string, month: string, day: string): string | null {
  const date = `${year}-${month}-${day}`;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().startsWith(date)
    ? date
    : null;
}

/** OFX 1.x (SGML, tags often unclosed) and 2.x (XML). */
export function parseOfx(content: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const blocks = content.split(/<STMTTRN>/i).slice(1);
  for (const block of blocks) {
    const body = block.split(/<\/STMTTRN>/i)[0];
    const tag = (name: string) => {
      const match = new RegExp(`<${name}>([^<\\r\\n]*)`, 'i').exec(body);
      return match ? match[1].trim() : '';
    };
    const date = parseDate(tag('DTPOSTED'));
    const amount = parseAmount(tag('TRNAMT'));
    if (!date || amount === null) continue;
    const description = [tag('NAME'), tag('MEMO')]
      .filter((part, index, all) => part && all.indexOf(part) === index)
      .join(' · ');
    rows.push({
      date,
      amount,
      description: decodeEntities(description) || 'Sem descrição',
      externalId: tag('FITID') || null,
    });
  }
  return rows;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export type CsvMapping = {
  date: number;
  description: number;
  amount: number;
  /** Card statements list purchases as positive numbers: flip them. */
  invert?: boolean;
};

/** Splits a CSV line honouring quotes ("a;b" stays one field). */
export function splitCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

export function detectDelimiter(header: string): string {
  const counts = [';', ',', '\t'].map(
    (d) => [d, splitCsvLine(header, d).length] as const,
  );
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][0];
}

const normalizeHeader = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Guesses which columns hold date, description and amount from the header. */
export function guessMapping(header: string[]): CsvMapping | null {
  const names = header.map(normalizeHeader);
  const find = (patterns: RegExp[]) =>
    names.findIndex((name) => patterns.some((pattern) => pattern.test(name)));
  const date = find([/^data/, /^date$/, /dt\.?\s?lanc/]);
  const amount = find([/^valor/, /^amount$/, /^value$/, /quantia/]);
  let description = find([
    /descri/,
    /historico/,
    /^title$/,
    /lancamento$/,
    /estabelecimento/,
    /memo/,
  ]);
  if (description === date || description === amount) description = -1;
  if (date < 0 || amount < 0 || description < 0) return null;
  // Nubank's card CSV ("date,title,amount") lists purchases as positives.
  const invert = names.includes('title') && names.includes('amount');
  return { date, description, amount, invert };
}

export function parseCsv(
  content: string,
  mapping?: CsvMapping,
): {
  header: string[];
  rows: ParsedRow[];
  mapping: CsvMapping | null;
  sample: string[][];
} {
  const lines = content
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (lines.length === 0)
    return { header: [], rows: [], mapping: null, sample: [] };
  const delimiter = detectDelimiter(lines[0]);
  const header = splitCsvLine(lines[0], delimiter);
  const used = mapping ?? guessMapping(header);
  const body = lines.slice(1).map((line) => splitCsvLine(line, delimiter));
  if (!used)
    return { header, rows: [], mapping: null, sample: body.slice(0, 5) };

  const rows: ParsedRow[] = [];
  for (const fields of body) {
    const date = parseDate(fields[used.date] ?? '');
    const amount = parseAmount(fields[used.amount] ?? '');
    if (!date || amount === null || amount === 0n) continue;
    rows.push({
      date,
      amount: used.invert ? -amount : amount,
      description: (fields[used.description] ?? '').trim() || 'Sem descrição',
      externalId: null,
    });
  }
  return { header, rows, mapping: used, sample: body.slice(0, 5) };
}

/**
 * The merchant part of a description, for matching rules:
 * "COMPRA CARTAO 12/09 UBER *TRIP SP" → "uber trip sp".
 */
export function merchantKey(description: string): string {
  const noise = new Set([
    'compra',
    'cartao',
    'debito',
    'credito',
    'pix',
    'enviado',
    'recebido',
    'transferencia',
    'pagamento',
    'pag',
    'pagto',
    'ted',
    'doc',
    'boleto',
    'no',
    'na',
    'de',
    'do',
    'da',
    'em',
    'para',
    'com',
    'via',
    'ltda',
    'sa',
    'me',
    'eireli',
    'brasil',
    'br',
    'internet',
    'app',
    'parcela',
  ]);
  return description
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1 && !/\d/.test(word) && !noise.has(word))
    .slice(0, 3)
    .join(' ');
}

/** Starter dictionary: keyword in the description → starter category name. */
export const DEFAULT_KEYWORDS: [string, string][] = [
  ['uber', 'Transporte'],
  ['99app', 'Transporte'],
  ['99 pop', 'Transporte'],
  ['cabify', 'Transporte'],
  ['metro', 'Transporte'],
  ['ifood', 'Restaurantes e delivery'],
  ['rappi', 'Restaurantes e delivery'],
  ['ze delivery', 'Restaurantes e delivery'],
  ['mcdonald', 'Restaurantes e delivery'],
  ['burger', 'Restaurantes e delivery'],
  ['netflix', 'Assinaturas'],
  ['spotify', 'Assinaturas'],
  ['prime video', 'Assinaturas'],
  ['amazon prime', 'Assinaturas'],
  ['disney', 'Assinaturas'],
  ['hbo', 'Assinaturas'],
  ['youtube', 'Assinaturas'],
  ['apple com bill', 'Assinaturas'],
  ['google', 'Assinaturas'],
  ['posto', 'Combustível'],
  ['shell', 'Combustível'],
  ['ipiranga', 'Combustível'],
  ['petrobras', 'Combustível'],
  ['drogasil', 'Farmácia'],
  ['raia', 'Farmácia'],
  ['pague menos', 'Farmácia'],
  ['farma', 'Farmácia'],
  ['drogaria', 'Farmácia'],
  ['carrefour', 'Mercado'],
  ['assai', 'Mercado'],
  ['atacadao', 'Mercado'],
  ['pao de acucar', 'Mercado'],
  ['supermercado', 'Mercado'],
  ['mercado', 'Mercado'],
  ['hortifruti', 'Mercado'],
  ['enel', 'Contas da casa'],
  ['sabesp', 'Contas da casa'],
  ['cemig', 'Contas da casa'],
  ['vivo', 'Contas da casa'],
  ['claro', 'Contas da casa'],
  ['condominio', 'Moradia'],
  ['aluguel', 'Moradia'],
  ['smart fit', 'Saúde'],
  ['unimed', 'Saúde'],
  ['amil', 'Saúde'],
  ['tarifa', 'Tarifas bancárias'],
  ['iof', 'Impostos e taxas'],
  ['salario', 'Salário'],
  ['folha', 'Salário'],
  ['rendimento', 'Rendimentos'],
  ['dividendo', 'Rendimentos'],
  ['estorno', 'Reembolsos'],
];

/**
 * Best category for a description: the user's own rules first (longest
 * keyword wins), then the starter dictionary.
 */
export function suggestCategory(
  description: string,
  rules: { keyword: string; categoryId: string }[],
  defaults: { keyword: string; categoryId: string }[],
): string | null {
  // Words separated by single spaces, so keywords match at word starts only
  // ("tim" must not match "otimo").
  const text = ` ${description
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()}`;
  for (const list of [rules, defaults]) {
    let best: { keyword: string; categoryId: string } | null = null;
    for (const rule of list) {
      if (
        rule.keyword &&
        text.includes(` ${rule.keyword}`) &&
        (!best || rule.keyword.length > best.keyword.length)
      ) {
        best = rule;
      }
    }
    if (best) return best.categoryId;
  }
  return null;
}
