import { useState } from "react";
import { Button } from "@/components/Button";
import { controlClass, Field, MoneyInput, TextInput } from "@/components/Field";
import { FormFooter } from "@/components/Modal";
import { Money } from "@/components/Money";
import { useToast } from "@/components/Toast";
import { errorMessage } from "@/lib/api";
import { accountTypeLabels } from "@/lib/labels";
import { minorUnitsToInput, parseSignedReaisToMinorUnits } from "@/lib/money";
import {
  useCreateAccount,
  useDeleteAccount,
  useUpdateAccount,
  type Account,
  type AccountType,
} from "@/lib/queries";

/** Types that live inside a bank or broker; cash stands on its own. */
const institutionTypes: AccountType[] = ["CHECKING", "SAVINGS", "BROKERAGE", "CRYPTO", "OTHER"];

export function AccountForm({
  account,
  institution,
  fixedType,
  onDone,
}: {
  account: Account | null;
  institution: { id: string; name: string } | null;
  fixedType?: AccountType;
  onDone: () => void;
}) {
  const toast = useToast();
  const create = useCreateAccount();
  const update = useUpdateAccount();
  const remove = useDeleteAccount();
  const [type, setType] = useState<AccountType>(account?.type ?? fixedType ?? "CHECKING");
  const [name, setName] = useState(account?.name ?? "");
  const [opening, setOpening] = useState(
    account && account.openingBalance !== "0" ? minorUnitsToInput(account.openingBalance) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const openingBalance = parseSignedReaisToMinorUnits(opening);
    if (openingBalance === null) {
      setError("Saldo inválido. Use algo como 1.250,00 ou -80,00.");
      return;
    }
    try {
      if (account) {
        await update.mutateAsync({ id: account.id, name: name.trim(), openingBalance });
        toast("Conta atualizada");
      } else {
        await create.mutateAsync({
          name: name.trim(),
          type,
          institutionId: institution?.id ?? null,
          openingBalance,
        });
        toast("Conta criada");
      }
      onDone();
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    }
  }

  async function destroy() {
    if (!account) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await remove.mutateAsync(account.id);
      toast("Conta excluída");
      onDone();
    } catch (reason: unknown) {
      setConfirmDelete(false);
      setError(errorMessage(reason));
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-5">
      {account ? (
        <div className="flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3">
          <span className="text-sm text-muted">{accountTypeLabels[account.type]}</span>
          <Money amount={account.balance} className="text-lg" />
        </div>
      ) : fixedType ? null : (
        <Field label="Tipo">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {institutionTypes.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={type === value}
                className={`rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                  type === value
                    ? "border-gold/50 bg-gold/10 text-foreground"
                    : "border-line text-muted hover:border-line-strong hover:text-foreground"
                }`}
                onClick={() => setType(value)}
              >
                {accountTypeLabels[value]}
              </button>
            ))}
          </div>
        </Field>
      )}
      <Field label="Apelido (opcional)">
        <TextInput
          autoFocus
          placeholder={type === "SAVINGS" ? "Ex.: Caixinha da viagem" : accountTypeLabels[type]}
          value={name}
          maxLength={80}
          onChange={setName}
        />
      </Field>
      <OpeningBalanceField value={opening} onChange={setOpening} />
      <FormFooter error={error}>
        {account ? (
          <Button
            variant={confirmDelete ? "dangerSolid" : "danger"}
            onClick={() => void destroy()}
            onBlur={() => setConfirmDelete(false)}
            disabled={remove.isPending}
          >
            {confirmDelete ? "Confirmar exclusão" : "Excluir"}
          </Button>
        ) : null}
        <div className="flex-1" />
        <Button variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button variant="primary" type="submit" disabled={create.isPending || update.isPending}>
          {create.isPending || update.isPending ? "Salvando…" : "Salvar"}
        </Button>
      </FormFooter>
    </form>
  );
}

export function OpeningBalanceField({
  value,
  onChange,
  compact,
}: {
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  return (
    <Field label={compact ? "Saldo hoje" : "Saldo inicial"}>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-faint">
          R$
        </span>
        <MoneyInput signed className={`${controlClass} tabular pl-9`} value={value} onChange={onChange} />
      </div>
      {compact ? null : (
        <span className="text-[11px] text-faint">
          Quanto havia quando você começou a usar o Nublar. Não conta como receita. Use o sinal de menos
          para conta no negativo.
        </span>
      )}
    </Field>
  );
}
