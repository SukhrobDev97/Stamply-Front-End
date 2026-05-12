export const STAMPLY_SUPPORT_TELEGRAM_URL = "https://t.me/sukhr0b97";

export function openStamplySupportTelegram(): void {
  if (typeof window === "undefined") return;
  const url = STAMPLY_SUPPORT_TELEGRAM_URL;
  const tg = (window as Window & { Telegram?: { WebApp?: { openTelegramLink?: (u: string) => void } } })
    .Telegram?.WebApp;
  if (tg?.openTelegramLink) {
    tg.openTelegramLink(url);
    return;
  }
  window.open(url, "_blank");
}
