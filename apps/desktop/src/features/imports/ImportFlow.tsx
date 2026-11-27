import { useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { AccountSelect } from "@/components/AccountSelect";
import { Button } from "@/components/Button";
import { controlClass, Field } from "@/components/Field";
import { Icon } from "@/components/Icon";
import { FormFooter } from "@/components/Modal";
import { Money } from "@/components/Money";
import { useToast } from "@/components/Toast";
import { errorMessage } from "@/lib/api";
import { shortDate } from "@/lib/dates";
import {
  useAccounts,
  useCategories,
  useCommitImport,
  usePreviewImport,
  type ImportMapping,
  type ImportPreview,
} from "@/lib/queries";

/**
 * Bank files are often Latin-1. Read as UTF-8 first and fall back when the
 * text comes out with replacement characters.
 */
async function readText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(buffer);
  return utf8.includes("�") ? new TextDecoder("windows-1252").decode(buffer) : utf8;
}

type Choice = { include: boolean; categoryId: string };

export function ImportFlow({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const accounts = useAccounts();
  const categories = useCategories();
  const preview = usePreviewImport();
  const commit = useCommitImport();
  const [accountId, setAccountId] = useState("");
  const [fileName, setFileName] = useState("");
  const [content, setContent] = useState("");
  const [format, setFormat] = useState<"OFX" | "CSV">("OFX");
  const [result, setResult] = useState<ImportPreview | null>(null);
  const [choices, setChoices] = useState<Record<number, Choice>>({});
  const [error, setError] = useState<string | null>(null);
  const chosenAccount = accountId || accounts.data?.[0]?.id || "";

  async function analyse(text: string, kind: "OFX" | "CSV", columns?: ImportMapping) {
    setError(null);
    try {
      const data = await preview.mutateAsync({
        accountId: chosenAccount,
        format: kind,
        content: text,
        mapping: columns,
      });
      setResult(data);
      setChoices(
        Object.fromEntries(
          data.rows.map((row) => [
            row.index,
            { include: !row.duplicate, categoryId: row.suggestedCategoryId ?? "" },
          ]),
        ),
      );
      if (data.rows.length === 0 && !(kind === "CSV" && data.csv && !data.csv.mapping)) {
        setError(t("imports.errors.empty"));
      }
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    }
  }

  async function pick(file: File | undefined) {
    if (!file) return;
    if (!chosenAccount) {
      setError(t("imports.errors.noAccount"));
      return;
    }
    if (file.size > 5_000_000) {
      setError(t("imports.errors.tooBig"));
      return;
    }
    let text: string;
    try {
      text = await readText(file);
    } catch {
      setError(t("imports.errors.unreadable"));
      return;
    }
    const kind = /\.(ofx|qfx)$/i.test(file.name) || /<OFX>/i.test(text) ? "OFX" : "CSV";
    setFileName(file.name);
    setContent(text);
    setFormat(kind);
    await analyse(text, kind);
  }

  const rows = result?.rows ?? [];
  const selected = rows.filter((row) => choices[row.index]?.include);
  const missing = selected.filter((row) => !choices[row.index]?.categoryId).length;
  const totals = useMemo(() => {
    let income = 0n;
    let expense = 0n;
    for (const row of selected) {
      const value = BigInt(row.amount);
      if (value > 0n) income += value;
      else expense -= value;
    }
    return { income: income.toString(), expense: expense.toString() };
  }, [selected]);

  async function save() {
    if (missing > 0) {
      setError(t("imports.errors.missingCategory", { count: missing }));
      return;
    }
    try {
      const outcome = await commit.mutateAsync({
        accountId: chosenAccount,
        source: format === "OFX" ? "OFX_IMPORT" : "CSV_IMPORT",
        rows: selected.map((row) => ({
          date: row.date,
          description: row.description,
          amount: row.amount,
          categoryId: choices[row.index].categoryId,
          externalId: row.externalId,
        })),
      });
      toast(
        `${t("imports.toast.imported", { count: outcome.imported })}${outcome.skipped ? t("imports.toast.skipped", { count: outcome.skipped }) : ""}. ${t("imports.toast.learned", { count: outcome.learned })}`,
      );
      onDone();
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    }
  }

  const csvNeedsMapping = format === "CSV" && result?.csv && !result.csv.mapping;

  return (
    <div className="space-y-5">
      {!result || csvNeedsMapping ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <AccountSelect
              label={t("imports.account")}
              accounts={accounts.data ?? []}
              value={chosenAccount}
              onChange={setAccountId}
            />
            <Field label={t("imports.file")}>
              <span className="flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-line-strong bg-surface-2 px-3 text-sm text-muted transition-colors hover:border-accent/50 hover:text-foreground has-focus-visible:border-accent/60 sm:h-10">
                <Icon name="upload" size={15} />
                <span className="truncate">{fileName || t("imports.pickFile")}</span>
                <input
                  type="file"
                  accept=".ofx,.qfx,.csv,.txt"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    // Cleared so picking the same file again still fires a change.
                    event.target.value = "";
                    void pick(file);
                  }}
                />
              </span>
            </Field>
          </div>
          <p className="text-xs text-faint">
            {t("imports.howTo")}
          </p>
          {preview.isPending ? <div className="skeleton h-24 rounded-2xl" /> : null}
          {csvNeedsMapping && result?.csv ? (
            <CsvMapping
              header={result.csv.header}
              sample={result.csv.sample}
              onConfirm={(columns) => void analyse(content, "CSV", columns)}
            />
          ) : null}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
            <span className="min-w-0 text-muted">
              {fileName} · {t("imports.summary.rows", { count: rows.length })} ·{" "}
              {rows.filter((r) => r.duplicate).length > 0
                ? t("imports.summary.duplicates", { count: rows.filter((r) => r.duplicate).length })
                : t("imports.summary.noDuplicates")}
            </span>
            <button
              type="button"
              className="py-1 text-xs text-accent hover:underline"
              onClick={() => {
                setResult(null);
                setFileName("");
                setError(null);
              }}
            >
              {t("imports.changeFile")}
            </button>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-surface-2 text-xs text-muted">
                <tr>
                  <th className="w-8 px-3 py-2" />
                  <th className="px-2 py-2 text-left font-normal">{t("transactions.form.date")}</th>
                  <th className="px-2 py-2 text-left font-normal">{t("transactions.form.description")}</th>
                  <th className="px-2 py-2 text-right font-normal">{t("transactions.form.amount.single")}</th>
                  <th className="px-3 py-2 text-left font-normal">{t("transactions.fields.category")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const choice = choices[row.index];
                  const update = (next: Partial<Choice>) =>
                    setChoices((current) => ({ ...current, [row.index]: { ...current[row.index], ...next } }));
                  return (
                    <tr key={row.index} className={`border-t border-line ${choice?.include ? "" : "opacity-40"}`}>
                      <td className="px-3 py-1.5">
                        <input
                          type="checkbox"
                          aria-label={t("imports.row.include", { name: row.description })}
                          checked={choice?.include ?? false}
                          onChange={(event) => update({ include: event.target.checked })}
                          className="h-4 w-4 accent-(--accent)"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-xs whitespace-nowrap text-muted">{shortDate(row.date)}</td>
                      <td className="max-w-56 px-2 py-1.5">
                        <span className="block truncate" title={row.description}>
                          {row.description}
                        </span>
                        {row.duplicate ? <span className="text-[10px] text-accent uppercase">{t("imports.row.duplicate")}</span> : null}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <Money amount={row.amount} tone={row.amount.startsWith("-") ? "plain" : "positive"} />
                      </td>
                      <td className="px-3 py-1.5">
                        <select
                          aria-label={t("imports.row.category", { name: row.description })}
                          className={`${controlClass} !h-9 min-w-36 !text-xs ${choice?.include && !choice.categoryId ? "!border-negative/50" : ""}`}
                          value={choice?.categoryId ?? ""}
                          onChange={(event) => update({ categoryId: event.target.value })}
                        >
                          <option value="">{t("common.choose")}</option>
                          {(categories.data ?? [])
                            .filter((category) => category.kind === row.type)
                            .map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-faint">
            {t("imports.rulesHint")}
          </p>
          <FormFooter error={error}>
            <span className="w-full text-sm text-muted sm:w-auto">
              <Trans
                i18nKey="imports.selected"
                count={selected.length}
                components={{ income: <Money amount={totals.income} tone="positive" />, expense: <Money amount={totals.expense} /> }}
              />
            </span>
            <div className="flex-1" />
            <Button variant="ghost" onClick={onDone}>
              {t("common.actions.cancel")}
            </Button>
            {selected.length > 0 ? (
              <Button variant="primary" onClick={() => void save()} disabled={commit.isPending}>
                {commit.isPending ? t("imports.importing") : t("imports.submit", { count: selected.length })}
              </Button>
            ) : null}
          </FormFooter>
        </>
      )}
      {error && (!result || csvNeedsMapping) ? (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function CsvMapping({
  header,
  sample,
  onConfirm,
}: {
  header: string[];
  sample: string[][];
  onConfirm: (mapping: ImportMapping) => void;
}) {
  const { t } = useTranslation();
  const [columns, setColumns] = useState<ImportMapping>({ date: 0, description: 1, amount: 2, invert: false });
  const select = (key: "date" | "description" | "amount", label: string) => (
    <Field label={label}>
      <select
        className={controlClass}
        value={columns[key]}
        onChange={(event) => setColumns((current) => ({ ...current, [key]: Number(event.target.value) }))}
      >
        {header.map((name, index) => (
          <option key={`${name}-${index}`} value={index}>
            {name || t("imports.csv.column", { index: index + 1 })}
          </option>
        ))}
      </select>
    </Field>
  );
  return (
    <div className="animate-enter space-y-4 rounded-2xl bg-surface-2 p-4">
      <p className="text-sm">{t("imports.csv.intro")}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {select("date", t("transactions.form.date"))}
        {select("description", t("transactions.form.description"))}
        {select("amount", t("transactions.form.amount.single"))}
      </div>
      <label className="flex items-center gap-2 text-xs text-muted">
        <input
          type="checkbox"
          checked={columns.invert ?? false}
          onChange={(event) => setColumns((current) => ({ ...current, invert: event.target.checked }))}
          className="h-4 w-4 shrink-0 accent-(--accent)"
        />
        {t("imports.csv.invert")}
      </label>
      <div className="overflow-x-auto text-xs text-faint">
        <table>
          <tbody>
            {sample.slice(0, 3).map((line, index) => (
              <tr key={index}>
                {line.map((cell, cellIndex) => (
                  <td key={cellIndex} className="pr-4 whitespace-nowrap">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end">
        <Button variant="primary" onClick={() => onConfirm(columns)}>
          {t("imports.csv.submit")}
        </Button>
      </div>
    </div>
  );
}
