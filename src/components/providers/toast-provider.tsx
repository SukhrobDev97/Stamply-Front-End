"use client";

import type { ProfileLang } from "@/app/profile/copy";
import { mapApiErrorToUserMessage, normalizeApiError, type ApiError } from "@/lib/api";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastKind = "success" | "error" | "info";

export type ToastItem = {
  id: number;
  kind: ToastKind;
  message: string;
};

type ToastContextValue = {
  show: (message: string, kind?: ToastKind, durationMs?: number) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  showApiError: (err: unknown, lang?: ProfileLang) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_MS: Record<ToastKind, number> = {
  success: 1800,
  error: 4000,
  info: 2200,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const idRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const show = useCallback((message: string, kind: ToastKind = "info", durationMs?: number) => {
    clearTimer();
    const id = ++idRef.current;
    setToast({ id, kind, message });
    const ms = durationMs ?? DEFAULT_MS[kind];
    timerRef.current = setTimeout(() => {
      setToast((cur) => (cur?.id === id ? null : cur));
    }, ms);
  }, []);

  const success = useCallback((message: string) => show(message, "success"), [show]);
  const error = useCallback((message: string) => show(message, "error"), [show]);
  const info = useCallback((message: string) => show(message, "info"), [show]);

  const showApiError = useCallback(
    (err: unknown, lang: ProfileLang = "uz") => {
      const api: ApiError = normalizeApiError(err);
      error(mapApiErrorToUserMessage(api, lang));
    },
    [error],
  );

  useEffect(() => () => clearTimer(), []);

  const value = useMemo(
    () => ({ show, success, error, info, showApiError }),
    [show, success, error, info, showApiError],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed left-0 right-0 bottom-[104px] z-[90] mx-auto flex max-w-md justify-center px-4"
        >
          <div
            className={[
              "rounded-full px-4 py-2 text-xs font-semibold shadow-sm",
              toast.kind === "error"
                ? "bg-red-900/90 text-white"
                : toast.kind === "success"
                  ? "bg-emerald-900/90 text-white"
                  : "bg-black/85 text-white",
            ].join(" ")}
          >
            {toast.message}
          </div>
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
