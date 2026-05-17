"use client";

import { useCallback, useEffect, useState } from "react";
import { t, type ProfileLang } from "@/app/profile/copy";
import { setStoredLang, STAMPLY_LANG_CHANGED, type AppLang } from "@/lib/lang";

function readStoredLang(): ProfileLang {
  try {
    const v = localStorage.getItem("lang");
    if (v === "ru" || v === "uz") return v;
  } catch {
    // ignore
  }
  return "uz";
}

/** Reads `lang` from localStorage and stays in sync across tabs / components. */
export function useAppLang() {
  const [lang, setLangState] = useState<ProfileLang>("uz");

  useEffect(() => {
    const apply = (e?: Event) => {
      const fromEvent =
        e instanceof CustomEvent && (e.detail === "ru" || e.detail === "uz")
          ? (e.detail as AppLang)
          : null;
      setLangState(fromEvent ?? readStoredLang());
    };
    apply();
    window.addEventListener(STAMPLY_LANG_CHANGED, apply);
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === "lang") apply();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(STAMPLY_LANG_CHANGED, apply);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  /** Immediate UI update + persist (avoids mixed uz/ru labels during async event roundtrip). */
  const setLang = useCallback((next: ProfileLang) => {
    setLangState(next);
    setStoredLang(next);
  }, []);

  return { lang, txt: t[lang], setLang } as const;
}
