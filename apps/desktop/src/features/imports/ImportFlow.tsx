import { useMemo, useState } from "react";
import { AccountSelect } from "@/components/AccountSelect";
import { Button } from "@/components/Button";
import { controlClass, Field } from "@/components/Field";
import { Icon } from "@/components/Icon";
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
        setError("Nenhum lançamento encontrado no arquivo.");
      }
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    }
  }

  async function pick(file: File | undefined) {
    if (!file) return;
    const text = await readText(file);
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
      setError(`Escolha a categoria de ${missing} ${missing === 1 ? "lançamento" : "lançamentos"}.`);
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
        `${outcome.imported} importados${outcome.skipped ? `, ${outcome.skipped} já existiam` : ""}. ${outcome.learned} regras aprendidas.`,
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
          <div className="grid grid-cols-2 gap-3">
            <AccountSelect
              label="Importar para a conta"
              accounts={accounts.data ?? []}
              value={chosenAccount}
              onChange={setAccountId}
            />
            <Field label="Arquivo do extrato">
              <label className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-line-strong bg-surface-2 px-3 text-sm text-muted transition-colors hover:border-gold/50 hover:text-foreground">
                <Icon name="upload" size={15} />
                <span className="truncate">{fileName || "Escolher .ofx ou .csv"}</span>
                <input
                  type="file"
                  accept=".ofx,.qfx,.csv,.txt"
                  className="sr-only"
                  onChange={(event) => void pick(event.target.files?.[0])}
                />
              </label>
            </Field>
          </div>
          <p className="text-xs text-faint">
            No app ou site do banco, procure “Extrato” → “Exportar” ou “Baixar”. OFX é o mais confiável; CSV também
            funciona. Nada é salvo antes da revisão.
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
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">
              {fileName} · {rows.length} lançamentos ·{" "}
              {rows.filter((r) => r.duplicate).length > 0
                ? `${rows.filter((r) => r.duplicate).length} parecem já lançados (desmarcados)`
                : "nenhum repetido"}
            </span>
            <button
              type="button"
              className="text-xs text-gold hover:underline"
              onClick={() => {
                setResult(null);
                setFileName("");
              }}
            >
              Trocar arquivo
            </button>
          </div>
          <div className="max-h-[52vh] overflow-y-auto rounded-2xl border border-line">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface-2 text-xs text-muted">
                <tr>
                  <th className="w-8 px-3 py-2" />
                  <th className="px-2 py-2 text-left font-normal">Data</th>
                  <th className="px-2 py-2 text-left font-normal">Descrição</th>
                  <th className="px-2 py-2 text-right font-normal">Valor</th>
                  <th className="px-3 py-2 text-left font-normal">Categoria</th>
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
                          aria-label="Importar"
                          checked={choice?.include ?? false}
                          onChange={(event) => update({ include: event.target.checked })}
                          className="accent-[var(--gold)]"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-xs whitespace-nowrap text-muted">{shortDate(row.date)}</td>
                      <td className="max-w-56 px-2 py-1.5">
                        <span className="block truncate" title={row.description}>
                          {row.description}
                        </span>
                        {row.duplicate ? <span className="text-[10px] text-gold uppercase">Já lançado?</span> : null}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <Money amount={row.amount} tone={row.amount.startsWith("-") ? "plain" : "positive"} />
                      </td>
                      <td className="px-3 py-1.5">
                        <select
                          className={`${controlClass} h-8 text-xs ${choice?.include && !choice.categoryId ? "border-negative/50" : ""}`}
                          value={choice?.categoryId ?? ""}
                          onChange={(event) => update({ categoryId: event.target.value })}
                        >
                          <option value="">Escolha…</option>
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
            As categorias que você escolher viram regras: na próxima importação, lançamentos parecidos já vêm
            categorizados. Transferências entre suas contas: desmarque e lance como transferência.
          </p>
          <footer className="flex items-center gap-4">
            <span className="text-sm text-muted">
              {selected.length} selecionados · entradas <Money amount={totals.income} tone="positive" /> · saídas{" "}
              <Money amount={totals.expense} />
            </span>
            <div className="flex-1" />
            <Button variant="ghost" onClick={onDone}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={() => void save()} disabled={commit.isPending || selected.length === 0}>
              Importar {selected.length}
            </Button>
          </footer>
        </>
      )}
      {error ? <p className="text-sm text-negative">{error}</p> : null}
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
            {name || `Coluna ${index + 1}`}
          </option>
        ))}
      </select>
    </Field>
  );
  return (
    <div className="animate-enter space-y-4 rounded-2xl bg-surface-2 p-4">
      <p className="text-sm">Não reconheci as colunas deste CSV. Diga qual é qual:</p>
      <div className="grid grid-cols-3 gap-3">
        {select("date", "Data")}
        {select("description", "Descrição")}
        {select("amount", "Valor")}
      </div>
      <label className="flex items-center gap-2 text-xs text-muted">
        <input
          type="checkbox"
          checked={columns.invert ?? false}
          onChange={(event) => setColumns((current) => ({ ...current, invert: event.target.checked }))}
          className="accent-[var(--gold)]"
        />
        Gastos aparecem positivos no arquivo (comum em fatura de cartão)
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
          Ler com essas colunas
        </Button>
      </div>
    </div>
  );
}
