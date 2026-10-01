import { useState } from "react";
import { Button } from "@/components/Button";
import { controlClass, Field } from "@/components/Field";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/Toast";
import { errorMessage } from "@/lib/api";
import { institutionColors, institutionSuggestions } from "@/lib/institutions";
import { accountTypeLabels } from "@/lib/labels";
import { parseReaisToMinorUnits, parseSignedReaisToMinorUnits } from "@/lib/money";
import {
  useCreateAccount,
  useCreateInstitution,
  useInstitutions,
  useSaveCard,
  type AccountType,
} from "@/lib/queries";
import { OpeningBalanceField } from "./AccountForm";
import { ColorPicker } from "./InstitutionForm";

type Product = "CARD" | Exclude<AccountType, "CASH" | "OTHER">;

const products: { value: Product; label: string; hint: string }[] = [
  { value: "CHECKING", label: accountTypeLabels.CHECKING, hint: "Onde o salário cai e as contas saem" },
  { value: "SAVINGS", label: accountTypeLabels.SAVINGS, hint: "Reserva, caixinhas, cofrinhos" },
  { value: "CARD", label: "Cartão de crédito", hint: "Faturas, parcelas e limite" },
  { value: "BROKERAGE", label: accountTypeLabels.BROKERAGE, hint: "Dinheiro parado na corretora" },
  { value: "CRYPTO", label: accountTypeLabels.CRYPTO, hint: "Saldo em exchange ou carteira" },
];

export function AddInstitution({ onDone }: { onDone: () => void }) {
  const existing = useInstitutions();
  const [step, setStep] = useState<"pick" | "products">("pick");
  const [name, setName] = useState("");
  const [color, setColor] = useState(institutionColors[0]);
  const [selected, setSelected] = useState<Product[]>(["CHECKING"]);

  const taken = new Set((existing.data ?? []).map((i) => i.name.toLowerCase()));

  if (step === "pick") {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-2">
          {institutionSuggestions
            .filter((suggestion) => !taken.has(suggestion.name.toLowerCase()))
            .map((suggestion) => (
              <button
                key={suggestion.name}
                type="button"
                className="flex items-center gap-2.5 rounded-xl border border-line px-3 py-2.5 text-left text-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-line-strong hover:bg-surface-2"
                onClick={() => {
                  setName(suggestion.name);
                  setColor(suggestion.color);
                  setSelected(suggestion.usual.filter((p): p is Product => p !== "CASH" && p !== "OTHER"));
                  setStep("products");
                }}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: suggestion.color }} />
                <span className="truncate">{suggestion.name}</span>
              </button>
            ))}
        </div>
        <form
          className="space-y-3 border-t border-line pt-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim()) setStep("products");
          }}
        >
          <Field label="Outra instituição">
            <input
              className={controlClass}
              placeholder="Nome do banco, corretora ou carteira"
              value={name}
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <ColorPicker value={color} onChange={setColor} />
          <div className="flex justify-end">
            <Button variant="primary" type="submit" disabled={!name.trim()}>
              Continuar
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <ProductsStep
      name={name.trim()}
      color={color}
      selected={selected}
      onSelectedChange={setSelected}
      onBack={() => setStep("pick")}
      onDone={onDone}
    />
  );
}

function ProductsStep({
  name,
  color,
  selected,
  onSelectedChange,
  onBack,
  onDone,
}: {
  name: string;
  color: string;
  selected: Product[];
  onSelectedChange: (products: Product[]) => void;
  onBack: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const createInstitution = useCreateInstitution();
  const createAccount = useCreateAccount();
  const saveCard = useSaveCard();
  const [balances, setBalances] = useState<Partial<Record<Product, string>>>({});
  const [limit, setLimit] = useState("");
  const [closingDay, setClosingDay] = useState(3);
  const [dueDay, setDueDay] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggle(product: Product) {
    onSelectedChange(
      selected.includes(product) ? selected.filter((p) => p !== product) : [...selected, product],
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const accountTypes = products
      .map((p) => p.value)
      .filter((p): p is Exclude<Product, "CARD"> => p !== "CARD" && selected.includes(p));
    const parsed = new Map<string, string>();
    for (const type of accountTypes) {
      const value = parseSignedReaisToMinorUnits(balances[type] ?? "");
      if (value === null) {
        setError(`Saldo inválido em ${accountTypeLabels[type]}.`);
        return;
      }
      parsed.set(type, value);
    }
    const cardLimit = limit.trim() ? parseReaisToMinorUnits(limit) : "0";
    if (selected.includes("CARD") && cardLimit === null) {
      setError("Limite do cartão inválido.");
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const institution = await createInstitution.mutateAsync({ name, color });
      let checkingId: string | null = null;
      for (const type of accountTypes) {
        const account = await createAccount.mutateAsync({
          name: "",
          type,
          institutionId: institution.id,
          openingBalance: parsed.get(type) ?? "0",
        });
        if (type === "CHECKING") checkingId = account.id;
      }
      if (selected.includes("CARD")) {
        await saveCard.mutateAsync({
          input: {
            name,
            limit: cardLimit ?? "0",
            closingDay,
            dueDay,
            paymentAccountId: checkingId,
            institutionId: institution.id,
          },
        });
      }
      toast(`${name} adicionado`);
      onDone();
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  const days = Array.from({ length: 31 }, (_, index) => index + 1);

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Voltar"
          className="-ml-1 rounded-lg p-1.5 text-muted hover:bg-white/5 hover:text-foreground"
          onClick={onBack}
        >
          <Icon name="chevronLeft" size={16} />
        </button>
        <span className="h-3 w-3 rounded-full" style={{ background: color }} />
        <p>
          O que você tem no <span className="font-medium">{name}</span>?
        </p>
      </div>

      <ul className="space-y-2">
        {products.map((product) => {
          const on = selected.includes(product.value);
          return (
            <li
              key={product.value}
              className={`rounded-2xl border transition-colors duration-150 ${on ? "border-gold/40 bg-gold/[0.04]" : "border-line"}`}
            >
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
                onClick={() => toggle(product.value)}
                aria-pressed={on}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-md border transition-colors ${on ? "border-gold bg-gold text-background" : "border-line-strong"}`}
                >
                  {on ? <Icon name="check" size={13} /> : null}
                </span>
                <span className="flex-1">
                  <span className="block text-sm">{product.label}</span>
                  <span className="block text-xs text-faint">{product.hint}</span>
                </span>
              </button>
              {on ? (
                <div className="animate-enter px-4 pb-4 pl-12">
                  {product.value === "CARD" ? (
                    <div className="grid grid-cols-3 gap-3">
                      <Field label="Limite">
                        <input
                          className={`${controlClass} tabular`}
                          inputMode="decimal"
                          placeholder="0,00"
                          value={limit}
                          onChange={(event) => setLimit(event.target.value)}
                        />
                      </Field>
                      <Field label="Fecha dia">
                        <select
                          className={controlClass}
                          value={closingDay}
                          onChange={(event) => setClosingDay(Number(event.target.value))}
                        >
                          {days.map((day) => (
                            <option key={day} value={day}>
                              {day}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Vence dia">
                        <select
                          className={controlClass}
                          value={dueDay}
                          onChange={(event) => setDueDay(Number(event.target.value))}
                        >
                          {days.map((day) => (
                            <option key={day} value={day}>
                              {day}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                  ) : (
                    <OpeningBalanceField
                      compact
                      value={balances[product.value] ?? ""}
                      onChange={(value) => setBalances((current) => ({ ...current, [product.value]: value }))}
                    />
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-faint">
        O saldo de hoje entra no seu patrimônio, não como receita. Investimentos (CDB, ações, FIIs) chegam na
        próxima fase.
      </p>
      {error ? <p className="text-sm text-negative">{error}</p> : null}
      <footer className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button variant="primary" type="submit" disabled={saving}>
          {saving ? "Adicionando…" : `Adicionar ${name}`}
        </Button>
      </footer>
    </form>
  );
}
