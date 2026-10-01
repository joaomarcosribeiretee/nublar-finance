import { useState } from "react";
import { Button } from "@/components/Button";
import { controlClass, Field } from "@/components/Field";
import { useToast } from "@/components/Toast";
import { errorMessage } from "@/lib/api";
import { institutionColors } from "@/lib/institutions";
import { useDeleteInstitution, useUpdateInstitution, type Institution } from "@/lib/queries";

export function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const colors = institutionColors.includes(value) ? institutionColors : [value, ...institutionColors];
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={`Cor ${color}`}
          className={`h-7 w-7 rounded-full transition-transform hover:scale-110 ${value === color ? "ring-2 ring-foreground ring-offset-2 ring-offset-surface" : ""}`}
          style={{ background: color }}
          onClick={() => onChange(color)}
        />
      ))}
    </div>
  );
}

export function InstitutionForm({ institution, onDone }: { institution: Institution; onDone: () => void }) {
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
      await update.mutateAsync({ id: institution.id, name, color });
      toast("Instituição atualizada");
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
      toast("Instituição removida");
      onDone();
    } catch (reason: unknown) {
      setConfirmDelete(false);
      setError(errorMessage(reason));
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-5">
      <Field label="Nome">
        <input
          autoFocus
          className={controlClass}
          value={name}
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </Field>
      <Field label="Cor">
        <ColorPicker value={color} onChange={setColor} />
      </Field>
      {error ? <p className="text-sm text-negative">{error}</p> : null}
      <footer className="flex items-center gap-2">
        <Button
          variant={confirmDelete ? "dangerSolid" : "danger"}
          onClick={() => void destroy()}
          onBlur={() => setConfirmDelete(false)}
          disabled={remove.isPending}
        >
          {confirmDelete ? "Confirmar exclusão" : "Excluir"}
        </Button>
        <div className="flex-1" />
        <Button variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button variant="primary" type="submit" disabled={update.isPending}>
          Salvar
        </Button>
      </footer>
    </form>
  );
}
