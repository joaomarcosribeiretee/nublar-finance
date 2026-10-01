import { useState } from "react";
import { Icon } from "@/components/Icon";
import { PageHeader } from "@/components/Page";
import { useToast } from "@/components/Toast";
import { errorMessage } from "@/lib/api";
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  type Category,
  type CategoryKind,
} from "@/lib/queries";

const columns: { kind: CategoryKind; title: string; dot: string }[] = [
  { kind: "EXPENSE", title: "Despesas", dot: "bg-negative" },
  { kind: "INCOME", title: "Receitas", dot: "bg-positive" },
];

export function CategoriesScreen() {
  const categories = useCategories();

  return (
    <section className="animate-enter">
      <PageHeader eyebrow="Organize seus lançamentos" title="Categorias">
        As mais usadas aparecem primeiro nos formulários.
      </PageHeader>

      {categories.isError ? (
        <p className="mt-6 text-sm text-negative">{errorMessage(categories.error)}</p>
      ) : null}

      <div className="mt-8 grid grid-cols-2 gap-4">
        {columns.map((column) => (
          <CategoryColumn
            key={column.kind}
            {...column}
            items={(categories.data ?? []).filter((c) => c.kind === column.kind)}
            loading={categories.isPending}
          />
        ))}
      </div>
    </section>
  );
}

function CategoryColumn({
  kind,
  title,
  dot,
  items,
  loading,
}: {
  kind: CategoryKind;
  title: string;
  dot: string;
  items: Category[];
  loading: boolean;
}) {
  const toast = useToast();
  const create = useCreateCategory();
  const remove = useDeleteCategory();
  const [name, setName] = useState("");

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      return;
    }
    try {
      await create.mutateAsync({ name, kind });
      setName("");
    } catch (reason: unknown) {
      toast(errorMessage(reason), "error");
    }
  }

  async function destroy(category: Category) {
    try {
      await remove.mutateAsync(category.id);
      toast(`"${category.name}" removida`);
    } catch (reason: unknown) {
      toast(errorMessage(reason), "error");
    }
  }

  return (
    <article className="rounded-3xl border border-line bg-surface p-5">
      <h2 className="flex items-center gap-2 text-sm text-muted">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        {title}
        <span className="text-faint">{items.length || ""}</span>
      </h2>
      <ul className="mt-4 space-y-0.5">
        {loading
          ? [0, 1, 2].map((index) => <li key={index} className="skeleton my-2 h-7" />)
          : items.map((category) => (
              <li
                key={category.id}
                className="group flex items-center justify-between rounded-xl px-3 py-2 transition-colors hover:bg-white/[0.035]"
              >
                <span className="text-sm">{category.name}</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-faint">
                    {category.usage > 0
                      ? `${category.usage} ${category.usage === 1 ? "lançamento" : "lançamentos"}`
                      : "sem uso"}
                  </span>
                  {category.usage === 0 ? (
                    <button
                      type="button"
                      aria-label={`Remover ${category.name}`}
                      className="rounded-lg p-1 text-faint opacity-0 transition-all group-hover:opacity-100 hover:bg-negative/10 hover:text-negative"
                      onClick={() => void destroy(category)}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  ) : (
                    <span className="w-[22px]" />
                  )}
                </span>
              </li>
            ))}
      </ul>
      <form onSubmit={(event) => void add(event)} className="mt-3 flex items-center gap-2 px-1">
        <Icon name="plus" size={15} className="text-faint" />
        <input
          className="h-9 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
          placeholder="Nova categoria"
          value={name}
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
          disabled={create.isPending}
        />
      </form>
    </article>
  );
}
