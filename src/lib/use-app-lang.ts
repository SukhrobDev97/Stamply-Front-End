"use client";

import { useEffect, useState } from "react";
import { t, type ProfileLang } from "@/app/profile/copy";
import { STAMPLY_LANG_CHANGED } from "@/lib/lang";

/** Reads `lang` from localStorage and stays in sync with Home / Login switcher. */
export function useAppLang() {
  const [lang, setLang] = useState<ProfileLang>("uz");

  useEffect(() => {
    const apply = () => {
      try {
        const v = localStorage.getItem("lang");
        if (v === "ru" || v === "uz") setLang(v);
      } catch {
        // ignore
      }
    };
    apply();
    window.addEventListener(STAMPLY_LANG_CHANGED, apply);
    const onStorage = (e: StorageEvent) => {
      if (e.key === "lang") apply();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(STAMPLY_LANG_CHANGED, apply);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return { lang, txt: t[lang] } as const;
}
