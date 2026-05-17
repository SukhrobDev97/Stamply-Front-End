"use client";

import { useTelegramVisibilityRefetch } from "@/lib/telegram/use-app-visibility";

/** Global client lifecycle hooks (Telegram resume, etc.). */
export function AppLifecycle() {
  useTelegramVisibilityRefetch(true);
  return null;
}
