"use client";

import {
  stamplyDebugCopyText,
  stamplyDebugEntries,
  stamplyDebugLog,
  subscribeStamplyDebug,
} from "@/lib/stamply-debug-log";
import { useEffect, useState } from "react";

/**
 * Dev-only in-app debug for Telegram Mini App (no browser DevTools).
 * Tap "DBG" → see recent logs; "Console" opens Eruda.
 */
export function StamplyDevTools() {
  const [open, setOpen] = useState(false);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    return subscribeStamplyDebug(() => tick((n) => n + 1));
  }, []);

  if (process.env.NODE_ENV !== "development") return null;

  const graphqlUri = process.env.NEXT_PUBLIC_GRAPHQL_URL ?? "(unset)";
  const entries = stamplyDebugEntries();

  const openEruda = async () => {
    try {
      const w = window as Window & { __stamplyEruda?: boolean };
      if (w.__stamplyEruda) {
        stamplyDebugLog("debug", "Eruda already open — use its Network tab");
        return;
      }
      const eruda = (await import("eruda")).default;
      eruda.init();
      w.__stamplyEruda = true;
      stamplyDebugLog("debug", "Eruda ready — reproduce upload, check Network");
    } catch (e) {
      stamplyDebugLog("debug", "Eruda failed to load", String(e));
    }
  };

  const copyLogs = async () => {
    const text = stamplyDebugCopyText();
    try {
      await navigator.clipboard.writeText(text);
      setCopyHint("Copied — paste in chat to share");
      stamplyDebugLog("debug", "logs copied to clipboard");
    } catch {
      setCopyHint(text ? "Copy failed — logs stay in panel below" : "No logs yet");
      stamplyDebugLog("debug", "clipboard unavailable");
    }
    window.setTimeout(() => setCopyHint(null), 3000);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 left-3 z-[9999] rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-bold tracking-wide text-white shadow-lg"
        aria-label="Open debug panel"
      >
        DBG
      </button>
    );
  }

  return (
    <div className="fixed inset-x-2 bottom-20 z-[9999] max-h-[45vh] overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl">
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-2">
        <span className="text-xs font-semibold text-gray-800">Stamply debug</span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => void openEruda()}
            className="rounded-lg bg-gray-100 px-2 py-1 text-[10px] font-semibold text-gray-700"
          >
            Console
          </button>
          <button
            type="button"
            onClick={() => void copyLogs()}
            className="rounded-lg bg-gray-100 px-2 py-1 text-[10px] font-semibold text-gray-700"
          >
            Copy
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg bg-gray-900 px-2 py-1 text-[10px] font-semibold text-white"
          >
            Close
          </button>
        </div>
      </div>
      <p className="border-b border-gray-50 px-3 py-1.5 text-[10px] text-gray-500">
        GraphQL: <span className="font-mono text-gray-800">{graphqlUri}</span>
      </p>
      {copyHint ? (
        <p className="border-b border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[10px] font-medium text-emerald-800">
          {copyHint}
        </p>
      ) : null}
      <pre className="max-h-[30vh] overflow-y-auto p-2 text-[10px] leading-relaxed text-gray-800">
        {entries.length === 0
          ? "No logs yet. Try upload or login."
          : entries.map((e) => `${e.at} [${e.tag}] ${e.message}`).join("\n")}
      </pre>
    </div>
  );
}
