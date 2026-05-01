export const STAMPLY_LANG_CHANGED = "stamply:lang-changed";

export type AppLang = "uz" | "ru";

/** Persist language and notify all listeners (same tab + other tabs via storage). */
export function setStoredLang(next: AppLang) {
  try {
    localStorage.setItem("lang", next);
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new CustomEvent(STAMPLY_LANG_CHANGED, { detail: next }));
  } catch {
    // ignore
  }
}
