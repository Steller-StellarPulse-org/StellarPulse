"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import Toast from "@/components/ui/Toast";

interface ToastItem {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

interface ToastContextValue {
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback(
    (message: string, type: "success" | "error" | "info" = "info") => {
      const id = nextId++;
      setToasts((prev) => [...prev, { id, message, type }]);
    },
    []
  );

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Render toasts stacked from top-right.
          On narrow viewports the container spans the full width with 1rem
          margins (inset-x-4) so the toast never overflows off-screen; from the
          sm breakpoint up it anchors to the top-right at max-w-sm. */}
      <div className="fixed top-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:w-full sm:max-w-sm z-[200] space-y-2 pointer-events-none">
        {toasts.map((t, i) => (
          <div key={t.id} className="pointer-events-auto" style={{ marginTop: i > 0 ? "0.5rem" : 0 }}>
            <Toast
              message={t.message}
              type={t.type}
              onDismiss={() => dismiss(t.id)}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
