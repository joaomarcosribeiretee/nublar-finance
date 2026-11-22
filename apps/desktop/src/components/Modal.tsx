import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";

/**
 * Native <dialog>: focus trap, Esc to close and top layer for free.
 * A centered card on desktop, a bottom sheet on phones (see index.css). The
 * body scrolls on its own so a long form never leaves the screen.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  width = 480,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: number;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
      // showModal focuses the first focusable element, which is the close
      // button; the first field is where people want to type. On touch the
      // sheet opens quietly instead of raising the keyboard over it.
      if (window.matchMedia("(pointer: fine)").matches) {
        dialog
          .querySelector<HTMLElement>(
            "form input:not([type=hidden]):not([disabled]):not([type=checkbox]):not([type=file]), form select, form textarea",
          )
          ?.focus();
      }
    }
    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={titleId}
      onClose={onClose}
      onMouseDown={(event) => {
        if (event.target === ref.current) {
          onClose();
        }
      }}
    >
      {open ? (
        <div
          className="pb-safe flex max-h-[92dvh] w-full flex-col rounded-t-3xl border border-line-strong bg-surface shadow-2xl shadow-black/50 sm:max-h-[calc(100dvh-48px)] sm:w-[min(var(--modal-width),calc(100vw-32px))] sm:rounded-3xl"
          style={{ "--modal-width": `${width}px` } as React.CSSProperties}
        >
          <header className="modal-heading flex shrink-0 items-center justify-between gap-3 px-5 py-5 sm:px-6">
            <h2 id={titleId} className="min-w-0 break-words font-display text-2xl">{title}</h2>
            <button
              type="button"
              aria-label="Fechar"
              className="-mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-foreground"
              onClick={onClose}
            >
              <Icon name="close" size={16} />
            </button>
          </header>
          <div className="min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-6">
            <div className="pb-5 sm:pb-6">{children}</div>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}

/**
 * The action row every form ends with. Sticks to the bottom of the scrolling
 * modal body, so the error and the button that caused it share the screen.
 */
export function FormFooter({ error, children }: { error?: string | null; children: ReactNode }) {
  return (
    <footer className="sticky bottom-0 -mx-5 -mb-5 space-y-3 border-t border-line bg-surface px-5 pt-3 pb-5 sm:-mx-6 sm:-mb-6 sm:px-6 sm:pb-6">
      {error ? (
        <p role="alert" className="animate-enter text-sm text-negative">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </footer>
  );
}
