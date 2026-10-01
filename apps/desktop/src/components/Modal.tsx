import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";

/** Native <dialog>: focus trap, Esc to close and top layer for free. */
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

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
      // showModal focuses the first focusable element, which is the close
      // button; the first field is where people want to type.
      dialog
        .querySelector<HTMLElement>(
          "form input:not([type=hidden]):not([disabled]):not([type=checkbox]), form select, form textarea",
        )
        ?.focus();
    }
    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="modal m-auto"
      onClose={onClose}
      onMouseDown={(event) => {
        if (event.target === ref.current) {
          onClose();
        }
      }}
    >
      {open ? (
        <div
          className="rounded-3xl border border-line-strong bg-surface p-6 shadow-2xl shadow-black/50"
          style={{ width: `min(${width}px, calc(100vw - 32px))` }}
        >
          <header className="mb-5 flex items-center justify-between">
            <h2 className="font-display text-xl">{title}</h2>
            <button
              type="button"
              aria-label="Fechar"
              className="-mr-2 rounded-lg p-2 text-muted transition-colors hover:bg-white/5 hover:text-foreground"
              onClick={onClose}
            >
              <Icon name="close" size={16} />
            </button>
          </header>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
