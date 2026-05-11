"use client";

import { useAppLang } from "@/lib/use-app-lang";

/**
 * Layout-matched skeleton for /workspaces (Select workspace).
 * Mirrors WorkspacesPage shell to avoid CLS when list hydrates.
 */
export function WorkspacesPageSkeleton() {
  const { txt } = useAppLang();
  return (
    <div
      className="min-h-dvh animate-pulse bg-[#F5F7FB] motion-reduce:animate-none"
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={txt.workspacesLoadingAria}
    >
      <div className="mx-auto max-w-md px-4 pb-24 pt-8">
        <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="h-6 w-48 rounded-lg bg-slate-200/90" />
          <div className="mt-2 h-4 w-full max-w-[220px] rounded-md bg-slate-200/70" />
        </div>

        <div className="mt-5 space-y-3">
          <div className="h-[88px] w-full rounded-[24px] border border-slate-200 bg-white shadow-sm">
            <div className="flex h-full items-center gap-3 p-5">
              <div className="h-9 w-9 shrink-0 rounded-2xl bg-slate-200/90 ring-1 ring-slate-100" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-[45%] rounded-md bg-slate-200/85" />
                <div className="h-3 w-[60%] rounded-md bg-slate-200/65" />
              </div>
              <div className="h-6 w-14 shrink-0 rounded-full bg-slate-200/75" />
            </div>
          </div>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-[88px] w-full rounded-[24px] border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex h-full items-center gap-3 p-5">
                <div className="h-9 w-9 shrink-0 rounded-2xl bg-slate-200/90 ring-1 ring-slate-100" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 w-[55%] rounded-md bg-slate-200/85" />
                  <div className="h-3 w-[70%] rounded-md bg-slate-200/65" />
                </div>
                <div className="h-6 w-16 shrink-0 rounded-full bg-slate-200/75" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
