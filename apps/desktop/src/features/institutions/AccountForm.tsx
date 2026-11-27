import { useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
      setError(t("institutions.account.invalidBalance"));
      return;
    }
    try {
      if (account) {
        await update.mutateAsync({ id: account.id, name: name.trim(), openingBalance });
        toast(t("institutions.account.updated"));
      } else {
        await create.mutateAsync({
          name: name.trim(),
          type,
          institutionId: institution?.id ?? null,
          openingBalance,
        });
        toast(t("institutions.account.created"));
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
      toast(t("institutions.account.deleted"));
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
          <span className="text-sm text-muted">{t(accountTypeLabels[account.type])}</span>
          <Money amount={account.balance} className="text-lg" />
        </div>
      ) : fixedType ? null : (
        <Field label={t("institutions.account.type")}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {institutionTypes.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={type === value}
                className={`rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                  type === value
                    ? "border-accent/50 bg-accent/10 text-foreground"
                    : "border-line text-muted hover:border-line-strong hover:text-foreground"
                }`}
                onClick={() => setType(value)}
              >
                {t(accountTypeLabels[value])}
              </button>
            ))}
          </div>
        </Field>
      )}
      <Field label={t("institutions.account.nickname")}>
        <TextInput
          autoFocus
          placeholder={type === "SAVINGS" ? t("institutions.account.savingsPlaceholder") : t(accountTypeLabels[type])}
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
            {confirmDelete ? t("common.actions.confirmDelete") : t("common.actions.delete")}
          </Button>
        ) : null}
        <div className="flex-1" />
        <Button variant="ghost" onClick={onDone}>
          {t("common.actions.cancel")}
        </Button>
        <Button variant="primary" type="submit" disabled={create.isPending || update.isPending}>
          {create.isPending || update.isPending ? t("common.save.saving") : t("common.actions.save")}
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
  const { t } = useTranslation();
  return (
    <Field label={compact ? t("institutions.account.balanceToday") : t("institutions.account.openingBalance")}>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-faint">
          {t("common.money.symbol")}
        </span>
        <MoneyInput signed className={`${controlClass} tabular pl-9`} value={value} onChange={onChange} />
      </div>
      {compact ? null : (
        <span className="text-[11px] text-faint">
          {t("institutions.account.openingBalanceHint")}
        </span>
      )}
    </Field>
  );
}
