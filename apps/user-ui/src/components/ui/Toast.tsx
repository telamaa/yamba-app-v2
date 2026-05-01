/**
 * Toast Notification System
 * =========================
 * Lightweight toast for success/error notifications.
 * No external dependencies — uses React context + CSS animations.
 *
 * 📁 Place in: apps/user-ui/src/components/ui/Toast.tsx
 *
 * 🔌 Integration:
 *
 * 1. Wrap your app layout with <ToastProvider>:
 *
 *    // app/[locale]/layout.tsx
 *    import { ToastProvider } from "@/components/ui/Toast";
 *
 *    return (
 *      <NextIntlClientProvider>
 *        <Providers>
 *          <ThemeProvider>
 *            <UiPreferencesProvider>
 *              <ToastProvider>
 *                <Header />
 *                <div className="pt-[78px]">{children}</div>
 *              </ToastProvider>
 *            </UiPreferencesProvider>
 *          </ThemeProvider>
 *        </Providers>
 *      </NextIntlClientProvider>
 *    );
 *
 * 2. Use the hook anywhere:
 *
 *    import { useToast } from "@/components/ui/Toast";
 *
 *    const { toast } = useToast();
 *    toast({ type: "success", message: "Profil activé !" });
 *    toast({ type: "info", title: "Collage désactivé", message: "Veuillez ressaisir le mot de passe." });
 */

"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";

// ─── Types ───────────────────────────────────────────────────────
interface ToastItem {
  id: string;
  type: "success" | "error" | "info";
  title?: string; // Optionnel : titre en gras au-dessus du message
  message: string;
  duration?: number; // ms, default 5000
}

interface ToastContextType {
  toast: (item: Omit<ToastItem, "id">) => void;
}

// ─── Context ─────────────────────────────────────────────────────
const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

// ─── Provider + Renderer ─────────────────────────────────────────
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((item: Omit<ToastItem, "id">) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev, { ...item, id }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Toast container — fixed top right */}
      <div className="pointer-events-none fixed right-0 top-0 z-[9999] flex flex-col items-end gap-3 p-4 sm:p-6">
        {toasts.map((t) => (
          <ToastNotification key={t.id} item={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ─── Individual Toast ────────────────────────────────────────────
function ToastNotification({
                             item,
                             onDismiss,
                           }: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  // Animate in
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // Auto-dismiss
  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onDismiss(item.id), 300);
    }, item.duration || 5000);

    return () => clearTimeout(timer);
  }, [item, onDismiss]);

  const handleDismiss = () => {
    setExiting(true);
    setTimeout(() => onDismiss(item.id), 300);
  };

  const styles = {
    success: {
      bg: "bg-emerald-50 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-800",
      icon: "text-emerald-500",
      text: "text-emerald-800 dark:text-emerald-200",
      title: "text-emerald-900 dark:text-emerald-100",
    },
    error: {
      bg: "bg-red-50 dark:bg-red-950/80 border-red-200 dark:border-red-800",
      icon: "text-red-500",
      text: "text-red-800 dark:text-red-200",
      title: "text-red-900 dark:text-red-100",
    },
    info: {
      bg: "bg-blue-50 dark:bg-blue-950/80 border-blue-200 dark:border-blue-800",
      icon: "text-blue-500",
      text: "text-blue-800 dark:text-blue-200",
      title: "text-blue-900 dark:text-blue-100",
    },
  };

  const s = styles[item.type];

  const icons = {
    success: (
      <svg
        className={`h-5 w-5 ${s.icon}`}
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
        />
      </svg>
    ),
    error: (
      <svg
        className={`h-5 w-5 ${s.icon}`}
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
        />
      </svg>
    ),
    info: (
      <svg
        className={`h-5 w-5 ${s.icon}`}
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"
        />
      </svg>
    ),
  };

  return (
    <div
      className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm transition-all duration-300 ${s.bg} ${
        visible && !exiting
          ? "translate-x-0 opacity-100"
          : "translate-x-8 opacity-0"
      }`}
    >
      <div className="mt-0.5 flex-shrink-0">{icons[item.type]}</div>

      <div className="flex-1 min-w-0">
        {item.title && (
          <p className={`text-sm font-semibold leading-snug ${s.title}`}>
            {item.title}
          </p>
        )}
        <p
          className={`text-sm leading-snug ${s.text} ${
            item.title ? "mt-0.5 font-normal" : "font-medium"
          }`}
        >
          {item.message}
        </p>
      </div>

      <button
        onClick={handleDismiss}
        className={`-mr-1 -mt-1 flex-shrink-0 rounded-lg p-1 opacity-50 transition-opacity hover:opacity-100 ${s.text}`}
        aria-label="Dismiss"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18 18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}
