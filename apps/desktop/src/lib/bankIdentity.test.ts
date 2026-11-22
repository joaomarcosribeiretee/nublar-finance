import { describe, expect, it } from "vitest";
import { bankInitials, bankMark, bankSlug, inkFor } from "./bankIdentity";

describe("bankSlug", () => {
  it("drops accents, case and punctuation", () => {
    expect(bankSlug("Itaú")).toBe("itau");
    expect(bankSlug("Banco do Brasil")).toBe("banco-do-brasil");
    expect(bankSlug(" C6 Bank ")).toBe("c6-bank");
  });
});

describe("bankMark", () => {
  it("finds the brands Simple Icons has, by any common spelling", () => {
    expect(bankMark("Nubank")).not.toBeNull();
    expect(bankMark("nu")).not.toBeNull();
    expect(bankMark("Mercado Pago")).not.toBeNull();
    expect(bankMark("PagBank")).not.toBeNull();
  });

  it("has nothing for brands outside the collection", () => {
    expect(bankMark("Itaú")).toBeNull();
    expect(bankMark("Banco do Brasil")).toBeNull();
  });
});

describe("bankInitials", () => {
  it("reads like the bank", () => {
    expect(bankInitials("Banco do Brasil")).toBe("BB");
    expect(bankInitials("C6 Bank")).toBe("C6");
    expect(bankInitials("XP")).toBe("XP");
    expect(bankInitials("BTG Pactual")).toBe("BT");
    expect(bankInitials("Itaú")).toBe("I");
    expect(bankInitials("Caixa Econômica Federal")).toBe("CE");
    expect(bankInitials("Banco Inter")).toBe("BI");
    expect(bankInitials("Banco do Brasil Estilo Investimentos")).toBe("BB");
  });
});

describe("inkFor", () => {
  it("uses dark ink on light brand colors and white on dark ones", () => {
    expect(inkFor("#e6c200")).toBe("#0a0f0d");
    expect(inkFor("#f0b90b")).toBe("#0a0f0d");
    expect(inkFor("#8a05be")).toBe("#ffffff");
    expect(inkFor("#cc092f")).toBe("#ffffff");
  });
});
