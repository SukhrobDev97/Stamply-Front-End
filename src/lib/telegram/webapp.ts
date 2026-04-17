/**
 * Telegram Mini App bridge. Auth and SDK usage can be layered on here later.
 */
export function getTelegramWebApp() {
  if (typeof window === "undefined") return undefined;
  return window.Telegram?.WebApp;
}
