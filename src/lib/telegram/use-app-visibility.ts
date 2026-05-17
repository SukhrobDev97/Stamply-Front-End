"use client";

import { useApolloClient } from "@apollo/client/react";
import { useEffect, useRef } from "react";

/** Refetch active queries when the Mini App returns from background (not on scroll). */
export function useTelegramVisibilityRefetch(enabled = true) {
  const client = useApolloClient();
  const wasHiddenRef = useRef(false);

  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        wasHiddenRef.current = true;
        return;
      }
      if (document.visibilityState !== "visible") return;
      if (!wasHiddenRef.current) return;
      wasHiddenRef.current = false;
      void client.reFetchObservableQueries(true);
    };

    if (document.visibilityState === "hidden") {
      wasHiddenRef.current = true;
    }

    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [client, enabled]);
}
