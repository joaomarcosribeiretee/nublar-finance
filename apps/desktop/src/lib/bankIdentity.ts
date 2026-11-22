import { bankMarks } from "./bankMarks";

/** "Banco do Brasil" → "banco-do-brasil"; "Itaú" → "itau". */
export function bankSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Names people type for the same brand, pointing at the mark's key. */
const aliases: Record<string, string> = {
  nu: "nubank",
  "nu-pagamentos": "nubank",
  "mercado-pago": "mercadopago",
  pagbank: "pagseguro",
  "pagbank-pagseguro": "pagseguro",
  "banco-neon": "neon",
};

/** The Simple Icons path for an institution, when the collection has it. */
export function bankMark(name: string): string | null {
  const slug = bankSlug(name);
  const key = aliases[slug] ?? slug.replace(/-/g, "");
  return bankMarks[key] ?? null;
}

const filler = new Set(["banco", "bank", "de", "do", "da", "dos", "das", "e", "s.a.", "sa"]);

/**
 * Two characters that read as the institution: a short code it already uses
 * ("C6", "XP", "BTG" → "BT"), else the initials of its words ("Banco do
 * Brasil" → "BB"), else its first letter ("Itaú" → "I").
 */
export function bankInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const code = words.find((word) => word.length <= 3 && /^[A-Z0-9]+$/.test(word));
  if (code) {
    return code.slice(0, 2);
  }
  const meaningful = words.filter((word) => !filler.has(word.toLowerCase()));
  // "Banco do Brasil" is BB to everyone: a leading "Banco" stays as the B.
  const source = words.length > 1 && /^banco$/i.test(words[0]) && meaningful.length > 0 ? [words[0], meaningful[0]] : meaningful;
  if (source.length >= 2) {
    return (source[0][0] + source[1][0]).toUpperCase();
  }
  return (source[0] ?? name).slice(0, 1).toUpperCase();
}

/** Dark text on light brand colors (BB yellow, Binance), white on the rest. */
export function inkFor(hex: string): "#ffffff" | "#0a0f0d" {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) {
    return "#ffffff";
  }
  const value = parseInt(match[1], 16);
  const channel = (shift: number) => {
    const c = ((value >> shift) & 255) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
  // Pick whichever of the two inks contrasts more against the tile.
  return (luminance + 0.05) / 0.05 > 1.05 / (luminance + 0.05) ? "#0a0f0d" : "#ffffff";
}
