import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/Button";
import { Field, TextInput } from "@/components/Field";
import { FormFooter } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { errorMessage } from "@/lib/api";
import { institutionColors } from "@/lib/institutions";
import { useDeleteInstitution, useUpdateInstitution, type Institution } from "@/lib/queries";

export function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const { t } = useTranslation();
  const colors = institutionColors.includes(value) ? institutionColors : [value, ...institutionColors];
  return (
    <div role="radiogroup" aria-label={t("institutions.form.color")} className="flex flex-wrap gap-2.5">
      {colors.map((color, index) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={t("institutions.form.colorOption", { index: index + 1 })}
          className={`h-8 w-8 rounded-full ring-offset-2 ring-offset-surface transition-shadow hover:ring-2 hover:ring-line-strong ${value === color ? "ring-2 ring-foreground hover:ring-foreground" : ""}`}
          style={{ background: color }}
          onClick={() => onChange(color)}
        />
      ))}
    </div>
  );
}

export function InstitutionForm({ institution, onDone }: { institution: Institution; onDone: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const update = useUpdateInstitution();
  const remove = useDeleteInstitution();
  const [name, setName] = useState(institution.name);
  const [color, setColor] = useState(institution.color);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      await update.mutateAsync({ id: institution.id, name: name.trim(), color });
      toast(t("institutions.form.updated"));
      onDone();
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    }
  }

  async function destroy() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await remove.mutateAsync(institution.id);
      toast(t("institutions.form.removed"));
      onDone();
    } catch (reason: unknown) {
      setConfirmDelete(false);
      setError(errorMessage(reason));
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-5">
      <Field label={t("institutions.form.name")}>
        <TextInput autoFocus value={name} maxLength={80} onChange={setName} required />
      </Field>
      <Field label={t("institutions.form.color")}>
        <ColorPicker value={color} onChange={setColor} />
      </Field>
      <FormFooter error={error}>
        <Button
          variant={confirmDelete ? "dangerSolid" : "danger"}
          onClick={() => void destroy()}
          onBlur={() => setConfirmDelete(false)}
          disabled={remove.isPending}
        >
          {confirmDelete ? t("common.actions.confirmDelete") : t("common.actions.delete")}
        </Button>
        <div className="flex-1" />
        <Button variant="ghost" onClick={onDone}>
          {t("common.actions.cancel")}
        </Button>
        <Button variant="primary" type="submit" disabled={update.isPending}>
          {update.isPending ? t("common.save.saving") : t("common.actions.save")}
        </Button>
      </FormFooter>
    </form>
  );
}
