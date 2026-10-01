import {
  createContext,
  useCallback,
  useContext,
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
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3200);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`animate-enter rounded-full border px-4 py-2 text-sm shadow-xl shadow-black/40 backdrop-blur ${
              toast.tone === "error"
                ? "border-negative/30 bg-[#2a1714]/90 text-negative"
                : "border-line-strong bg-raised/90 text-foreground"
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
