"use client";

import { useSyncExternalStore } from "react";

function subscribeVisibility(onStoreChange: () => void) {
  if (typeof document === "undefined") return () => undefined;
  document.addEventListener("visibilitychange", onStoreChange);
  return () => document.removeEventListener("visibilitychange", onStoreChange);
}

function getVisibilitySnapshot(): DocumentVisibilityState {
  if (typeof document === "undefined") return "visible";
  return document.visibilityState;
}

function getServerVisibilitySnapshot(): DocumentVisibilityState {
  return "visible";
}

/** Reactive `document.visibilityState` (pauses polling when tab/mini-app is hidden). */
export function useDocumentVisibility(): DocumentVisibilityState {
  return useSyncExternalStore(
    subscribeVisibility,
    getVisibilitySnapshot,
    getServerVisibilitySnapshot,
  );
}
