import type { AccountType } from "./queries";

export type InstitutionSuggestion = {
  name: string;
  color: string;
  /** What people usually have there, pre-selected in the wizard. */
  usual: ("CARD" | AccountType)[];
};

/** Common Brazilian institutions. Colors are just tags for recognition. */
export const institutionSuggestions: InstitutionSuggestion[] = [
  { name: "Nubank", color: "#8a05be", usual: ["CHECKING", "CARD"] },
  { name: "Itaú", color: "#ec7000", usual: ["CHECKING", "CARD"] },
  { name: "Bradesco", color: "#cc092f", usual: ["CHECKING", "CARD"] },
  { name: "Banco do Brasil", color: "#e6c200", usual: ["CHECKING", "CARD"] },
  { name: "Caixa", color: "#005ca9", usual: ["CHECKING", "SAVINGS"] },
  { name: "Santander", color: "#ec0000", usual: ["CHECKING", "CARD"] },
  { name: "Inter", color: "#ff7a00", usual: ["CHECKING", "CARD"] },
  { name: "C6 Bank", color: "#6b6b6b", usual: ["CHECKING", "CARD"] },
  { name: "BTG Pactual", color: "#1d4f91", usual: ["BROKERAGE"] },
  { name: "XP", color: "#c9a227", usual: ["BROKERAGE"] },
  { name: "Rico", color: "#ff5a00", usual: ["BROKERAGE"] },
  { name: "Mercado Pago", color: "#00b1ea", usual: ["CHECKING"] },
  { name: "PicPay", color: "#21c25e", usual: ["CHECKING"] },
  { name: "Binance", color: "#f0b90b", usual: ["CRYPTO"] },
];

export const institutionColors = [
  "#6cc495",
  "#8fa8cc",
  "#c9a45c",
  "#b28bd6",
  "#e58a7c",
  "#e0a86b",
  "#5fb3b3",
  "#8a9a90",
];
