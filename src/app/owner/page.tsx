"use client";

import { useAuth } from "@/app/providers";
import { apolloClient } from "@/lib/apollo/client";
import { useMutation, useQuery } from "@apollo/client/react";
import { OWNER_ME_QUERY } from "@/graphql/queries/ownerMe.query";
import { MY_WORKSPACES_QUERY } from "@/graphql/queries/myWorkspaces.query";
import { PLATFORM_BUSINESSES_QUERY } from "@/graphql/queries/platformBusinesses.query";
import { PLATFORM_BUSINESS_QUERY } from "@/graphql/queries/platformBusiness.query";
import { SELECT_WORKSPACE_MUTATION } from "@/graphql/mutations/selectWorkspace.mutation";
import {
  ACTIVATE_BUSINESS_MUTATION,
  DEACTIVATE_BUSINESS_MUTATION,
  DELETE_BUSINESS_MUTATION,
  EXTEND_TRIAL_MUTATION,
} from "@/graphql/mutations/platformOwner.mutations";
import {
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  LogOut,
  PauseCircle,
  Plus,
  Search,
  Shield,
  TimerReset,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAppMode } from "@/lib/app-mode";

type RawStatus = string;
type DisplayStatus = "active" | "deactivated";

function toDisplay(s: RawStatus): DisplayStatus {
  if (s === "ACTIVE" || s === "active") return "active";
  return "deactivated";
}

function toFilterValue(d: DisplayStatus): string {
  if (d === "deactivated") return "deactivated";
  return "active";
}

type PlatformBusinessRow = {
  id: number;
  name: string;
  businessType: string;
  createdAt: string;
  status: RawStatus;
  trialEndsAt?: string | null;
  ownerName?: string | null;
  totalCustomers: number;
  visitsToday: number;
};

type PlatformBusinessesPage = {
  items: PlatformBusinessRow[];
  total: number;
  page: number;
  limit: number;
};

type PlatformBusinessesQueryData = {
  platformBusinesses: PlatformBusinessesPage;
};

type PlatformBusinessDetail = {
  id: number;
  name: string;
  businessType: string;
  status: RawStatus;
  createdAt: string;
  trialEndsAt?: string | null;
  activatedAt?: string | null;
  blockedAt?: string | null;
  ownerId?: number | null;
  ownerName?: string | null;
  ownerTelegramId?: string | null;
  totalCustomers: number;
  rewardsCount: number;
  broadcastsCount: number;
  visitsToday: number;
};

type PlatformBusinessQueryData = {
  platformBusiness: PlatformBusinessDetail;
};

function fmt(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? "—"
    : new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "2-digit" }).format(d);
}

function daysLeft(v?: string | null) {
  if (!v) return null;
  const n = Math.ceil((new Date(v).getTime() - Date.now()) / 86400000);
  return Number.isFinite(n) ? n : null;
}

const STATUS_META: Record<DisplayStatus, { label: string; cls: string }> = {
  active:      { label: "Active",      cls: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  deactivated: { label: "Deactivated", cls: "bg-slate-100 text-slate-700  ring-slate-200"    },
};

function StatusBadge({ raw }: { raw: RawStatus }) {
  const d = toDisplay(raw);
  const m = STATUS_META[d];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${m.cls}`}>
      {m.label}
    </span>
  );
}

const DISPLAY_FILTERS: { label: string; value: "all" | DisplayStatus }[] = [
  { label: "All",         value: "all"         },
  { label: "Active",      value: "active"      },
  { label: "Deactivated", value: "deactivated" },
];

export default function OwnerPage() {
  const router = useRouter();
  const { ready, isAuthenticated, role } = useAuth();
  const { switchToPlatform, switchToBusiness } = useAppMode();

  useEffect(() => {
    if (!ready) return;
    if (!isAuthenticated) { router.replace("/"); return; }
    if (role !== "platform_owner") router.replace("/");
  }, [isAuthenticated, ready, role, router]);

  // Ensure mode is "platform" whenever this page is visited.
  useEffect(() => {
    switchToPlatform();
  }, [switchToPlatform]);

  const canAccess = ready && isAuthenticated && role === "platform_owner";

  const { error: ownerMeError } = useQuery(OWNER_ME_QUERY, {
    skip: !canAccess,
    fetchPolicy: "network-only",
  });
  useEffect(() => {
    if (!ready) return;
    if (ownerMeError) router.replace("/");
  }, [ownerMeError, ready, router]);

  const { logout } = useAuth();
  const [wsOpen, setWsOpen] = useState(false);
  const [switchingId, setSwitchingId] = useState<number | null>(null);

  type WsItem = {
    business_id: number;
    name: string;
    role: string;
    status?: string;
    is_active_workspace: boolean;
  };
  type WsQueryData = { myWorkspaces: { items: WsItem[] } };
  const { data: wsData, refetch: refetchWs } = useQuery<WsQueryData>(MY_WORKSPACES_QUERY, {
    skip: !canAccess,
    fetchPolicy: "network-only",
  });
  const workspaces: WsItem[] = wsData?.myWorkspaces?.items ?? [];

  const [selectWorkspace] = useMutation(SELECT_WORKSPACE_MUTATION);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(t);
  }, [toast]);

  const isWsDeactivated = (status?: string) => {
    const s = String(status || "").toLowerCase();
    return s === "blocked" || s === "deactivated";
  };

  const handleSwitchWorkspace = async (businessId: number) => {
    const ws = workspaces.find((item) => item.business_id === businessId);
    if (isWsDeactivated(ws?.status)) {
      setToast("This business is temporarily deactivated.");
      return;
    }
    setSwitchingId(businessId);
    try {
      await selectWorkspace({ variables: { businessId } });
      switchToBusiness(businessId);
      await apolloClient.clearStore();
      router.replace("/");
    } finally {
      setSwitchingId(null);
      setWsOpen(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/");
  };

  const [search, setSearch] = useState("");
  const [searchDeb, setSearchDeb] = useState("");
  const [filterDisp, setFilterDisp] = useState<"all" | DisplayStatus>("all");
  const [page, setPage] = useState(1);
  const limit = 20;

  useEffect(() => {
    const t = setTimeout(() => setSearchDeb(search.trim()), 280);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => { setPage(1); }, [searchDeb, filterDisp]);

  const listVars = useMemo(() => {
    const input: Record<string, unknown> = { page, limit };
    if (searchDeb) input.search = searchDeb;
    if (filterDisp !== "all") input.status = toFilterValue(filterDisp);
    return { input };
  }, [page, searchDeb, filterDisp]);

  const { data, loading, error, refetch } = useQuery<PlatformBusinessesQueryData>(PLATFORM_BUSINESSES_QUERY, {
    skip: !canAccess,
    variables: listVars,
    fetchPolicy: "network-only",
  });

  const totalsAll = useQuery<PlatformBusinessesQueryData>(PLATFORM_BUSINESSES_QUERY, {
    skip: !canAccess,
    variables: { input: { page: 1, limit: 1 } },
    fetchPolicy: "network-only",
  });
  const totalsActive = useQuery<PlatformBusinessesQueryData>(PLATFORM_BUSINESSES_QUERY, {
    skip: !canAccess,
    variables: { input: { page: 1, limit: 1, status: "active" } },
    fetchPolicy: "network-only",
  });
  const totalsDeactivated = useQuery<PlatformBusinessesQueryData>(PLATFORM_BUSINESSES_QUERY, {
    skip: !canAccess,
    variables: { input: { page: 1, limit: 1, status: "deactivated" } },
    fetchPolicy: "network-only",
  });
  const totals = {
    all: totalsAll.data?.platformBusinesses?.total ?? 0,
    active: totalsActive.data?.platformBusinesses?.total ?? 0,
    deactivated: totalsDeactivated.data?.platformBusinesses?.total ?? 0,
  };

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const detail = useQuery<PlatformBusinessQueryData>(PLATFORM_BUSINESS_QUERY, {
    skip: !canAccess || selectedId == null,
    variables: selectedId != null ? { id: selectedId } : undefined,
    fetchPolicy: "network-only",
  });

  const [activateBusiness,   { loading: activating   }] = useMutation(ACTIVATE_BUSINESS_MUTATION, {
    refetchQueries: [{ query: PLATFORM_BUSINESSES_QUERY, variables: listVars }],
    awaitRefetchQueries: true,
  });
  const [deactivateBusiness, { loading: deactivating }] = useMutation(DEACTIVATE_BUSINESS_MUTATION, {
    refetchQueries: [{ query: PLATFORM_BUSINESSES_QUERY, variables: listVars }],
    awaitRefetchQueries: true,
  });
  const [deleteBusiness, { loading: deleting }] = useMutation(DELETE_BUSINESS_MUTATION, {
    refetchQueries: [{ query: PLATFORM_BUSINESSES_QUERY, variables: listVars }],
    awaitRefetchQueries: true,
  });
  const [extendTrial,        { loading: extending    }] = useMutation(EXTEND_TRIAL_MUTATION, {
    refetchQueries: [{ query: PLATFORM_BUSINESSES_QUERY, variables: listVars }],
    awaitRefetchQueries: true,
  });

  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [mutBusy, setMutBusy] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const refetchAll = async () => {
    await Promise.all([
      refetch(),
      refetchWs(),
      totalsAll.refetch(),
      totalsActive.refetch(),
      totalsDeactivated.refetch(),
      selectedId != null ? detail.refetch() : Promise.resolve(),
    ]);
  };

  const act = async (key: string, fn: () => Promise<unknown>) => {
    if (busyKey) return;
    setBusyKey(key);
    setMutBusy(true);
    try {
      await fn();
      await refetchAll();
    } finally {
      setMutBusy(false);
      setBusyKey(null);
    }
  };

  const items = data?.platformBusinesses?.items ?? [];
  const total = data?.platformBusinesses?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / limit));

  const STAT_CARDS: { label: string; value: number; disp: "all" | DisplayStatus }[] = [
    { label: "Total",       value: totals.all,         disp: "all"         },
    { label: "Active",      value: totals.active,      disp: "active"      },
    { label: "Deactivated", value: totals.deactivated, disp: "deactivated" },
  ];

  if (!ready) return <div className="min-h-dvh bg-[#F5F7FB]" />;
  if (!canAccess) return null;

  return (
    <div className="min-h-dvh bg-[#F5F7FB] text-slate-900">
      <div className="mx-auto max-w-2xl px-4 py-5 pb-10">

        {/* Header */}
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-900">Platform Dashboard</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => { void refetchWs(); setWsOpen(true); }}
              className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm active:scale-[0.98]"
            >
              <Building2 className="h-3 w-3" />
              Workspaces
            </button>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 shadow-sm active:scale-[0.98]"
            >
              <LogOut className="h-3 w-3" />
              Logout
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {STAT_CARDS.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => setFilterDisp(c.disp)}
              className={[
                "rounded-2xl border bg-white p-3 text-left shadow-sm transition active:scale-[0.98]",
                filterDisp === c.disp ? "border-slate-400 ring-1 ring-slate-300" : "border-slate-200",
              ].join(" ")}
            >
              <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{c.label}</div>
              <div className="mt-1.5 text-2xl font-bold tabular-nums text-slate-900">{c.value}</div>
            </button>
          ))}
        </div>

        {/* Filter bar */}
        <div className="mb-3 flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm outline-none focus:border-slate-300"
            />
          </div>
          <select
            value={filterDisp}
            onChange={(e) => setFilterDisp(e.target.value as any)}
            className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 outline-none"
          >
            {DISPLAY_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-[36px] text-center text-xs text-slate-500">{page}/{pages}</span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page >= pages}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-40"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Businesses list */}
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-white p-4 text-sm text-red-600">{error.message}</div>
        ) : loading && items.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Loading…</div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">No businesses found.</div>
        ) : (
          <div className="space-y-2">
            {items.map((b) => (
              <div
                key={b.id}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">{b.name}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{b.businessType || "—"}</div>
                  </div>
                  <StatusBadge raw={b.status} />
                </div>

                <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                  <span className="font-semibold tabular-nums text-slate-900">{b.totalCustomers}</span>
                  <span>clients</span>
                  {b.trialEndsAt ? (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className={daysLeft(b.trialEndsAt) != null && daysLeft(b.trialEndsAt)! <= 3 ? "text-amber-700 font-semibold" : ""}>
                        trial {fmt(b.trialEndsAt)}
                      </span>
                    </>
                  ) : null}
                </div>

                <div className="mt-2.5 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedId(b.id)}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm active:scale-[0.98]"
                  >
                    View
                  </button>
                  <button
                    type="button"
                    disabled={mutBusy || activating || busyKey === `a:${b.id}`}
                    onClick={() => void act(`a:${b.id}`, () => activateBusiness({ variables: { input: { businessId: b.id } } }))}
                    className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-800 active:scale-[0.98] disabled:opacity-50"
                  >
                    {busyKey === `a:${b.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                    {busyKey === `a:${b.id}` ? "Activating" : "Activate"}
                  </button>
                  <button
                    type="button"
                    disabled={mutBusy || deactivating || busyKey === `p:${b.id}`}
                    onClick={() => void act(`p:${b.id}`, () => deactivateBusiness({ variables: { input: { businessId: b.id } } }))}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 active:scale-[0.98] disabled:opacity-50"
                  >
                    {busyKey === `p:${b.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <PauseCircle className="h-3 w-3" />}
                    {busyKey === `p:${b.id}` ? "Pausing" : "Pause"}
                  </button>
                  <button
                    type="button"
                    disabled={mutBusy}
                    onClick={() => setConfirmDelete(b.id)}
                    className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-semibold text-red-700 active:scale-[0.98] disabled:opacity-50"
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 text-right text-xs text-slate-400">{total} total</div>
      </div>

      {/* Delete confirm */}
      {confirmDelete != null ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={() => setConfirmDelete(null)}>
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-semibold text-slate-900">Delete business?</div>
            <div className="mt-1 text-xs text-slate-500">This will permanently delete this business.</div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="flex-1 rounded-xl border border-slate-200 bg-white py-2 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={mutBusy || deleting || busyKey === `d:${confirmDelete}`}
                onClick={() =>
                  void act(`d:${confirmDelete}`, async () => {
                    await deleteBusiness({ variables: { input: { businessId: confirmDelete } } });
                    setConfirmDelete(null);
                  })
                }
                className="flex-1 rounded-xl bg-red-600 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busyKey === `d:${confirmDelete}` ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Delete
                  </span>
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Detail drawer */}
      {selectedId != null ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setSelectedId(null)}>
          <div
            className="w-full max-w-md rounded-t-3xl border border-slate-200 bg-white shadow-xl"
            style={{ maxHeight: "88dvh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
              <span className="text-sm font-semibold">Business detail</span>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="px-4 py-4">
              {detail.loading && !detail.data ? (
                <div className="text-sm text-slate-500">Loading…</div>
              ) : detail.error ? (
                <div className="text-sm text-red-600">{detail.error.message}</div>
              ) : detail.data ? (() => {
                const d = detail.data.platformBusiness;
                const dl = daysLeft(d.trialEndsAt);
                return (
                  <div className="space-y-3">
                    <div className="rounded-2xl bg-[#F5F7FB] p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-base font-semibold text-slate-900">{d.name}</div>
                          <div className="mt-0.5 text-xs text-slate-500">{d.businessType || "—"}</div>
                        </div>
                        <StatusBadge raw={d.status} />
                      </div>
                      {d.trialEndsAt ? (
                        <div className="mt-1.5 flex items-center gap-1 text-xs text-slate-500">
                          <Clock className="h-3 w-3" />
                          Trial ends {fmt(d.trialEndsAt)}
                          {dl != null ? <span className={dl <= 3 ? "font-semibold text-amber-700" : ""}>({dl}d)</span> : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { k: "Clients",    v: d.totalCustomers },
                        { k: "Visits today", v: d.visitsToday   },
                        { k: "Rewards",    v: d.rewardsCount   },
                        { k: "Broadcasts", v: d.broadcastsCount },
                      ].map((m) => (
                        <div key={m.k} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                          <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{m.k}</div>
                          <div className="mt-1 text-xl font-bold tabular-nums">{m.v}</div>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Owner</div>
                      <div className="mt-1.5 text-sm font-semibold text-slate-900">{d.ownerName ?? "—"}</div>
                      {d.ownerTelegramId ? (
                        <div className="mt-0.5 text-xs text-slate-500">TG: {d.ownerTelegramId}</div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        disabled={mutBusy || activating || busyKey === `a:${selectedId}`}
                        onClick={() => void act(`a:${selectedId}`, () => activateBusiness({ variables: { input: { businessId: selectedId } } }))}
                        className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        {busyKey === `a:${selectedId}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        {busyKey === `a:${selectedId}` ? "Activating" : "Activate"}
                      </button>
                      <button
                        type="button"
                        disabled={mutBusy || deactivating || busyKey === `p:${selectedId}`}
                        onClick={() => void act(`p:${selectedId}`, () => deactivateBusiness({ variables: { input: { businessId: selectedId } } }))}
                        className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        {busyKey === `p:${selectedId}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PauseCircle className="h-3.5 w-3.5" />}
                        {busyKey === `p:${selectedId}` ? "Deactivating" : "Deactivate"}
                      </button>
                      <button
                        type="button"
                        disabled={mutBusy || extending || busyKey === `t:${selectedId}`}
                        onClick={() => void act(`t:${selectedId}`, () => extendTrial({ variables: { input: { businessId: selectedId, days: 14 } } }))}
                        className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 disabled:opacity-60"
                      >
                        {busyKey === `t:${selectedId}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TimerReset className="h-3.5 w-3.5" />}
                        {busyKey === `t:${selectedId}` ? "Extending" : "+14d trial"}
                      </button>
                      <button
                        type="button"
                        disabled={mutBusy}
                        onClick={() => { setSelectedId(null); setConfirmDelete(d.id); }}
                        className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-60"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })() : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Workspace switcher modal */}
      {wsOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
          onClick={() => setWsOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl border border-slate-200 bg-white shadow-xl"
            style={{ maxHeight: "70dvh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
              <span className="text-sm font-semibold">Switch workspace</span>
              <button
                type="button"
                onClick={() => setWsOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="px-3 py-3 space-y-1">
              <button
                type="button"
                onClick={() => setWsOpen(false)}
                className="flex w-full items-center gap-3 rounded-2xl bg-slate-900 px-3 py-2.5 text-left text-sm font-semibold text-white"
              >
                <Shield className="h-4 w-4 shrink-0" />
                Platform Dashboard
              </button>
              {workspaces.map((w) => (
                <button
                  key={w.business_id}
                  type="button"
                  disabled={switchingId != null}
                  onClick={() => void handleSwitchWorkspace(w.business_id)}
                  className={[
                    "flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left text-sm font-semibold transition active:scale-[0.98] disabled:opacity-60",
                    isWsDeactivated(w.status) ? "opacity-65" : "",
                    w.is_active_workspace
                      ? "border-slate-300 bg-slate-50 text-slate-900"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                  ].join(" ")}
                >
                  {switchingId === w.business_id ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  ) : (
                    <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
                  )}
                  <span className="min-w-0 truncate">{w.name}</span>
                  <span className="ml-auto shrink-0 text-[10px] font-normal text-slate-400">
                    {isWsDeactivated(w.status) ? "Deactivated" : w.role}
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => { setWsOpen(false); router.push("/create-business"); }}
                className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white px-3 py-2.5 text-left text-sm font-semibold text-slate-500 hover:bg-slate-50 active:scale-[0.98]"
              >
                <Plus className="h-4 w-4 shrink-0" />
                Create new business
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {toast ? (
        <div className="pointer-events-none fixed bottom-5 left-0 right-0 z-[60] flex justify-center px-4">
          <div className="rounded-full bg-black/85 px-4 py-2 text-xs font-semibold text-white shadow-sm">
            {toast}
          </div>
        </div>
      ) : null}
    </div>
  );
}
