import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TranslationKey } from "@/i18n";
import { Icon } from "@/components/Icon";
import { ErrorNote, PageHeader } from "@/components/Page";
import { sanitizeText } from "@/lib/input";
import { useToast } from "@/components/Toast";
import { errorMessage } from "@/lib/api";
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  type Category,
  type CategoryKind,
} from "@/lib/queries";

const columns: { kind: CategoryKind; title: TranslationKey; dot: string }[] = [
  { kind: "EXPENSE", title: "transactions.filters.expense", dot: "bg-negative" },
  { kind: "INCOME", title: "transactions.filters.income", dot: "bg-positive" },
];

export function CategoriesScreen() {
  const { t } = useTranslation();
  const categories = useCategories();
  const [search, setSearch] = useState("");

  return (
    <section className="animate-enter">
      <PageHeader eyebrow={t("categories.eyebrow")} title={t("shell.screens.categories")}>
        {t("categories.intro")}
      </PageHeader>
      <div className="filter-toolbar mt-6 flex items-center gap-3">
        <Icon name="search" size={17} className="shrink-0 text-muted" />
        <input type="search" aria-label={t("categories.search.label")} placeholder={t("categories.search.placeholder")} value={search} onChange={(event) => setSearch(event.target.value)} maxLength={80} className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none" />
      </div>

      {categories.isError ? (
        <div className="mt-6">
          <ErrorNote>{errorMessage(categories.error)}</ErrorNote>
        </div>
      ) : null}

      {!categories.isError ? <div className="mt-6 grid gap-4 @2xl:grid-cols-2">
        {columns.map((column) => (
          <CategoryColumn
            key={column.kind}
            {...column}
            title={t(column.title)}
            items={(categories.data ?? []).filter((c) => c.kind === column.kind)}
            loading={categories.isPending}
            search={search}
          />
        ))}
      </div> : null}
    </section>
  );
}

function CategoryColumn({
  kind,
  title,
  dot,
  items,
  loading,
  search,
}: {
  kind: CategoryKind;
  title: string;
  dot: string;
  items: Category[];
  loading: boolean;
  search: string;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const create = useCreateCategory();
  const remove = useDeleteCategory();
  const [name, setName] = useState("");
  const visible = items.filter((item) => item.name.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR"))).sort((a, b) => b.usage - a.usage || a.name.localeCompare(b.name, "pt-BR"));

  async function add(event: React.FormEvent) {
    event.preventDefault();
    const wanted = name.trim();
    if (!wanted) {
      return;
    }
    if (items.some((item) => item.name.toLocaleLowerCase("pt-BR") === wanted.toLocaleLowerCase("pt-BR"))) {
      toast(t("categories.exists", { name: wanted, kind: title.toLowerCase() }), "error");
      return;
    }
    try {
      await create.mutateAsync({ name: wanted, kind });
      setName("");
    } catch (reason: unknown) {
      toast(errorMessage(reason), "error");
    }
  }

  async function destroy(category: Category) {
    try {
      await remove.mutateAsync(category.id);
      toast(t("categories.removed", { name: category.name }));
    } catch (reason: unknown) {
      toast(errorMessage(reason), "error");
    }
  }

  return (
    <article className="content-panel min-w-0 rounded-3xl border border-line bg-surface p-5 @2xl:p-6">
      <h2 className="flex items-center gap-2 text-sm text-muted">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        {title}
        <span className="text-faint">{items.length || ""}</span>
      </h2>
      <ul className="mt-4 space-y-0.5">
        {loading
          ? [0, 1, 2].map((index) => <li key={index} className="skeleton my-2 h-7" />)
          : visible.map((category) => (
              <li
                key={category.id}
                className="group flex items-center justify-between gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-hover"
              >
                <span className="truncate text-sm">{category.name}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-faint">
                    {category.usage > 0
                      ? t("categories.usage", { count: category.usage })
                      : t("categories.unused")}
                  </span>
                  {category.usage === 0 ? (
                    <button
                      type="button"
                      aria-label={t("categories.remove", { name: category.name })}
                      className="-my-1 flex h-8 w-8 items-center justify-center rounded-lg text-faint transition-[opacity,color,background-color] group-hover:opacity-100 hover:bg-negative/10 hover:text-negative focus-visible:opacity-100 hoverable:opacity-0"
                      disabled={remove.isPending}
                      onClick={() => void destroy(category)}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  ) : (
                    <span className="w-8" />
                  )}
                </span>
              </li>
            ))}
      </ul>
      {!loading && visible.length === 0 ? <p className="py-6 text-sm text-muted">{search ? t("categories.notFound") : t("categories.empty")}</p> : null}
      <form
        onSubmit={(event) => void add(event)}
        className="mt-3 flex items-center gap-2 rounded-xl border border-line pr-1 pl-3 transition-colors focus-within:border-accent/60"
      >
        <Icon name="plus" size={15} className="text-faint" />
        <input
          aria-label={t("categories.newOf", { kind: title.toLowerCase() })}
          className="h-10 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-faint focus-visible:outline-none sm:text-sm"
          placeholder={t("categories.new")}
          value={name}
          maxLength={80}
          onChange={(event) => setName(sanitizeText(event.target.value))}
          disabled={create.isPending}
        />
        {name.trim() ? (
          <button
            type="submit"
            disabled={create.isPending}
            className="animate-enter rounded-lg px-2.5 py-1.5 text-xs text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
          >
            {t("common.actions.add")}
          </button>
        ) : null}
      </form>
    </article>
  );
}
