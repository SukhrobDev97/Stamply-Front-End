"use client";

import { BottomNav } from "@/components/common/bottom-nav";
import { Avatar } from "@/components/common/avatar";
import { RequireAuth, useProfile } from "@/components/common/require-auth";
import { HomeDashboardSkeleton } from "@/components/home/home-dashboard-skeleton";
import { BusinessTrialInactiveScreen } from "@/components/home/business-trial-inactive-screen";
import { OWNER_DASHBOARD } from "@/graphql/queries/owner-dashboard";
import { MY_WORKSPACES_QUERY } from "@/graphql/queries/myWorkspaces.query";
import { SELECT_WORKSPACE_MUTATION } from "@/graphql/mutations/selectWorkspace.mutation";
import { useAuth } from "@/app/providers";
import { useAppMode } from "@/lib/app-mode";
import { switchToBusinessWorkspace } from "@/lib/workspace-switch";
import { t, type ProfileLang } from "@/app/profile/copy";
import { useOverlayModal } from "@/hooks/use-overlay-modal";
import { useAppLang } from "@/lib/use-app-lang";
import { openStamplySupportTelegram } from "@/lib/support-telegram";
import { HomeAnalyticsCard } from "@/components/home/home-analytics-card";
import { HomeWorkspaceOverlay } from "@/components/home/home-workspace-overlay";
import { TrialWarningModalLazy } from "@/components/home/trial-warning-modal-lazy";
import { getTrialWarningState } from "@/lib/trial/get-trial-warning-state";
import {
  dismissTrialWarning,
  isTrialWarningDismissed,
} from "@/lib/trial/trial-warning-dismiss";
import { userMessageFromUnknown } from "@/lib/api";
import {
  isWorkspaceDeactivatedStatus,
  shouldBlockBusinessAccess,
} from "@/lib/business-lifecycle";
import { gql } from "@apollo/client";
import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import { motion } from "framer-motion";
import {
  Activity,
  ChevronDown,
  Clock,
  Loader2,
  Shield,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDocumentVisibility } from "@/hooks/use-document-visibility";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

/** Idle poll while owner watches home (backend dashboard cache TTL ~15–20s). */
const DASHBOARD_POLL_IDLE_MS = 12_000;
/** Faster poll when pending visits exist or modal is open. */
const DASHBOARD_POLL_PENDING_MS = 8_000;
type PendingVisit = {
  id: number;
  customerId: number;
  customerName?: string | null;
  visitTime: string;
};

function subscribeHydration() {
  return () => undefined;
}

function getClientHydrationSnapshot() {
  return true;
}

function getServerHydrationSnapshot() {
  return false;
}

type RecentActivityItem = {
  id: number;
  type?: string | null;
  title: string;
  customer_name?: string | null;
  createdAt: string;
};

type OwnerDashboardStatsData = {
  visitsToday: number;
  todayVisits?: number;
  yesterdayVisits?: number;
  percentChange?: number | null;
  trendDirection?: string | null;
  totalCustomers: number;
  pendingCount: number;
  pendingVisits: PendingVisit[];
  recentActivity: RecentActivityItem[];
};

type OwnerDashboardQueryData = {
  ownerDashboardStats: OwnerDashboardStatsData;
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

function OwnerHome() {
  const router = useRouter();
  const client = useApolloClient();
  const { ready, role } = useAuth();
  const { mode, switchToBusiness, switchToPlatform } = useAppMode();
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
  const isPlatformOwner = role === "platform_owner";
  const documentVisibility = useDocumentVisibility();

  const { lang, txt, setLang: setLangPersist } = useAppLang();
  const txtRef = useRef(txt);
  const langRef = useRef(lang);
  useEffect(() => {
    txtRef.current = txt;
    langRef.current = lang;
  }, [txt, lang]);

  useEffect(() => {
    if (!ready) return;
    if (!clientReady) return;
    if (!token) return;
    if (!isPlatformOwner) return;
    if (mode === "business") return;
    router.replace("/owner");
  }, [clientReady, isPlatformOwner, mode, ready, router, token]);

  const { profileData } = useProfile();

  const { data: workspacesData, loading: workspacesLoading, refetch: refetchWorkspaces } = useQuery<MyWorkspacesQueryData>(
    MY_WORKSPACES_QUERY,
    {
      skip: !ready || !token,
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-first",
    },
  );

  const activeBusinessId =
    (workspacesData?.myWorkspaces?.active_business_id ?? null) ??
    (profileData?.profile?.business?.id ?? null);

  const shouldSkipBusiness = !activeBusinessId;

  const workspaces = useMemo(() => workspacesData?.myWorkspaces?.items ?? [], [workspacesData?.myWorkspaces?.items]);
  const workspaceRowForActiveBusiness = useMemo(() => {
    if (activeBusinessId == null) return undefined;
    return workspaces.find((w) => w.business_id === activeBusinessId);
  }, [workspaces, activeBusinessId]);

  const workspaceAccessBlocked = shouldBlockBusinessAccess({
    workspaceStatus: workspaceRowForActiveBusiness?.status,
    activeBusinessId,
    hasWorkspaceRow: workspaceRowForActiveBusiness != null,
  });

  const dashboardQueryActive =
    ready && !!token && !shouldSkipBusiness && !workspaceAccessBlocked;

  const { data, error, refetch: refetchDashboard } = useQuery<OwnerDashboardQueryData>(
    OWNER_DASHBOARD,
    {
    // Business dashboard: only when active workspace is selected.
    skip: !dashboardQueryActive,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: false,
  });
  const [approveVisit] = useMutation<
    { approveVisit: { success: boolean; rewardUnlocked: boolean; rewardId?: number | null } },
    { visitId: number }
  >(APPROVE_VISIT_MUTATION, {
    onError: (e) => {
      setToast(userMessageFromUnknown(e, langRef.current));
    },
  });
  const pendingModal = useOverlayModal();
  const activityModal = useOverlayModal();
  const trialWarningModal = useOverlayModal();
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

  const hasPendingForPoll = pendingCountFromList > 0 || pendingModal.show;
  const dashboardPollMs =
    !dashboardQueryActive || documentVisibility !== "visible"
      ? 0
      : hasPendingForPoll
        ? DASHBOARD_POLL_PENDING_MS
        : DASHBOARD_POLL_IDLE_MS;

  useEffect(() => {
    if (!dashboardQueryActive || documentVisibility !== "visible") return;
    void refetchDashboard({ fetchPolicy: "network-only" });
  }, [activeBusinessId, dashboardQueryActive, documentVisibility, refetchDashboard]);

  useEffect(() => {
    if (!dashboardQueryActive || dashboardPollMs <= 0) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void refetchDashboard({ fetchPolicy: "network-only" });
    }, dashboardPollMs);
    return () => window.clearInterval(id);
  }, [dashboardPollMs, dashboardQueryActive, refetchDashboard]);

  const [selectWorkspace] = useMutation(SELECT_WORKSPACE_MUTATION);

  const activeWsItem = workspaces.find(
    (w) => w.business_id === activeBusinessId || w.is_active_workspace,
  );
  const businessName = profileData?.profile?.business?.name ?? activeWsItem?.name ?? "";
  const businessType = profileData?.profile?.business?.businessType ?? activeWsItem?.business_type ?? "";
  const userAvatarUrlRaw = profileData?.profile?.avatar_url ?? null;
  const userAvatarUrl =
    typeof userAvatarUrlRaw === "string" && userAvatarUrlRaw.trim() ? userAvatarUrlRaw.trim() : null;
  const hasPlatformDashboard = Boolean(workspacesData?.myWorkspaces?.hasPlatformDashboard);

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
    if (isWorkspaceDeactivatedStatus(ws?.status)) {
      setToast(txt.workspacesDeactivatedToast);
      return;
    }
    setSwitchingTo(businessId);
    try {
      await switchToBusinessWorkspace({
        businessId,
        selectWorkspace,
        switchToBusiness,
        router,
        client,
        refetchWorkspaces,
        refreshDashboard: true,
      });
      setWorkspaceOpen(false);
    } catch (e) {
      setToast(userMessageFromUnknown(e, lang));
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
  const workspacesHydrated = clientReady && ready && !!token && !workspacesLoading;
  const showBusinessInactiveScreen =
    clientReady &&
    ready &&
    !!token &&
    shouldBlockBusinessAccess({
      error,
      workspaceStatus: workspaceRowForActiveBusiness?.status,
      activeBusinessId,
      hasWorkspaceRow: workspaceRowForActiveBusiness != null,
    });
  const showDashboardSkeleton =
    !showBusinessInactiveScreen &&
    !error &&
    clientReady &&
    ready &&
    !!token &&
    (workspacesLoading || (!shouldSkipBusiness && !data));

  const noActiveWorkspace = workspacesHydrated && shouldSkipBusiness;

  const trialWarningKind = getTrialWarningState({
    trialEndsAt: profileData?.profile?.business?.trialEndsAt,
    businessStatus:
      profileData?.profile?.business?.status ?? workspaceRowForActiveBusiness?.status,
  });

  const trialWarningBusinessId =
    activeBusinessId ?? profileData?.profile?.business?.id ?? null;

  const trialWarningAutoOpenKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!trialWarningKind) return;
    if (showBusinessInactiveScreen) return;
    if (showDashboardSkeleton || noActiveWorkspace) return;
    const bid = trialWarningBusinessId;
    if (bid == null) return;
    if (isTrialWarningDismissed(bid, trialWarningKind)) return;

    const openKey = `${bid}:${trialWarningKind}`;
    if (trialWarningAutoOpenKeyRef.current === openKey) return;
    trialWarningAutoOpenKeyRef.current = openKey;
    trialWarningModal.open();
  }, [
    trialWarningBusinessId,
    noActiveWorkspace,
    showBusinessInactiveScreen,
    showDashboardSkeleton,
    trialWarningKind,
    trialWarningModal,
  ]);

  // IMPORTANT: Keep these returns after all hooks above (Rules of Hooks).
  if (
    error &&
    !data &&
    !shouldBlockBusinessAccess({
      error,
      workspaceStatus: workspaceRowForActiveBusiness?.status,
      activeBusinessId,
    })
  ) {
    return (
      <div className="min-h-dvh bg-[#f7f7f8] text-black">
        <div className="mx-auto max-w-md px-4 pt-10 pb-28">
          <div className="rounded-2xl border border-black/5 bg-white p-4 text-sm text-gray-500 shadow-sm">
            {txt.homeFailedDashboard}
            
          </div>
        </div>
        <BottomNav currentKey="home" />
      </div>
    );
  }
  const formatActivityPartsFromTitle = (title: string) => {
    const rawAction = stripCustomerPrefix(title);
    const base = rawAction || title;
    const action = translateActivityDescription(base, txt);
    return { name: "", action };
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
        refetchQueries: [{ query: OWNER_DASHBOARD }],
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
      {showBusinessInactiveScreen ? (
        <>
          <header className="sticky top-0 z-20 border-b border-gray-200 bg-[#f7f7f8]/80 backdrop-blur">
            <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
              <button
                type="button"
                ref={workspaceBtnRef}
                onClick={() => setWorkspaceOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-[#0F172A] shadow-sm active:scale-[0.99]"
              >
                <Shield className="h-4 w-4 text-gray-600" />
                {txt.homeWorkspacesNav}
              </button>
              {langSwitcher}
            </div>
          </header>
          <BusinessTrialInactiveScreen
            txt={txt}
            onCta={openStamplySupportTelegram}
            onRetry={() => {
              void refetchWorkspaces();
              void refetchDashboard();
            }}
            retryLabel={txt.profileRetry}
          />
        </>
      ) : showDashboardSkeleton ? (
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
                className="inline-flex items-center gap-1.5 text-xl font-semibold text-[#0F172A] leading-tight active:scale-[0.99]"
              >
                <span className="max-w-[220px] truncate">{businessName || "\u00A0"}</span>
                <ChevronDown className="h-4 w-4 text-gray-400" aria-hidden />
              </button>
              <div className="text-sm text-gray-400">{businessType || "\u00A0"}</div>
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
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[15px] font-semibold tracking-[-0.01em] text-gray-900">
                  {txt.homePending}
                </div>
                <div className="mt-1 text-[13px] font-medium text-gray-400">
                  {txt.homePendingSubtitle}
                </div>
              </div>
              {pendingCount > 0 ? (
                <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#F59E0B]/24 text-[#92400E]">
                  <motion.span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 rounded-2xl bg-[#F59E0B]/40"
                    animate={{ scale: [1, 1.16, 1], opacity: [0.68, 0.22, 0.68] }}
                    transition={{ duration: 2.35, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                  />
                  <motion.span
                    aria-hidden="true"
                    className="pointer-events-none absolute -inset-1 rounded-[20px] border-2 border-[#F59E0B]/60 shadow-[0_0_14px_rgba(245,158,11,0.34)]"
                    animate={{ scale: [0.96, 1.18, 0.96], opacity: [0, 0.68, 0] }}
                    transition={{ duration: 2.35, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                  />
                  <motion.span
                    className="relative z-10 flex items-center justify-center"
                    animate={{ scale: [1, 1.12, 1], opacity: [0.9, 1, 0.9] }}
                    transition={{ duration: 2.35, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                  >
                    <Clock size={18} strokeWidth={2.4} />
                  </motion.span>
                </span>
              ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#F59E0B]/12 text-[#B45309]">
                  <Clock size={18} strokeWidth={2.4} />
                </span>
              )}
            </div>

            <div className="mt-3 text-[44px] font-extrabold leading-none tracking-[-0.03em] tabular-nums text-[#D97706]">
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
                <div className="text-[15px] font-semibold tracking-[-0.01em] text-gray-900">
                  {txt.homeCustomers}
                </div>
                <div className="mt-1 text-[13px] font-medium text-gray-400">
                  {txt.homeCustomersSubtitle}
                </div>
              </div>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#3B82F6]/10 text-[#2563EB]">
                <Users size={18} strokeWidth={2.4} />
              </span>
            </div>

            <div className="mt-3 text-[44px] font-extrabold leading-none tracking-[-0.03em] tabular-nums text-[#2563EB]">
              {Number(stats?.totalCustomers ?? 0)}
            </div>
          </Link>
        </div>

        <HomeAnalyticsCard active={dashboardQueryActive} txt={txt} lang={lang} />

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
              <h2 className="min-w-0 truncate text-[15px] font-bold tracking-[-0.02em] text-gray-950">
                {txt.homeRecentActivity}
              </h2>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EEE6FF]/85 text-[#7665D8]">
                <Activity size={13} strokeWidth={2.3} />
              </span>
            </div>

            <div className="relative z-10">
              <div className="space-y-1.5">
                {recentActivity.length === 0 ? (
                  <div className="rounded-2xl bg-white/60 px-3 py-2 text-[15px] font-medium text-gray-500">
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
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#B99BFF_0%,#7F79FF_100%)] text-xs font-extrabold text-white">
                          {getFirstLetter(initialsSource)}
                        </div>
                        <div className="min-w-0 flex-1">
                          {parts.name ? (
                            <>
                              <p className="truncate text-[14px] font-semibold leading-tight text-gray-900">
                                {parts.name}
                              </p>
                              <p className="truncate text-[13px] font-medium leading-tight text-gray-400">
                                {parts.action}
                              </p>
                            </>
                          ) : (
                            <p className="truncate text-[14px] font-semibold leading-tight text-gray-900">
                              {parts.action}
                            </p>
                          )}
                        </div>
                        <span className="flex h-5 shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-[#EDE8F7]/95 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-gray-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
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

      {trialWarningKind && !showBusinessInactiveScreen ? (
        <TrialWarningModalLazy
          show={trialWarningModal.show}
          kind={trialWarningKind}
          message={
            trialWarningKind === "today" ? txt.trialWarningToday : txt.trialWarningTomorrow
          }
          payLabel={txt.trialWarningPay}
          continueLabel={txt.trialWarningContinue}
          overlayClassName={trialWarningModal.overlayClassName}
          panelClassName={trialWarningModal.panelClassName}
          panelOpenClassName={trialWarningModal.panelOpenClassName}
          onOverlayTransitionEnd={trialWarningModal.onOverlayTransitionEnd}
          onPay={openStamplySupportTelegram}
          onContinue={() => {
            if (trialWarningBusinessId != null) {
              dismissTrialWarning(trialWarningBusinessId, trialWarningKind);
            }
            trialWarningModal.close();
          }}
        />
      ) : null}

      {!showDashboardSkeleton && !noActiveWorkspace && !showBusinessInactiveScreen && pendingModal.show ? (
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
              <div className="text-base font-semibold text-black">{txt.homePendingRequests}</div>
              <button
                type="button"
                onClick={() => pendingModal.close()}
                className="text-sm font-semibold text-gray-500 hover:text-black"
              >
                {txt.homeClose}
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {pendingVisits.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-[15px] text-gray-500">
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
                        <div className="truncate text-[17px] font-semibold text-gray-900">
                          {v.customerName || txt.userFallback}
                        </div>
                        <div className="mt-1 text-sm text-gray-500">
                          {v.visitTime ? formatTime(v.visitTime) : ""}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={loadingId === v.id}
                        onClick={() => void onApprove(v.id)}
                        className={[
                          "shrink-0 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors duration-200",
                          successId === v.id
                            ? "bg-emerald-600 text-white"
                            : "bg-[#0284C7] text-white disabled:opacity-70",
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

      {!showDashboardSkeleton && !noActiveWorkspace && !showBusinessInactiveScreen && activityModal.show ? (
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
              <div className="text-base font-semibold text-black">{txt.homeRecentActivity}</div>
              <button
                type="button"
                onClick={() => activityModal.close()}
                className="text-sm font-semibold text-gray-500 hover:text-black"
              >
                {txt.homeClose}
              </button>
            </div>

                <div className="mt-4 max-h-[min(70vh,520px)] space-y-2 overflow-y-auto overscroll-contain pr-1">
              {recentActivity.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-[15px] text-gray-500">
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
                            <p className="truncate text-[15px] font-semibold text-gray-900">{parts.name}</p>
                            <p className="truncate text-sm text-gray-500">{parts.action}</p>
                          </>
                        ) : (
                          <p className="truncate text-[15px] font-semibold text-gray-900">{parts.action}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-sm text-gray-400">
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

      {!showDashboardSkeleton ? (
        <HomeWorkspaceOverlay
          open={workspaceOpen}
          txt={txt}
          workspacePos={workspacePos}
          workspaces={workspaces}
          hasPlatformDashboard={hasPlatformDashboard}
          switchingTo={switchingTo}
          switchToPlatform={switchToPlatform}
          router={router}
          onClose={() => setWorkspaceOpen(false)}
          onSwitchWorkspace={(id) => void switchWorkspace(id)}
          getFirstLetter={getFirstLetter}
        />
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
