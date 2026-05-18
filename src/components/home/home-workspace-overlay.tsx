"use client";

import type { ProfileLang, t } from "@/app/profile/copy";
import { isWorkspaceDeactivatedStatus } from "@/lib/business-lifecycle";
import { switchToPlatformWorkspace } from "@/lib/workspace-switch";
import { Check, Loader2, Shield } from "lucide-react";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { memo } from "react";

type WorkspaceItem = {
  business_id: number;
  name: string;
  business_type: string;
  role: string;
  status: string;
  is_active_workspace: boolean;
};

type HomeWorkspaceOverlayProps = {
  open: boolean;
  txt: (typeof t)[ProfileLang];
  workspacePos: { top: number; left: number; width: number };
  workspaces: WorkspaceItem[];
  hasPlatformDashboard: boolean;
  switchingTo: number | null;
  switchToPlatform: () => void;
  router: AppRouterInstance;
  onClose: () => void;
  onSwitchWorkspace: (businessId: number) => void;
  getFirstLetter: (name: string) => string;
};

function HomeWorkspaceOverlayInner({
  open,
  txt,
  workspacePos,
  workspaces,
  hasPlatformDashboard,
  switchingTo,
  switchToPlatform,
  router,
  onClose,
  onSwitchWorkspace,
  getFirstLetter,
}: HomeWorkspaceOverlayProps) {
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-transparent" onClick={onClose} aria-hidden />
      <div
        className={[
          "fixed z-50 origin-top-left rounded-[24px] border border-gray-200/80",
          "bg-white/85 backdrop-blur-xl shadow-[0_18px_48px_rgba(15,23,42,0.16)]",
          "w-[340px] max-w-[calc(100vw-32px)]",
          "transition duration-150 ease-out",
        ].join(" ")}
        style={{
          top: `${workspacePos.top}px`,
          left: `${workspacePos.left}px`,
          transform: "scale(1)",
        }}
      >
        <div className="px-4 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-900">{txt.workspacesTitle}</div>
              <div className="mt-0.5 text-xs text-gray-500">{txt.homeWorkspaceDropdownHint}</div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-[0.99]"
            >
              ×
            </button>
          </div>
        </div>

        <div className="mt-3 max-h-[60vh] overflow-auto px-2 pb-2">
          {workspaces.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-gray-100 text-gray-700">
                <Shield className="h-5 w-5" aria-hidden />
              </div>
              <div className="mt-3 text-sm font-semibold text-gray-900">{txt.homeWorkspaceEmptyTitle}</div>
              <div className="mt-1 text-xs text-gray-500">{txt.homeWorkspaceEmptyBody}</div>
            </div>
          ) : (
            <div className="space-y-1">
              {hasPlatformDashboard ? (
                <button
                  type="button"
                  onClick={() => {
                    switchToPlatformWorkspace({ switchToPlatform, router });
                    onClose();
                  }}
                  className="flex h-[56px] w-full items-center justify-between gap-3 rounded-2xl px-3 text-left transition hover:bg-gray-50 active:scale-[0.99]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-700">
                      <Shield className="h-4 w-4" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-gray-900">{txt.workspacesPlatformTitle}</div>
                      <div className="truncate text-xs text-gray-500">{txt.workspacesPlatformSubtitle}</div>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-700">
                    {txt.workspacesInternal}
                  </span>
                </button>
              ) : null}

              {workspaces.map((w) => {
                const active = Boolean(w.is_active_workspace);
                const isSwitching = switchingTo === w.business_id;
                const isDeactivated = isWorkspaceDeactivatedStatus(w.status);
                return (
                  <button
                    key={w.business_id}
                    type="button"
                    disabled={switchingTo != null}
                    onClick={() => onSwitchWorkspace(Number(w.business_id))}
                    className={[
                      "flex h-[60px] w-full items-center justify-between gap-3 rounded-2xl px-3 text-left transition active:scale-[0.99] disabled:opacity-60",
                      isDeactivated ? "opacity-65" : "",
                      active ? "bg-gray-50 ring-1 ring-gray-200" : "hover:bg-gray-50",
                    ].join(" ")}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-700">
                        {isSwitching ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        ) : (
                          <span className="text-sm font-bold">{getFirstLetter(w.name)}</span>
                        )}
                      </div>
                    <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-gray-900">{w.name}</div>
                        <div className="truncate text-xs text-gray-500">
                          {isSwitching
                            ? txt.workspacesSelecting
                            : isDeactivated
                              ? txt.homeWorkspaceInactiveShort
                              : w.role}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {active && !isSwitching ? <Check className="h-4 w-4 text-gray-900" aria-hidden /> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200/70 p-3">
          <button
            type="button"
            onClick={() => {
              onClose();
              router.push("/create-business");
            }}
            className="w-full rounded-xl bg-[linear-gradient(135deg,rgba(2,132,199,0.16)_0%,rgba(15,23,42,0.06)_100%)] px-4 py-3 text-sm font-semibold text-gray-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] hover:bg-[linear-gradient(135deg,rgba(2,132,199,0.20)_0%,rgba(15,23,42,0.08)_100%)] active:scale-[0.99]"
          >
            {`+ ${txt.workspacesCreateBusiness}`}
          </button>
        </div>
      </div>
    </>
  );
}

export const HomeWorkspaceOverlay = memo(HomeWorkspaceOverlayInner);
