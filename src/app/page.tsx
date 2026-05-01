"use client";

import { BottomNav } from "@/components/common/bottom-nav";
import { Avatar } from "@/components/common/avatar";
import { PremiumDashboardLoader } from "@/components/common/premium-dashboard-loader";
import { RequireAuth } from "@/components/common/require-auth";
import { MY_CUSTOMERS_QUERY } from "@/graphql/queries/myCustomers.query";
import { CUSTOMER_DETAIL_QUERY } from "@/graphql/queries/customerDetail.query";
import { OWNER_DASHBOARD } from "@/graphql/queries/owner-dashboard";
import { PROFILE_QUERY } from "@/graphql/queries/profile.query";
import { useAuth } from "@/app/providers";
import { t, type ProfileLang } from "@/app/profile/copy";
import { setStoredLang, STAMPLY_LANG_CHANGED } from "@/lib/lang";
import { gql, NetworkStatus } from "@apollo/client";
import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import { motion } from "framer-motion";
import { Activity, Clock, Loader2, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

type PendingVisit = {
  id: number;
  customerId: number;
  visitTime: string;
};

type RecentActivityItem = {
  id: number;
  title: string;
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

type OverlayPhase = "closed" | "enter" | "visible" | "exit";

function useOverlayModal() {
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
  const panelOpenClassName = panelOpen ? "scale-100 opacity-100" : "scale-95 opacity-0";

  return { show, open, close, onOverlayTransitionEnd, overlayClassName, panelClassName, panelOpenClassName };
}

function OwnerHome() {
  const router = useRouter();
  const client = useApolloClient();
  const { ready, role } = useAuth();
  const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
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

  const { data, loading, error, networkStatus: dashboardNetworkStatus } = useQuery<OwnerDashboardQueryData>(
    OWNER_DASHBOARD,
    {
    // Don't block dashboard query on missing role; let backend authorize.
    skip: !ready || !token,
    fetchPolicy: "network-only",
    pollInterval: pollMs,
    notifyOnNetworkStatusChange: true,
  });

  const { data: profileData } = useQuery<ProfileQueryData>(PROFILE_QUERY, {
    skip: !ready || !token,
    fetchPolicy: "network-only",
  });

  const { data: customersData, networkStatus: customersNetworkStatus } = useQuery<MyCustomersQueryData>(
    MY_CUSTOMERS_QUERY,
    {
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
  const qrModal = useOverlayModal();
  const [toast, setToast] = useState<string | null>(null);
  const [approvedIds, setApprovedIds] = useState<number[]>([]);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [successId, setSuccessId] = useState<number | null>(null);

  const stats = data?.ownerDashboardStats;
  const pendingVisits = (stats?.pendingVisits ?? []).filter((v) => !approvedIds.includes(v.id));
  // Prefer list length so the card matches what the modal shows.
  // (Backend `pendingCount` can lag behind `pendingVisits` in some responses.)
  const pendingCountFromList = pendingVisits.length;
  const pendingCount =
    stats?.pendingCount != null
      ? Math.max(pendingCountFromList, Math.max(0, stats.pendingCount - approvedIds.length))
      : pendingCountFromList;
  const businessId = profileData?.profile?.business?.id;
  const businessName = profileData?.profile?.business?.name ?? "";
  const businessPhone = profileData?.profile?.business?.phone ?? "";
  const businessAddress = profileData?.profile?.business?.address ?? "";
  const businessType = profileData?.profile?.business?.businessType ?? "";
  const userAvatarUrlRaw = profileData?.profile?.avatar_url ?? null;
  const userAvatarUrl =
    typeof userAvatarUrlRaw === "string" && userAvatarUrlRaw.trim() ? userAvatarUrlRaw.trim() : null;
  const qrValue =
    businessId != null && Number.isFinite(Number(businessId))
      ? `https://t.me/stamplyBot?start=business_${Number(businessId)}`
      : "https://t.me/stamplyBot";

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 1500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Avoid "automatic loading" flashes during poll/refetch; only block on first load.
  const initialLoading =
    (dashboardNetworkStatus === NetworkStatus.loading && !data) ||
    (customersNetworkStatus === NetworkStatus.loading && !customersData);

  const dashboardBlocking = !ready || initialLoading;
  const showDashboardOverlay = dashboardBlocking && !error;
  const [loadOverlayMounted, setLoadOverlayMounted] = useState(true);
  const [loadOverlayFadeOut, setLoadOverlayFadeOut] = useState(false);

  useEffect(() => {
    if (showDashboardOverlay) {
      setLoadOverlayMounted(true);
      setLoadOverlayFadeOut(false);
      return;
    }
    if (error) {
      setLoadOverlayMounted(false);
      setLoadOverlayFadeOut(false);
      return;
    }
    setLoadOverlayFadeOut(true);
    const t = window.setTimeout(() => {
      setLoadOverlayMounted(false);
      setLoadOverlayFadeOut(false);
    }, 200);
    return () => window.clearTimeout(t);
  }, [showDashboardOverlay, error]);

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
  }, [client, customersData?.myCustomers]);

  // IMPORTANT: Keep these returns after all hooks above (Rules of Hooks).
  if (error) {
    return (
      <div className="p-4 text-sm text-gray-500">
        {txt.homeFailedDashboard}
        {error?.message ? <div className="mt-2 text-xs text-gray-400">{error.message}</div> : null}
      </div>
    );
  }
  const formatActivityParts = (title: string) => {
    const customerId = parseCustomerIdFromActivityTitle(title);
    const name = customerId != null ? nameForCustomerId(customerId) : "";
    const rawAction = stripCustomerPrefix(title);
    const base = rawAction || title;
    const action = translateActivityDescription(base, txt);
    return { name, action };
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

  return (
    <div className="min-h-dvh bg-[#f7f7f8] text-black">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-[#f7f7f8]/80 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Avatar src={userAvatarUrl} fallbackText={businessName || "Business"} size={40} className="text-base" />
            <div className="flex flex-col">
              <div className="text-lg font-semibold text-[#0F172A] leading-tight">
                {businessName || "—"}
              </div>
              <div className="text-xs text-gray-400">{businessType || "—"}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
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
            <button
              type="button"
              onClick={() => qrModal.open()}
              className="px-4 py-2 rounded-full bg-[#0284C7] text-white text-sm font-medium shadow-sm flex items-center gap-2 active:opacity-90"
            >
              QR
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-md overflow-visible px-4 pb-24 pt-5 space-y-4">
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => pendingModal.open()}
            className={[
              "rounded-2xl p-4 flex flex-col gap-2 text-left active:scale-95 transition-all duration-200 ease-out",
              "border shadow-[0_2px_12px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)]",
              pendingCount > 0 ? "bg-white border-red-200" : "bg-white border-black/5",
            ].join(" ")}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-widest uppercase text-gray-400">
                {txt.homePending}
              </span>
              <span className="h-8 w-8 flex items-center justify-center rounded-xl bg-gray-100 text-gray-500">
                🕐
              </span>
            </div>
            <span
              className={[
                "text-4xl font-black tracking-tight leading-none tabular-nums",
                pendingCount > 0 ? "text-red-500" : "text-gray-900",
              ].join(" ")}
            >
              {pendingCount}
            </span>
          </button>

          <Link
            href="/customers"
            className={[
              "rounded-2xl p-4 flex flex-col gap-2 active:scale-95 transition-all duration-200 ease-out",
              "border border-black/5 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)]",
            ].join(" ")}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-widest uppercase text-gray-400">
                {txt.homeCustomers}
              </span>
              <span className="h-8 w-8 flex items-center justify-center rounded-xl bg-gray-100 text-gray-500">
                👥
              </span>
            </div>
            <span className="text-4xl font-black tracking-tight leading-none text-gray-900 tabular-nums">
              {Number(stats?.totalCustomers ?? 0)}
            </span>
          </Link>
        </div>

        <Link
          href="/visits"
          className={[
            "rounded-2xl p-4 flex flex-col gap-2 active:scale-95 transition-all duration-200 ease-out",
            "border border-[#ff7034]/20 bg-[#ff7034] shadow-[0_2px_12px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)]",
          ].join(" ")}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-widest uppercase text-white/90">
              {txt.homeVisitsToday}
            </span>
            <span className="h-8 w-8 flex items-center justify-center rounded-xl bg-white/20 text-white">
              📈
            </span>
          </div>
          <span className="text-4xl font-black tracking-tight leading-none text-white tabular-nums">
            {Number(stats?.visitsToday ?? 0)}
          </span>
        </Link>

        {/* Recent Activity */}
        <button
          type="button"
          onClick={() => activityModal.open()}
          className={[
            "w-full rounded-2xl p-4 text-left active:scale-95 transition-all duration-200 ease-out",
            "border border-black/5 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]",
          ].join(" ")}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-extrabold text-gray-900">{txt.homeRecentActivity}</h2>
            <span className="text-xs font-semibold px-2 py-1 rounded-lg bg-[#00AEEF]/10 text-[#0077A3]">
              {txt.homeToday}
            </span>
          </div>
          {recentActivity.length === 0 ? (
            <div className="text-sm text-gray-500">{txt.homeNoActivity}</div>
          ) : (
            recentActivity.slice(0, 2).map((item) => {
              const parts = formatActivityParts(item?.title ?? "");
              const initialsSource = parts.name || parts.action || "";
              return (
                <div
                  key={String(item?.id)}
                  className="flex items-center gap-3 py-2.5 rounded-xl px-1 active:scale-95 transition-all duration-200 ease-out hover:bg-gray-50"
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 bg-[#00AEEF]/10 text-[#00AEEF] border border-[#00AEEF]/20">
                    {getFirstLetter(initialsSource)}
                  </div>
                  <div className="flex-1 min-w-0">
                    {parts.name ? (
                      <>
                        <p className="text-sm font-semibold truncate text-gray-900">{parts.name}</p>
                        <p className="text-xs text-gray-400">{parts.action}</p>
                      </>
                    ) : (
                      <p className="text-sm font-semibold truncate text-gray-900">{parts.action}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs font-medium text-gray-400">
                      {item?.createdAt ? formatTime(item.createdAt) : ""}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </button>

        {/* Rewards Card */}
        <Link
          href="/rewards"
          className={[
            "mt-3 rounded-2xl p-4 flex flex-col gap-2 active:scale-95 transition-all duration-200 ease-out",
            "border border-[#0284C7]/20 bg-[#0284C7] shadow-[0_2px_12px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)]",
          ].join(" ")}
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold tracking-widest uppercase text-white/90">
                {txt.homeRewards}
              </span>
              <span className="mt-2 block text-4xl font-black tracking-tight leading-none text-white tabular-nums">
                {todayRewardRows.length}
              </span>
              <span className="mt-2 block text-sm text-white/80">{txt.homeToday}</span>
            </div>
            <div className="h-8 w-8 flex items-center justify-center text-white">
              <motion.span
                className="select-none text-4xl leading-none"
                animate={{
                  y: [0, -3, 0],
                  rotate: [0, -4, 4, 0],
                  scale: [1, 1.04, 1],
                }}
                transition={{
                  duration: 1.8,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "easeInOut",
                }}
              >
                🎁
              </motion.span>
            </div>
          </div>

          <div className="border-t border-white/20 mt-3 pt-3">
            {rewardsLoading ? (
              <div className="text-center text-white/70 text-sm">{txt.homeLoadingRewards}</div>
            ) : todayRewardRows.slice(0, 2).length === 0 ? (
              <div className="text-center text-white/70 text-sm">{txt.homeNoRewardsToday}</div>
            ) : (
              <div className="space-y-2">
                {todayRewardRows.slice(0, 2).map((r) => {
                  const redeemed = isRedeemedReward(r.status);
                  const unlocked = isUnlockedReward(r.status);
                  const label = redeemed
                    ? txt.homeRewardRedeemed
                    : unlocked
                      ? txt.homeRewardUnlocked
                      : txt.homeRewardOther;
                  const custName = nameForCustomerId(r.customerId) || txt.userFallback;
                  return (
                  <div key={r.id} className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-semibold text-white">
                        {getFirstLetter(custName)}
                      </div>
                      <div className="truncate text-sm font-semibold text-white">
                        {custName}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-white/20 px-2 py-1 text-xs text-white">
                      {label}
                    </span>
                  </div>
                );})}
              </div>
            )}
          </div>
        </Link>
      </div>

      <BottomNav currentKey="home" />

      {pendingModal.show ? (
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

      {activityModal.show ? (
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

            <div className="mt-4 space-y-2">
              {recentActivity.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500">
                  {txt.homeNoActivity}
                </div>
              ) : (
                recentActivity.map((item) => {
                  const parts = formatActivityParts(item?.title ?? "");
                  const letterSource = parts.name || parts.action || "";
                  return (
                    <div
                      key={String(item?.id)}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-gray-50"
                    >
                      <div className="h-8 w-8 shrink-0 rounded-full bg-[#00AEEF]/10 text-[#00AEEF] flex items-center justify-center text-sm font-semibold">
                        {getFirstLetter(letterSource)}
                      </div>
                      <div className="min-w-0 flex-1">
                        {parts.name ? (
                          <div className="truncate text-sm text-gray-500">
                            <span className="font-semibold text-gray-900">{parts.name}</span>{" "}
                            <span className="text-gray-500">{parts.action}</span>
                          </div>
                        ) : (
                          <div className="truncate text-sm text-gray-500">
                            <span className="font-semibold text-gray-900">{parts.action}</span>
                          </div>
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

      {qrModal.show ? (
        <div
          className={qrModal.overlayClassName}
          onTransitionEnd={qrModal.onOverlayTransitionEnd}
        >
          <div
            className={[
              "w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 text-center",
              qrModal.panelClassName,
              qrModal.panelOpenClassName,
            ].join(" ")}
          >
            <h2 className="mb-4 text-sm font-semibold text-black">{txt.homeScanQr}</h2>

            <div id="qr" className="flex justify-center">
              <QRCodeCanvas value={qrValue} size={200} />
            </div>

            <button
              type="button"
              onClick={() => {
                const canvas = document.getElementById("qr")?.querySelector("canvas");
                const url = canvas ? (canvas as HTMLCanvasElement).toDataURL() : null;
                if (!url) return;
                const a = document.createElement("a");
                a.href = url;
                a.download = "qr.png";
                a.click();
              }}
              className="mt-4 w-full rounded-xl bg-black py-3 text-sm font-semibold text-white"
            >
              {txt.homeDownload}
            </button>

            <button
              type="button"
              onClick={() => qrModal.close()}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-black"
            >
              {txt.homeClose}
            </button>
          </div>
        </div>
      ) : null}

      {loadOverlayMounted ? (
        <PremiumDashboardLoader fading={loadOverlayFadeOut} hint={txt.homeDashboardLoadHint} />
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
