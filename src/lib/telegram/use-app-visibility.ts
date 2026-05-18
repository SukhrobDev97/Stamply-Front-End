"use client";

import { resumeStamplyQueries } from "@/lib/telegram/resume-refetch";
import { getTelegramWebApp } from "@/lib/telegram/webapp";
import { useApolloClient } from "@apollo/client/react";
import { useEffect, useRef } from "react";

/** Refetch active queries when the Mini App returns from background (not on scroll). */
export function useTelegramVisibilityRefetch(enabled = true) {
  const client = useApolloClient();
  const wasHiddenRef = useRef(false);

  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;

    const resume = () => {
      window.setTimeout(() => {
        void resumeStamplyQueries(client);
      }, 400);
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        wasHiddenRef.current = true;
        return;
      }
      if (document.visibilityState !== "visible") return;
      if (!wasHiddenRef.current) return;
      wasHiddenRef.current = false;
      resume();
    };

    if (document.visibilityState === "hidden") {
      wasHiddenRef.current = true;
    }

    document.addEventListener("visibilitychange", onVisibility);

    const webApp = getTelegramWebApp();
    const onTelegramResume = () => {
      if (document.visibilityState === "hidden") return;
      resume();
    };
    webApp?.onEvent?.("viewportChanged", onTelegramResume);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      webApp?.offEvent?.("viewportChanged", onTelegramResume);
    };
  }, [client, enabled]);
}
