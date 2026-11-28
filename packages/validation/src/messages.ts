import type { Locale } from "./locale";

/**
 * Error map per language. Schemas carry the key as their message; whoever
 * shows the error (the API, from the request's Accept-Language) translates it
 * with `translateValidationMessage`. pt-BR is the source of truth.
 */
const ptBR = {
  amountInteger: "Valor deve ser inteiro em centavos",
  amountPositive: "Valor deve ser maior que zero",
  amountNegative: "Valor não pode ser negativo",
  amountZero: "Valor zerado",
  invalidDate: "Data inválida",
  invalidMonth: "Mês deve usar AAAA-MM",
  nameRequired: "Informe um nome",
  nameTooLong: "Nome muito longo",
  descriptionTooLong: "Descrição muito longa",
  invalidColor: "Cor inválida",
  invalidInstitution: "Instituição inválida",
  chooseAccount: "Escolha uma conta",
  chooseDestination: "Escolha a conta de destino",
  sameAccounts: "Contas de origem e destino devem ser diferentes",
  transferWithCategory: "Transferências não têm categoria",
  destinationNotTransfer: "Somente transferências têm conta de destino",
  chooseCategory: "Escolha uma categoria",
  chooseCard: "Escolha um cartão",
  accountOrCard: "Escolha uma conta ou um cartão",
  cardExpenseOnly: "Cartão só tem despesas",
  dayOfMonth: "Informe um dia entre 1 e 31",
  dayRequired: "Informe o dia do mês",
  monthStartDay: "Informe um dia entre 1 e 28",
  endBeforeStart: "O fim precisa ser depois do início",
  limitNegative: "Limite não pode ser negativo",
  minOneInstallment: "Mínimo 1 parcela",
  max48Installments: "Máximo 48 parcelas",
  minTwoInstallments: "Parcelado precisa de ao menos 2 parcelas",
  max120Installments: "Máximo 120 parcelas",
  tickerTooLong: "Código muito longo",
  invalidQuantity: "Quantidade inválida",
  invalidRate: "Taxa inválida",
  chooseCoin: "Escolha uma moeda com cotação",
  quantityRequired: "Informe a quantidade para usar a cotação",
  currentValueRequired: "Informe quanto você tem hoje",
  nothingToUpdate: "Nada para atualizar",
  emptyFile: "Arquivo vazio",
  fileTooBig: "Arquivo grande demais",
  nothingToImport: "Nada para importar",
  importTooMany: "Importe no máximo 2.000 lançamentos por vez",
  tooManyTips: "Dicas demais",
};

export type ValidationMessageKey = keyof typeof ptBR;

const en: Record<ValidationMessageKey, string> = {
  amountInteger: "Amount must be a whole number of cents",
  amountPositive: "Amount must be greater than zero",
  amountNegative: "Amount can't be negative",
  amountZero: "Amount is zero",
  invalidDate: "Invalid date",
  invalidMonth: "Month must use YYYY-MM",
  nameRequired: "Enter a name",
  nameTooLong: "Name is too long",
  descriptionTooLong: "Description is too long",
  invalidColor: "Invalid color",
  invalidInstitution: "Invalid institution",
  chooseAccount: "Choose an account",
  chooseDestination: "Choose the destination account",
  sameAccounts: "Source and destination accounts must be different",
  transferWithCategory: "Transfers don't have a category",
  destinationNotTransfer: "Only transfers have a destination account",
  chooseCategory: "Choose a category",
  chooseCard: "Choose a card",
  accountOrCard: "Choose an account or a card",
  cardExpenseOnly: "Cards only have expenses",
  dayOfMonth: "Enter a day between 1 and 31",
  dayRequired: "Enter the day of the month",
  monthStartDay: "Enter a day between 1 and 28",
  endBeforeStart: "The end must be after the start",
  limitNegative: "Limit can't be negative",
  minOneInstallment: "At least 1 installment",
  max48Installments: "At most 48 installments",
  minTwoInstallments: "Installments need at least 2 payments",
  max120Installments: "At most 120 installments",
  tickerTooLong: "Ticker is too long",
  invalidQuantity: "Invalid quantity",
  invalidRate: "Invalid rate",
  chooseCoin: "Choose a coin with a quote",
  quantityRequired: "Enter the quantity to use the quote",
  currentValueRequired: "Enter how much you have today",
  nothingToUpdate: "Nothing to update",
  emptyFile: "Empty file",
  fileTooBig: "File is too large",
  nothingToImport: "Nothing to import",
  importTooMany: "Import at most 2,000 entries at a time",
  tooManyTips: "Too many tips",
};

export const validationMessages: Record<Locale, Record<ValidationMessageKey, string>> = {
  "pt-BR": ptBR,
  en,
};

/** Typed message key for a schema: a typo is a compile error. */
export function msg(key: ValidationMessageKey): ValidationMessageKey {
  return key;
}

function isMessageKey(message: string): message is ValidationMessageKey {
  return Object.hasOwn(ptBR, message);
}

/** The text of a schema message in `locale`; anything else passes through. */
export function translateValidationMessage(message: string, locale: Locale): string {
  return isMessageKey(message) ? validationMessages[locale][message] : message;
}
