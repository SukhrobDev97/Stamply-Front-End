"use client";

import { useCallback, useState } from "react";

type OverlayPhase = "closed" | "enter" | "visible" | "exit";

export function useOverlayModal() {
  const [phase, setPhase] = useState<OverlayPhase>("closed");

  const open = useCallback(() => {
    setPhase("enter");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setPhase("visible"));
    });
  }, []);

  const close = useCallback(() => {
    setPhase((p) => (p === "closed" || p === "exit" ? p : "exit"));
  }, []);

  const onOverlayTransitionEnd = useCallback((e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.propertyName !== "opacity") return;
    setPhase((p) => (p === "exit" ? "closed" : p));
  }, []);

  const show = phase !== "closed";
  const panelOpen = phase === "visible";

  const overlayClassName = [
    "fixed inset-0 z-50 grid place-items-center bg-black/40 px-6 transition-all duration-200",
    panelOpen ? "opacity-100" : "opacity-0",
  ].join(" ");

  const panelClassName = "transition-all duration-200";
  const panelOpenClassName = panelOpen ? "scale-100" : "scale-95 opacity-0";

  return { show, open, close, onOverlayTransitionEnd, overlayClassName, panelClassName, panelOpenClassName };
}
