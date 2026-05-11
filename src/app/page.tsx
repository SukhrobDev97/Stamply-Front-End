"use client";

import { BottomNav } from "@/components/common/bottom-nav";
import { Avatar } from "@/components/common/avatar";
import { RequireAuth } from "@/components/common/require-auth";
import { HomeDashboardSkeleton } from "@/components/home/home-dashboard-skeleton";
import { MY_CUSTOMERS_QUERY } from "@/graphql/queries/myCustomers.query";
import { CUSTOMER_DETAIL_QUERY } from "@/graphql/queries/customerDetail.query";
import { OWNER_DASHBOARD } from "@/graphql/queries/owner-dashboard";
import { PROFILE_QUERY } from "@/graphql/queries/profile.query";
import { MY_WORKSPACES_QUERY } from "@/graphql/queries/myWorkspaces.query";
import { SELECT_WORKSPACE_MUTATION } from "@/graphql/mutations/selectWorkspace.mutation";
import { useAuth } from "@/app/providers";
import { useAppMode } from "@/lib/app-mode";
import { t, type ProfileLang } from "@/app/profile/copy";
import { useOverlayModal } from "@/hooks/use-overlay-modal";
import { setStoredLang, STAMPLY_LANG_CHANGED } from "@/lib/lang";
import { gql } from "@apollo/client";
import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Clock,
  Loader2,
  Minus,
  Plus,
  Shield,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
type PendingVisit = {
  id: number;
  customerId: number;
  visitTime: string;
};

type RecentActivityItem = {
  id: number;
  type?: string | null;
  title: string;
  customer_name?: string | null;
  createdAt: string;
};

type RecentRewardRow = {
  id: number;
  customerId: number;
  issuedAt?: string | null;
};

type RewardRow = {
  id: number;
  customerId: number;
  status: string;
  issuedAt?: string | null;
  redeemedAt?: string | null;
};

type CustomerDetailQueryResult = {
  customerDetail: {
    id: number;
    rewards: { id: number; status: string; issuedAt?: string | null; redeemedAt?: string | null }[];
  };
};

function isUnlockedReward(status: string) {
  return status.toLowerCase() === "available";
}

function isRedeemedReward(status: string) {
  return status.toLowerCase() === "redeemed";
}

type OwnerDashboardStatsData = {
  visitsToday: number;
  todayVisits?: number;
  yesterdayVisits?: number;
  percentChange?: number | null;
  trendDirection?: string | null;
  totalCustomers: number;
  rewardsIssued?: number;
  recentRewards?: RecentRewardRow[];
  pendingCount: number;
  pendingVisits: PendingVisit[];
  recentActivity: RecentActivityItem[];
};

type OwnerDashboardQueryData = {
  ownerDashboardStats: OwnerDashboardStatsData;
};

type ProfileQueryData = {
  profile: {
    avatar_url?: string | null;
    business?: { id: number; name?: string | null; phone?: string | null; address?: string | null; businessType?: string | null } | null;
  } | null;
};

type MyCustomersQueryData = {
  myCustomers: { id: number; name?: string | null; stampCount: number }[];
};

type MyWorkspacesItem = {
  business_id: number;
  name: string;
  business_type: string;
  role: string;
  status: string;
  is_active_workspace: boolean;
};

type MyWorkspacesQueryData = {
  myWorkspaces: {
    active_business_id?: number | null;
    canCreateBusiness: boolean;
    hasPlatformDashboard: boolean;
    items: MyWorkspacesItem[];
  };
};

function isWorkspaceDeactivated(status?: string | null) {
  const s = String(status || "").toLowerCase();
  return s === "blocked" || s === "deactivated";
}

const APPROVE_VISIT_MUTATION = gql`
  mutation ApproveVisit($visitId: Int!) {
    approveVisit(visitId: $visitId) {
      success
      rewardUnlocked
      rewardId
    }
  }
`;

function formatTime(input: string | number | Date) {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function getFirstLetter(value: string) {
  const safe = (value ?? "").trim();
  return safe ? safe[0]!.toUpperCase() : "";
}

function parseCustomerIdFromActivityTitle(title: string) {
  const m = title.match(/Customer\s*#\s*(\d+)/i);
  const id = m?.[1] ? Number(m[1]) : Number.NaN;
  return Number.isFinite(id) ? id : null;
}

function stripCustomerPrefix(title: string) {
  return title
    .replace(/Customer\s*#\s*\d+\s*/i, "")
    .replace(/^[:\-–—>]+/, "")
    .replace(/^\s*(?:→|:|-|–|—)\s*/, "")
    .trim();
}

function formatVisitDeltaPercent(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return "0%";
  const r = Math.round(pct * 100) / 100;
  if (r === 0 || Object.is(r, -0)) return "0%";
  return `${r > 0 ? "+" : ""}${r}%`;
}

function visitTrendDir(stats: OwnerDashboardStatsData | undefined): string {
  return String(stats?.trendDirection ?? "neutral").toLowerCase();
}

function translateActivityDescription(raw: string, txt: (typeof t)[ProfileLang]): string {
  const normalized = raw.trim().replace(/\s+/g, " ");
  const key = normalized.toLowerCase().replace(/[.!…]+$/u, "");
  if (!key) return raw;
  const exact: Record<string, string> = {
    "stamp added": txt.activityStampAdded,
    "stamps added": txt.activityStampsAdded,
    "reward unlocked": txt.activityRewardUnlocked,
    "reward redeemed": txt.activityRewardRedeemed,
    "visit approved": txt.activityVisitApproved,
    "visit recorded": txt.activityVisitRecorded,
    "reward issued": txt.activityRewardIssued,
    "approved visit": txt.activityVisitApproved,
    "pending visit approved": txt.activityVisitApproved,
  };
  if (exact[key]) return exact[key];
  if (key.includes("reward") && key.includes("unlock")) return txt.activityRewardUnlocked;
  if (key.includes("reward") && key.includes("redeem")) return txt.activityRewardRedeemed;
  if (key.includes("stamp")) return txt.activityStampAdded;
  if (key.includes("visit") && key.includes("approv")) return txt.activityVisitApproved;
  return raw;
}

function OwnerHome() {
  const router = useRouter();
  const client = useApolloClient();
  const { ready, role } = useAuth();
  const { mode, switchToBusiness, switchToPlatform } = useAppMode();
  const [clientReady, setClientReady] = useState(false);
  useEffect(() => {
    setClientReady(true);
  }, []);
  const token = useMemo(() => {
    if (!clientReady || typeof window === "undefined") return null;
    try {
      return localStorage.getItem("accessToken");
    } catch {
      return null;
    }
  }, [clientReady]);
  const isPlatformOwner = role === "platform_owner";
  const [pollMs, setPollMs] = useState(5000);

  useEffect(() => {
    const onVis = () => setPollMs(document.visibilityState === "visible" ? 5000 : 0);
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const [lang, setLang] = useState<ProfileLang>("uz");

  useEffect(() => {
    const apply = () => {
      try {
        const v = localStorage.getItem("lang");
        if (v === "ru" || v === "uz") setLang(v);
      } catch {
        // ignore
      }
    };
    apply();
    window.addEventListener(STAMPLY_LANG_CHANGED, apply);
    const onStorage = (e: StorageEvent) => {
      if (e.key === "lang") apply();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(STAMPLY_LANG_CHANGED, apply);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setLangPersist = useCallback((next: ProfileLang) => {
    setStoredLang(next);
  }, []);

  const txt = t[lang];
  const txtRef = useRef(txt);
  txtRef.current = txt;

  useEffect(() => {
    if (!ready) return;
    if (!clientReady) return;
    if (!token) return;
    if (!isPlatformOwner) return;
    if (mode === "business") return;
    router.replace("/owner");
  }, [clientReady, isPlatformOwner, mode, ready, router, token]);

  const { data: profileData } = useQuery<ProfileQueryData>(PROFILE_QUERY, {
    skip: !ready || !token || isPlatformOwner,
    fetchPolicy: "network-only",
  });

  const { data: workspacesData, loading: workspacesLoading, refetch: refetchWorkspaces } = useQuery<MyWorkspacesQueryData>(
    MY_WORKSPACES_QUERY,
    {
      skip: !ready || !token,
      fetchPolicy: "network-only",
    },
  );

  const activeBusinessId =
    (workspacesData?.myWorkspaces?.active_business_id ?? null) ??
    (profileData?.profile?.business?.id ?? null);

  const shouldSkipBusiness = !activeBusinessId;

  const { data, error } = useQuery<OwnerDashboardQueryData>(
    OWNER_DASHBOARD,
    {
    // Business dashboard: only when active workspace is selected.
    skip: !ready || !token || shouldSkipBusiness,
    fetchPolicy: "network-only",
    pollInterval: pollMs,
    notifyOnNetworkStatusChange: true,
  });

  const { data: customersData } = useQuery<MyCustomersQueryData>(
    MY_CUSTOMERS_QUERY,
    {
    skip: shouldSkipBusiness,
    fetchPolicy: "network-only",
    pollInterval: pollMs,
    notifyOnNetworkStatusChange: true,
  });
  const [approveVisit] = useMutation<
    { approveVisit: { success: boolean; rewardUnlocked: boolean; rewardId?: number | null } },
    { visitId: number }
  >(APPROVE_VISIT_MUTATION, {
    onError: (e) => {
      const cur = txtRef.current;
      const msg = e?.message ? `${cur.homeApproveError}: ${e.message}` : cur.homeFailed;
      console.error("approveVisit error:", e);
      setToast(msg);
    },
  });
  const pendingModal = useOverlayModal();
  const activityModal = useOverlayModal();
  const [toast, setToast] = useState<string | null>(null);
  const [approvedIds, setApprovedIds] = useState<number[]>([]);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [successId, setSuccessId] = useState<number | null>(null);

    const stats = data?.ownerDashboardStats;
  const visitDir = visitTrendDir(stats);
  const pendingVisits = (stats?.pendingVisits ?? []).filter((v) => !approvedIds.includes(v.id));
  // Prefer list length so the card matches what the modal shows.
  // (Backend `pendingCount` can lag behind `pendingVisits` in some responses.)
  const pendingCountFromList = pendingVisits.length;
  const pendingCount =
    stats?.pendingCount != null
      ? Math.max(pendingCountFromList, Math.max(0, stats.pendingCount - approvedIds.length))
      : pendingCountFromList;
  const activeWsItem = (workspacesData?.myWorkspaces?.items ?? []).find(
    (w) => w.business_id === activeBusinessId || w.is_active_workspace,
  );
  const businessName = profileData?.profile?.business?.name ?? activeWsItem?.name ?? "";
  const businessPhone = profileData?.profile?.business?.phone ?? "";
  const businessAddress = profileData?.profile?.business?.address ?? "";
  const businessType = profileData?.profile?.business?.businessType ?? activeWsItem?.business_type ?? "";
  const userAvatarUrlRaw = profileData?.profile?.avatar_url ?? null;
  const userAvatarUrl =
    typeof userAvatarUrlRaw === "string" && userAvatarUrlRaw.trim() ? userAvatarUrlRaw.trim() : null;

  const [selectWorkspace] = useMutation(SELECT_WORKSPACE_MUTATION);

  const workspaces = workspacesData?.myWorkspaces?.items ?? [];
  const hasPlatformDashboard = Boolean(workspacesData?.myWorkspaces?.hasPlatformDashboard);
  const canCreateBusiness = Boolean(workspacesData?.myWorkspaces?.canCreateBusiness);

  const workspaceBtnRef = useRef<HTMLButtonElement | null>(null);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [workspacePos, setWorkspacePos] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 16,
    width: 340,
  });

  useEffect(() => {
    if (!workspaceOpen) return;
    const update = () => {
      const el = workspaceBtnRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const top = Math.round(r.bottom + 10);
      const desiredLeft = Math.round(r.left);
      const width = 340;
      const maxLeft = Math.max(16, Math.round(window.innerWidth - width - 16));
      const left = Math.min(Math.max(16, desiredLeft), maxLeft);
      setWorkspacePos({ top, left, width });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [workspaceOpen]);

  const [switchingTo, setSwitchingTo] = useState<number | null>(null);

  const switchWorkspace = async (businessId: number) => {
    if (switchingTo != null) return;
    const ws = workspaces.find((item) => item.business_id === businessId);
    if (isWorkspaceDeactivated(ws?.status)) {
      setToast(txt.workspacesDeactivatedToast);
      return;
    }
    setSwitchingTo(businessId);
    try {
      await selectWorkspace({ variables: { businessId } });
      // Set mode to "business" before navigation so the redirect effect skips /owner.
      switchToBusiness(businessId);
      if (!isPlatformOwner) {
        try { await client.query({ query: PROFILE_QUERY, fetchPolicy: "network-only" }); } catch { /* ignore */ }
      }
      await refetchWorkspaces();
      await Promise.all([
        client.query({ query: OWNER_DASHBOARD, fetchPolicy: "network-only" }).catch(() => null),
        client.query({ query: MY_CUSTOMERS_QUERY, fetchPolicy: "network-only" }).catch(() => null),
      ]);
      setWorkspaceOpen(false);
      router.replace("/");
    } finally {
      setSwitchingTo(null);
    }
  };
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 1500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const recentActivity = stats?.recentActivity ?? [];
  const customerNameById = new Map<number, string>(
    (customersData?.myCustomers ?? []).map((c) => [
      Number(c.id),
      typeof c.name === "string" && c.name.trim() ? c.name : "",
    ]),
  );
  const nameForCustomerId = (id: number) => customerNameById.get(Number(id)) ?? "";

  const [rewardRows, setRewardRows] = useState<RewardRow[]>([]);
  const [rewardsLoading, setRewardsLoading] = useState(false);

  const todayRewardRows = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const startMs = start.getTime();
    return rewardRows.filter((r) => {
      const iso = r.issuedAt ?? r.redeemedAt ?? null;
      if (!iso) return false;
      const t = new Date(iso).getTime();
      return Number.isFinite(t) && t >= startMs;
    });
  }, [rewardRows]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (shouldSkipBusiness) return;
      const ids = (customersData?.myCustomers ?? [])
        .map((c) => Number(c.id))
        .filter((id) => Number.isFinite(id));

      if (ids.length === 0) {
        setRewardRows([]);
        return;
      }

      setRewardsLoading(true);
      try {
        const results = await Promise.all(
          ids.map((customerId) =>
            client.query<CustomerDetailQueryResult>({
              query: CUSTOMER_DETAIL_QUERY,
              variables: { customerId },
              fetchPolicy: "network-only",
            }),
          ),
        );

        if (cancelled) return;

        const next: RewardRow[] = [];
        for (const r of results) {
          const detail = r.data?.customerDetail;
          if (!detail) continue;
          for (const rw of detail.rewards ?? []) {
            next.push({
              id: Number(rw.id),
              customerId: Number(detail.id),
              status: String(rw.status ?? ""),
              issuedAt: rw.issuedAt ?? null,
              redeemedAt: rw.redeemedAt ?? null,
            });
          }
        }

        next.sort((a, b) => {
          const ta = a.issuedAt ? new Date(a.issuedAt).getTime() : 0;
          const tb = b.issuedAt ? new Date(b.issuedAt).getTime() : 0;
          return tb - ta;
        });

        setRewardRows(next);
      } catch {
        if (cancelled) return;
        setRewardRows([]);
      } finally {
        if (!cancelled) setRewardsLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [client, customersData?.myCustomers, shouldSkipBusiness]);

  const workspacesHydrated = clientReady && ready && !!token && !workspacesLoading;
  const showDashboardSkeleton =
    !error &&
    clientReady &&
    ready &&
    !!token &&
    (workspacesLoading || (!shouldSkipBusiness && (!data || customersData == null)));

  const noActiveWorkspace = workspacesHydrated && shouldSkipBusiness;

  // IMPORTANT: Keep these returns after all hooks above (Rules of Hooks).
  if (error) {
    return (
      <div className="p-4 text-sm text-gray-500">
        {txt.homeFailedDashboard}
        {error?.message ? <div className="mt-2 text-xs text-gray-400">{error.message}</div> : null}
      </div>
    );
  }
  const formatActivityPartsFromTitle = (title: string) => {
    const customerId = parseCustomerIdFromActivityTitle(title);
    const name = customerId != null ? nameForCustomerId(customerId) : "";
    const rawAction = stripCustomerPrefix(title);
    const base = rawAction || title;
    const action = translateActivityDescription(base, txt);
    return { name, action };
  };

  const formatActivityParts = (item: RecentActivityItem) => {
    const title = item.title ?? "";
    const apiName = typeof item.customer_name === "string" ? item.customer_name.trim() : "";
    if (apiName && apiName.toLowerCase() !== "guest") {
      let rest = title.trim();
      if (rest.toLowerCase().startsWith(apiName.toLowerCase())) {
        rest = rest.slice(apiName.length).trim().replace(/^[:\-–—,]+/u, "").trim();
      }
      const action = translateActivityDescription(rest || title, txt);
      return { name: apiName, action };
    }
    return formatActivityPartsFromTitle(title);
  };

  const onApprove = async (visitId: number) => {
    if (loadingId === visitId) return;
    setLoadingId(visitId);
    try {
      const res = await approveVisit({
        variables: { visitId: Number(visitId) },
        refetchQueries: [{ query: OWNER_DASHBOARD }, { query: MY_CUSTOMERS_QUERY }],
      });
      if (res.data?.approveVisit?.success !== true) {
        setLoadingId(null);
        setToast(txt.homeFailed);
        return;
      }

      setLoadingId(null);
      setToast(res.data?.approveVisit?.rewardUnlocked ? txt.homeRewardUnlockedToast : txt.homeApproved);
      setSuccessId(visitId);
      if (res.data?.approveVisit?.rewardUnlocked) {
        const rid = res.data.approveVisit.rewardId;
        window.setTimeout(() => {
          router.push(rid != null ? `/rewards?rewardId=${Number(rid)}` : "/rewards");
        }, 250);
      }
      window.setTimeout(() => {
        setApprovedIds((prev) => (prev.includes(visitId) ? prev : [...prev, visitId]));
        setSuccessId(null);
      }, 450);
    } catch {
      setLoadingId(null);
      setToast(txt.homeFailed);
    }
  };

  const langSwitcher = (
    <div className="flex shrink-0 items-center rounded-full border border-gray-200 bg-white p-0.5 text-xs font-semibold">
      <button
        type="button"
        onClick={() => setLangPersist("uz")}
        className={[
          "rounded-full px-3 py-1.5 transition-colors",
          lang === "uz" ? "bg-[#0284C7] text-white shadow-sm" : "text-gray-500",
        ].join(" ")}
      >
        UZ
      </button>
      <button
        type="button"
        onClick={() => setLangPersist("ru")}
        className={[
          "rounded-full px-3 py-1.5 transition-colors",
          lang === "ru" ? "bg-[#0284C7] text-white shadow-sm" : "text-gray-500",
        ].join(" ")}
      >
        RU
      </button>
    </div>
  );

  return (
    <div className="min-h-dvh bg-[#f7f7f8] text-black">
      {showDashboardSkeleton ? (
        <HomeDashboardSkeleton />
      ) : noActiveWorkspace ? (
        <>
          <header className="sticky top-0 z-20 border-b border-gray-200 bg-[#f7f7f8]/80 backdrop-blur">
            <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
              <button
                type="button"
                ref={workspaceBtnRef}
                onClick={() => setWorkspaceOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-[#0F172A] shadow-sm active:scale-[0.99]"
              >
                <Shield className="h-4 w-4 text-gray-600" aria-hidden />
                {txt.homeWorkspacesNav}
              </button>
              {langSwitcher}
            </div>
          </header>
          <div className="mx-auto max-w-md px-4 pt-12 pb-[calc(88px+env(safe-area-inset-bottom,0px)+28px)] text-center">
            {workspaces.length === 0 ? (
              <>
                <p className="text-sm text-gray-600">{txt.homeNoWorkspaceNeedBusiness}</p>
                <Link
                  href="/create-business"
                  className="mt-5 inline-flex items-center justify-center rounded-2xl bg-[#0284C7] px-5 py-3 text-sm font-semibold text-white shadow-sm active:scale-[0.99]"
                >
                  {txt.workspacesCreateBusiness}
                </Link>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-600">{txt.workspacesSubtitle}</p>
                <button
                  type="button"
                  onClick={() => setWorkspaceOpen(true)}
                  className="mt-5 inline-flex w-full max-w-xs items-center justify-center rounded-2xl bg-[#0284C7] px-5 py-3 text-sm font-semibold text-white shadow-sm active:scale-[0.99]"
                >
                  {txt.homeWorkspacePick}
                </button>
              </>
            )}
          </div>
        </>
      ) : (
      <>
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-[#f7f7f8]/80 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Avatar src={userAvatarUrl} fallbackText={businessName || "Business"} size={40} className="text-base" />
            <div className="flex flex-col">
              <button
                type="button"
                ref={workspaceBtnRef}
                onClick={() => setWorkspaceOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 text-lg font-semibold text-[#0F172A] leading-tight active:scale-[0.99]"
              >
                <span className="max-w-[220px] truncate">{businessName || "\u00A0"}</span>
                <ChevronDown className="h-4 w-4 text-gray-400" aria-hidden />
              </button>
              <div className="text-xs text-gray-400">{businessType || "\u00A0"}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">{langSwitcher}</div>
        </div>
      </header>

      <div className="mx-auto max-w-md overflow-visible px-4 pt-5 pb-[calc(88px+env(safe-area-inset-bottom,0px)+28px)] space-y-4">
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => pendingModal.open()}
            className={[
              "relative overflow-hidden rounded-3xl p-4 text-left bg-white",
              "active:scale-95 transition-all duration-200 ease-out",
              "shadow-[0_10px_26px_rgba(17,24,39,0.06)]",
            ].join(" ")}
          >
            {pendingCount > 0 ? (
              <motion.span
                aria-hidden="true"
                className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#F59E0B]/18 blur-2xl"
                animate={{ scale: [1, 1.1, 1], opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 2.8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
              />
            ) : null}

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold tracking-[-0.01em] text-gray-900">
                  {txt.homePending}
                </div>
                <div className="mt-1 text-[11px] font-medium text-gray-400">
                  {txt.homePendingSubtitle}
                </div>
              </div>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#F59E0B]/12 text-[#B45309]">
                <Clock size={18} strokeWidth={2.4} />
              </span>
            </div>

            <div className="mt-3 text-[40px] font-extrabold leading-none tracking-[-0.03em] tabular-nums text-[#D97706]">
              {pendingCount}
            </div>
          </button>

          <Link
            href="/customers"
            className={[
              "rounded-3xl p-4 text-left bg-white",
              "active:scale-95 transition-all duration-200 ease-out",
              "shadow-[0_10px_26px_rgba(17,24,39,0.06)]",
            ].join(" ")}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold tracking-[-0.01em] text-gray-900">
                  {txt.homeCustomers}
                </div>
                <div className="mt-1 text-[11px] font-medium text-gray-400">
                  {txt.homeCustomersSubtitle}
                </div>
              </div>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#3B82F6]/10 text-[#2563EB]">
                <Users size={18} strokeWidth={2.4} />
              </span>
            </div>

            <div className="mt-3 text-[40px] font-extrabold leading-none tracking-[-0.03em] tabular-nums text-[#2563EB]">
              {Number(stats?.totalCustomers ?? 0)}
            </div>
          </Link>
        </div>

        <Link
          href="/visits"
          className={[
            "group relative flex h-[190px] w-full overflow-hidden rounded-[28px] p-5 text-left text-white",
            "active:scale-[0.98] transition-all duration-300 ease-out hover:scale-[1.01]",
            "bg-[linear-gradient(135deg,#A98CFF_0%,#8F7CFF_40%,#7B8DFF_100%)]",
            "shadow-[0_18px_45px_rgba(126,116,255,0.26),0_6px_18px_rgba(126,116,255,0.14)]",
          ].join(" ")}
        >
          <span className="pointer-events-none absolute -left-8 -top-10 h-36 w-36 animate-pulse rounded-full bg-white/25 blur-3xl" />
          <span className="pointer-events-none absolute bottom-0 right-6 h-32 w-32 rounded-full bg-[#C9B9FF]/30 blur-3xl transition-transform duration-700 group-hover:translate-y-[-8px]" />
          <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_22%,rgba(255,255,255,0.34),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0))]" />

          <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/22 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.34)] backdrop-blur-md">
              <TrendingUp size={20} strokeWidth={2.45} />
            </span>
            <span className="mt-4 text-[13px] font-semibold tracking-wide text-white/80">
              {txt.homeVisitsToday}
            </span>
            <span className="mt-1 text-[58px] font-extrabold leading-none tracking-[-0.055em] text-white tabular-nums">
              {Number(stats?.todayVisits ?? stats?.visitsToday ?? 0)}
            </span>
            <span className="mt-3 inline-flex w-fit items-center gap-2 rounded-full bg-white/18 px-3 py-1.5 text-[11px] font-semibold text-white/88 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] backdrop-blur-md">
              <span className="flex shrink-0 items-center text-white">
                {visitDir === "down" ? (
                  <ArrowDown className="h-3.5 w-3.5" strokeWidth={2.6} aria-hidden />
                ) : visitDir === "up" ? (
                  <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.6} aria-hidden />
                ) : (
                  <Minus className="h-3.5 w-3.5" strokeWidth={2.6} aria-hidden />
                )}
              </span>
              <span className="text-[12px] font-extrabold tabular-nums text-white">
                {formatVisitDeltaPercent(stats?.percentChange)}
              </span>
              <span className="h-1 w-1 shrink-0 rounded-full bg-white/55" />
              <span className="leading-none">{txt.homeVsYesterday}</span>
            </span>
          </div>

          <div className="relative z-10 ml-3 flex w-[43%] min-w-[136px] items-center">
            <div className="relative h-[128px] w-full rounded-[24px] bg-white/10 px-2.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-sm">
              <div className="absolute inset-y-4 left-4 w-px bg-white/12" />
              <div className="absolute inset-y-4 left-[36%] w-px bg-white/12" />
              <div className="absolute inset-y-4 left-[66%] w-px bg-white/12" />
              <div className="absolute inset-y-4 right-4 w-px bg-white/12" />
              <svg className="absolute inset-x-1 bottom-2 h-[88px] w-[calc(100%-8px)] overflow-visible" viewBox="0 0 150 90" fill="none" aria-hidden="true">
                <path
                  d="M5 70 C32 42 47 66 72 46 C96 27 116 40 145 19"
                  stroke="rgba(255,255,255,0.22)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  className="animate-pulse blur-sm"
                />
                <path
                  d="M5 70 C32 42 47 66 72 46 C96 27 116 40 145 19"
                  stroke="rgba(255,255,255,0.86)"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
                {[5, 72, 145].map((x, i) => (
                  <circle
                    key={x}
                    cx={x}
                    cy={[70, 46, 19][i]}
                    r="3.2"
                    fill="rgba(255,255,255,0.95)"
                    className="drop-shadow-[0_0_8px_rgba(255,255,255,0.75)]"
                  />
                ))}
              </svg>
            </div>
          </div>
        </Link>

        <div className="flex w-full flex-col">
          {/* Recent Activity — full-width compact feed */}
          <button
            type="button"
            onClick={() => activityModal.open()}
            className={[
              "group relative w-full overflow-hidden rounded-[28px] px-4 pb-4 pt-4 text-left",
              "active:scale-[0.98] transition-all duration-300 ease-out hover:scale-[1.01]",
              "bg-[linear-gradient(135deg,#FFFFFF_0%,#F7F2FF_100%)]",
              "shadow-[0_16px_40px_rgba(130,105,210,0.12),0_5px_18px_rgba(17,24,39,0.05)]",
            ].join(" ")}
          >
            <span className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-[#CBB8FF]/35 blur-3xl" />

            <div className="relative z-10 mb-2.5 flex items-center justify-between gap-2">
              <h2 className="min-w-0 truncate text-[13px] font-bold tracking-[-0.02em] text-gray-950">
                {txt.homeRecentActivity}
              </h2>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EEE6FF]/85 text-[#7665D8]">
                <Activity size={13} strokeWidth={2.3} />
              </span>
            </div>

            <div className="relative z-10">
              <div className="space-y-1.5">
                {recentActivity.length === 0 ? (
                  <div className="rounded-2xl bg-white/60 px-3 py-2 text-xs font-medium text-gray-500">
                    {txt.homeNoActivity}
                  </div>
                ) : (
                  recentActivity.slice(0, 3).map((item, idx) => {
                    const parts = formatActivityParts(item);
                    const initialsSource = parts.name || parts.action || "";
                    const rowKey = `${String(item?.type ?? "visit")}-${String(item?.id)}`;
                    return (
                      <div
                        key={rowKey}
                        className="flex items-center gap-2.5 rounded-2xl bg-white/70 px-2.5 py-1.5 shadow-[0_4px_12px_rgba(118,101,216,0.07),inset_0_1px_0_rgba(255,255,255,0.75)]"
                        style={idx === 2 ? { opacity: 0.5 } : undefined}
                      >
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#B99BFF_0%,#7F79FF_100%)] text-[11px] font-extrabold text-white">
                          {getFirstLetter(initialsSource)}
                        </div>
                        <div className="min-w-0 flex-1">
                          {parts.name ? (
                            <>
                              <p className="truncate text-[12px] font-semibold leading-tight text-gray-900">
                                {parts.name}
                              </p>
                              <p className="truncate text-[10.5px] font-medium leading-tight text-gray-400">
                                {parts.action}
                              </p>
                            </>
                          ) : (
                            <p className="truncate text-[12px] font-semibold leading-tight text-gray-900">
                              {parts.action}
                            </p>
                          )}
                        </div>
                        <span className="flex h-5 shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-[#EDE8F7]/95 px-2 py-0.5 text-[8.5px] font-semibold tabular-nums text-gray-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                          {item?.createdAt ? formatTime(item.createdAt) : ""}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
              {recentActivity.length > 0 && (
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-11"
                  style={{ background: "linear-gradient(to bottom, transparent, rgba(247,242,255,0.95))" }}
                />
              )}
            </div>
          </button>
        </div>
      </div>
      </>
      )}

      <BottomNav currentKey="home" />

      {!showDashboardSkeleton && !noActiveWorkspace && pendingModal.show ? (
        <div
          className={pendingModal.overlayClassName}
          onTransitionEnd={pendingModal.onOverlayTransitionEnd}
        >
          <div
            className={[
              "w-full max-w-sm rounded-xl border border-gray-200 bg-white p-5",
              pendingModal.panelClassName,
              pendingModal.panelOpenClassName,
            ].join(" ")}
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-black">{txt.homePendingRequests}</div>
              <button
                type="button"
                onClick={() => pendingModal.close()}
                className="text-xs font-semibold text-gray-500 hover:text-black"
              >
                {txt.homeClose}
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {pendingVisits.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500">
                  {txt.homeNoPending}
                </div>
              ) : (
                pendingVisits.map((v) => (
                  <div
                    key={v.id}
                    className="rounded-xl border border-gray-200 bg-white px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold text-gray-900">
                          {nameForCustomerId(v.customerId) || txt.userFallback}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          {v.visitTime ? formatTime(v.visitTime) : ""}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={loadingId === v.id}
                        onClick={() => void onApprove(v.id)}
                        className={[
                          "shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition-colors duration-200",
                          successId === v.id
                            ? "bg-emerald-600 text-white"
                            : "bg-black text-white disabled:opacity-70",
                        ].join(" ")}
                      >
                        {loadingId === v.id ? (
                          <span className="flex items-center justify-center gap-1">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            <span className="sr-only">{txt.homeLoadingAria}</span>
                          </span>
                        ) : successId === v.id ? (
                          txt.homeDone
                        ) : (
                          txt.homeApprove
                        )}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {!showDashboardSkeleton && !noActiveWorkspace && activityModal.show ? (
        <div
          className={activityModal.overlayClassName}
          onTransitionEnd={activityModal.onOverlayTransitionEnd}
        >
          <div
            className={[
              "w-full max-w-sm rounded-xl border border-gray-200 bg-white p-5",
              activityModal.panelClassName,
              activityModal.panelOpenClassName,
            ].join(" ")}
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-black">{txt.homeRecentActivity}</div>
              <button
                type="button"
                onClick={() => activityModal.close()}
                className="text-xs font-semibold text-gray-500 hover:text-black"
              >
                {txt.homeClose}
              </button>
            </div>

                <div className="mt-4 max-h-[min(70vh,520px)] space-y-2 overflow-y-auto overscroll-contain pr-1">
              {recentActivity.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500">
                  {txt.homeNoActivity}
                </div>
              ) : (
                recentActivity.map((item) => {
                  const parts = formatActivityParts(item);
                  const letterSource = parts.name || parts.action || "";
                  const rowKey = `${String(item?.type ?? "visit")}-${String(item?.id)}`;
                  return (
                    <div
                      key={rowKey}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-gray-50"
                    >
                      <div className="h-8 w-8 shrink-0 rounded-full bg-[#00AEEF]/10 text-[#00AEEF] flex items-center justify-center text-sm font-semibold">
                        {getFirstLetter(letterSource)}
                      </div>
                      <div className="min-w-0 flex-1">
                        {parts.name ? (
                          <>
                            <p className="truncate text-sm font-semibold text-gray-900">{parts.name}</p>
                            <p className="truncate text-xs text-gray-500">{parts.action}</p>
                          </>
                        ) : (
                          <p className="truncate text-sm font-semibold text-gray-900">{parts.action}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-xs text-gray-400">
                        {item?.createdAt ? formatTime(item.createdAt) : ""}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : null}

      {!showDashboardSkeleton && workspaceOpen ? (
        <>
          <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setWorkspaceOpen(false)} />
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
                  onClick={() => setWorkspaceOpen(false)}
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
                        switchToPlatform();
                        setWorkspaceOpen(false);
                        router.replace("/owner");
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
                    const isDeactivated = isWorkspaceDeactivated(w.status);
                    return (
                      <button
                        key={w.business_id}
                        type="button"
                        disabled={switchingTo != null}
                        onClick={() => void switchWorkspace(Number(w.business_id))}
                        className={[
                          "flex h-[60px] w-full items-center justify-between gap-3 rounded-2xl px-3 text-left transition active:scale-[0.99] disabled:opacity-60",
                          isDeactivated ? "opacity-65" : "",
                          active ? "bg-gray-50 ring-1 ring-gray-200" : "hover:bg-gray-50",
                        ].join(" ")}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-700">
                            {isSwitching
                              ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                              : <span className="text-sm font-bold">{getFirstLetter(w.name)}</span>
                            }
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
                  setWorkspaceOpen(false);
                  router.push("/create-business");
                }}
                className="w-full rounded-xl bg-[linear-gradient(135deg,rgba(2,132,199,0.16)_0%,rgba(15,23,42,0.06)_100%)] px-4 py-3 text-sm font-semibold text-gray-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] hover:bg-[linear-gradient(135deg,rgba(2,132,199,0.20)_0%,rgba(15,23,42,0.08)_100%)] active:scale-[0.99]"
              >
                {`+ ${txt.workspacesCreateBusiness}`}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function Home() {
  return (
    <RequireAuth>
      <OwnerHome />
    </RequireAuth>
  );
}
