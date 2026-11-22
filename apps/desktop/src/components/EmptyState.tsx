import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state flex flex-col items-center justify-center rounded-3xl bg-surface px-6 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-raised text-gold">
        <Icon name={icon} size={20} />
      </div>
      <p className="mt-5 font-display text-2xl">{title}</p>
      {description ? (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
