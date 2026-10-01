import { controlClass, Field } from "./Field";
import type { Account } from "@/lib/queries";

/** Accounts grouped by institution, shown by their type or nickname. */
export function AccountSelect({
  label,
  accounts,
  value,
  onChange,
  allowEmpty,
}: {
  label: string;
  accounts: Account[];
  value: string;
  onChange: (id: string) => void;
  allowEmpty?: string;
}) {
  const groups = new Map<string, Account[]>();
  for (const account of accounts) {
    const key = account.institution?.name ?? "";
    groups.set(key, [...(groups.get(key) ?? []), account]);
  }

  const option = (account: Account, grouped: boolean) => (
    <option key={account.id} value={account.id}>
      {grouped ? account.label.split(" · ").slice(1).join(" · ") : account.label}
    </option>
  );

  return (
    <Field label={label}>
      <select className={controlClass} value={value} onChange={(event) => onChange(event.target.value)}>
        {allowEmpty !== undefined ? <option value="">{allowEmpty}</option> : null}
        {[...groups.entries()].map(([institution, items]) =>
          institution ? (
            <optgroup key={institution} label={institution}>
              {items.map((account) => option(account, true))}
            </optgroup>
          ) : (
            items.map((account) => option(account, false))
          ),
        )}
      </select>
    </Field>
  );
}
