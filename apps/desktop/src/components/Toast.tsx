import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Toast = { id: number; message: string; tone: "info" | "error" };

const ToastContext = createContext<(message: string, tone?: Toast["tone"]) => void>(
  () => undefined,
);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current.slice(-2), { id, message, tone }]);
    // Errors stay longer: they are read, not just noticed.
    window.setTimeout(
      () => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      },
      tone === "error" ? 5200 : 3200,
    );
  }, []);

  // A popover lives in the top layer, so a toast raised from inside a modal
  // shows above it instead of behind its backdrop. Re-showing moves it to
  // the front of whatever opened in the meantime.
  const layer = useRef<HTMLDivElement>(null);
  const visible = toasts.length > 0;
  const latest = toasts[toasts.length - 1]?.id;
  useEffect(() => {
    const element = layer.current;
    if (!element?.showPopover) {
      return;
    }
    const open = element.matches(":popover-open");
    if (!visible) {
      if (open) element.hidePopover();
      return;
    }
    if (open && document.querySelector("dialog[open]")) {
      element.hidePopover();
      element.showPopover();
    } else if (!open) {
      element.showPopover();
    }
  }, [visible, latest]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div ref={layer} popover="manual" aria-live="polite" className="toasts">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
            className={`animate-enter max-w-md rounded-2xl border px-4 py-2.5 text-center text-sm shadow-xl shadow-black/40 ${
              toast.tone === "error"
                ? "border-negative/30 bg-negative-surface text-negative"
                : "border-line-strong bg-raised text-foreground"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
