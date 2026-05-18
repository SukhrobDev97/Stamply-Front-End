"use client";

import { useAuth } from "@/app/providers";
import { t, type ProfileLang } from "@/app/profile/copy";
import { useAppMode } from "@/lib/app-mode";
import { useAppLang } from "@/lib/use-app-lang";
import { switchToBusinessWorkspace, switchToPlatformWorkspace } from "@/lib/workspace-switch";
import { WorkspacesPageSkeleton } from "@/components/workspaces/workspaces-page-skeleton";
import { MY_WORKSPACES_QUERY } from "@/graphql/queries/myWorkspaces.query";
import { SELECT_WORKSPACE_MUTATION } from "@/graphql/mutations/selectWorkspace.mutation";
import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import { Shield, Plus, Building2, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { userMessageFromUnknown } from "@/lib/api";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

type WorkspaceItem = {
  business_id: number;
  name: string;
  business_type: string;
  role: string;
  status: string;
  is_active_workspace: boolean;
};

type MyWorkspacesPayload = {
  active_business_id?: number | null;
  canCreateBusiness: boolean;
  hasPlatformDashboard: boolean;
  items: WorkspaceItem[];
};

type MyWorkspacesQueryData = {
  myWorkspaces: MyWorkspacesPayload;
};

type Txt = (typeof t)[ProfileLang];

function subscribeHydration() {
  return () => undefined;
}

function getClientHydrationSnapshot() {
  return true;
}

function getServerHydrationSnapshot() {
  return false;
}

function statusBadge(status: string, txt: Txt) {
  const s = String(status || "").toLowerCase();
  if (s === "active") return { cls: "bg-emerald-50 text-emerald-800 ring-emerald-100", label: txt.workspacesStatusActive };
  if (s === "trial") return { cls: "bg-amber-50 text-amber-900 ring-amber-100", label: txt.workspacesStatusTrial };
  if (s === "expired") return { cls: "bg-red-50 text-red-800 ring-red-100", label: txt.workspacesStatusExpired };
  if (s === "blocked" || s === "deactivated") {
    return { cls: "bg-slate-100 text-slate-700 ring-slate-200", label: txt.workspacesStatusDeactivated };
  }
  return { cls: "bg-slate-100 text-slate-800 ring-slate-200", label: status || "—" };
}

export default function WorkspacesPage() {
  const router = useRouter();
  const client = useApolloClient();
  const { txt, lang } = useAppLang();
  const { ready, isAuthenticated } = useAuth();
  const { switchToPlatform, switchToBusiness } = useAppMode();
  const clientReady = useSyncExternalStore(
    subscribeHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  );

  const token = useMemo(() => {
    if (!clientReady || typeof window === "undefined") return null;
    try {
      return localStorage.getItem("accessToken");
    } catch {
      return null;
    }
  }, [clientReady]);

  useEffect(() => {
    if (!ready || !clientReady) return;
    if (!isAuthenticated || !token) router.replace("/");
  }, [clientReady, isAuthenticated, ready, router, token]);

  const canQuery = clientReady && ready && isAuthenticated && !!token;
  const { data, loading, error, refetch } = useQuery<MyWorkspacesQueryData>(MY_WORKSPACES_QUERY, {
    skip: !canQuery,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
  });

  const awaitingFirstWorkspacePayload = canQuery && loading && data === undefined;

  const [selectWorkspace, { loading: selecting }] = useMutation(SELECT_WORKSPACE_MUTATION);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(t);
  }, [toast]);

  const payload = data?.myWorkspaces;
  const items = useMemo(() => payload?.items ?? [], [payload?.items]);
  const showPlatform = Boolean(payload?.hasPlatformDashboard);
  const canCreate = Boolean(payload?.canCreateBusiness);

  const sorted = useMemo(() => {
    const out = [...items];
    out.sort((a, b) => Number(b.is_active_workspace) - Number(a.is_active_workspace) || b.business_id - a.business_id);
    return out;
  }, [items]);

  if (!clientReady || !ready || !canQuery || awaitingFirstWorkspacePayload) {
    return <WorkspacesPageSkeleton />;
  }

  return (
    <div className="min-h-dvh bg-[#F5F7FB] text-slate-900">
      <div className="mx-auto max-w-md px-4 pb-24 pt-8">
        <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="text-lg font-semibold tracking-[-0.02em]">{txt.workspacesTitle}</div>
          <div className="mt-1 text-sm text-slate-500">{txt.workspacesSubtitle}</div>
        </div>

        <div className="mt-5 space-y-3">
          {showPlatform ? (
            <button
              type="button"
              onClick={() => switchToPlatformWorkspace({ switchToPlatform, router, replace: false })}
              className="w-full rounded-[24px] border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:bg-slate-50 active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Shield className="h-4 w-4 text-slate-700" aria-hidden />
                    {txt.workspacesPlatformTitle}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{txt.workspacesPlatformSubtitle}</div>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
                  {txt.workspacesInternal}
                </span>
              </div>
            </button>
          ) : null}

          {error ? (
            <div className="rounded-[24px] border border-red-200 bg-white p-5 text-sm text-red-600 shadow-sm">
              {userMessageFromUnknown(error, lang)}
            </div>
          ) : (
            <>
              {sorted.map((w) => {
                const badge = statusBadge(w.status, txt);
                const isActive = w.is_active_workspace;
                const isBusy = selecting && busyId === w.business_id;
                const normalizedStatus = String(w.status || "").toLowerCase();
                const isDeactivated =
                  normalizedStatus === "deactivated" || normalizedStatus === "blocked";
                return (
                  <button
                    key={w.business_id}
                    type="button"
                    disabled={selecting}
                    onClick={() => {
                      if (isDeactivated) {
                        setToast(txt.workspacesDeactivatedToast);
                        return;
                      }
                      void (async () => {
                        setBusyId(w.business_id);
                        try {
                          await switchToBusinessWorkspace({
                            businessId: w.business_id,
                            selectWorkspace,
                            switchToBusiness,
                            router,
                            client,
                            refetchWorkspaces: refetch,
                          });
                        } finally {
                          setBusyId(null);
                        }
                      })();
                    }}
                    className={[
                      "w-full rounded-[24px] border bg-white p-5 text-left shadow-sm transition active:scale-[0.99]",
                      isDeactivated ? "opacity-65" : "hover:bg-slate-50",
                      isActive ? "border-slate-300 ring-2 ring-slate-200" : "border-slate-200",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 ring-1 ring-slate-200">
                            <Building2 className="h-4 w-4" aria-hidden />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-900">{w.name}</div>
                            <div className="mt-0.5 truncate text-xs text-slate-500">
                              {w.business_type} • {w.role}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white">
                            <Check className="h-3.5 w-3.5" aria-hidden />
                            {txt.workspacesActive}
                          </span>
                        ) : null}
                        <span className={["rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1", badge.cls].join(" ")}>
                          {badge.label}
                        </span>
                      </div>
                    </div>
                    {isBusy ? <div className="mt-3 text-xs font-semibold text-slate-500">{txt.workspacesSelecting}</div> : null}
                  </button>
                );
              })}

              {canCreate ? (
                <button
                  type="button"
                  onClick={() => router.push("/create-business")}
                  className="w-full rounded-[24px] border border-dashed border-slate-300 bg-white p-5 text-left text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 ring-1 ring-slate-200">
                      <Plus className="h-4 w-4" aria-hidden />
                    </div>
                    <div className="text-sm font-semibold">{txt.workspacesCreateBusiness}</div>
                  </div>
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>
      {toast ? (
        <div className="pointer-events-none fixed bottom-5 left-0 right-0 z-50 flex justify-center px-4">
          <div className="rounded-full bg-black/85 px-4 py-2 text-xs font-semibold text-white shadow-sm">
            {toast}
          </div>
        </div>
      ) : null}
    </div>
  );
}

