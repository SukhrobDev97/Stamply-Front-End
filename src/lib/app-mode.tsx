"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type AppMode = "platform" | "business";

type AppModeCtx = {
  mode: AppMode;
  switchToBusiness: (businessId: number) => void;
  switchToPlatform: () => void;
};

const AppModeContext = createContext<AppModeCtx | null>(null);

const STORAGE_KEY = "stamply_mode";

function readStoredMode(initialRole: string | null): AppMode {
  if (typeof window === "undefined") {
    return initialRole === "platform_owner" ? "platform" : "business";
  }
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored === "business" || stored === "platform") {
      if (stored === "platform" && initialRole !== "platform_owner") return "business";
      return stored;
    }
  } catch {
    // ignore
  }
  return initialRole === "platform_owner" ? "platform" : "business";
}

export function AppModeProvider({
  children,
  initialRole,
}: {
  children: ReactNode;
  initialRole: string | null;
}) {
  const [mode, setMode] = useState<AppMode>(() =>
    readStoredMode(initialRole),
  );

  useEffect(() => {
    if (initialRole === null) return;
    if (initialRole !== "platform_owner") {
      try {
        sessionStorage.setItem(STORAGE_KEY, "business");
      } catch {
        // ignore
      }
      setMode((m) => (m === "platform" ? "business" : m));
    }
  }, [initialRole]);

  useEffect(() => {
    const onInvalid = () => {
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
      setMode("business");
    };
    window.addEventListener("stamply:session-invalidated", onInvalid);
    return () =>
      window.removeEventListener("stamply:session-invalidated", onInvalid);
  }, []);

  const switchToBusiness = useCallback((_businessId: number) => {
    try {
      sessionStorage.setItem(STORAGE_KEY, "business");
    } catch {
      // ignore
    }
    setMode("business");
  }, []);

  const switchToPlatform = useCallback(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, "platform");
    } catch {
      // ignore
    }
    setMode("platform");
  }, []);

  return (
    <AppModeContext.Provider value={{ mode, switchToBusiness, switchToPlatform }}>
      {children}
    </AppModeContext.Provider>
  );
}

export function useAppMode() {
  const ctx = useContext(AppModeContext);
  if (!ctx) throw new Error("useAppMode must be used within AppModeProvider");
  return ctx;
}
