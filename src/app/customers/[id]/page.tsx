"use client";

import { BottomNav } from "@/components/common/bottom-nav";
import { RequireAuth } from "@/components/common/require-auth";
import { GIVE_VISIT_MUTATION } from "@/graphql/mutations/giveVisit.mutation";
import { REDEEM_REWARD_MUTATION } from "@/graphql/mutations/redeemReward.mutation";
import { CUSTOMER_DETAIL_QUERY } from "@/graphql/queries/customerDetail.query";
import { useAuth } from "@/app/providers";
import type { ProfileLang } from "@/app/profile/copy";
import { t } from "@/app/profile/copy";
import { useAppLang } from "@/lib/use-app-lang";
import { useMutation, useQuery } from "@apollo/client/react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type VisitRow = {
  id: number;
  customerId: number;
  visitTime: string;
};

type RewardRow = {
  id: number;
  status: string;
  issuedAt?: string | null;
  redeemedAt?: string | null;
};

type CustomerDetailData = {
  id: number;
  name: string;
  phone: string;
  total_visits: number;
  stamp_count: number;
  visits: VisitRow[];
  rewards: RewardRow[];
};

type CustomerDetailQueryResult = {
  customerDetail: CustomerDetailData;
};

type GiveVisitMutationData = {
  giveVisit: {
    success: boolean;
    rewardUnlocked: boolean;
    rewardId?: number | null;
  };
};

type RedeemRewardMutationData = {
  redeemReward: boolean;
};

function formatVisitWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function rewardBadgeLabel(status: string, txt: (typeof t)[ProfileLang]): string {
  const s = status.toLowerCase();
  if (s === "available") return txt.homeRewardUnlocked;
  if (s === "redeemed") return txt.homeRewardRedeemed;
  if (s === "expired") return txt.customerRewardExpired;
  if (s === "cancelled") return txt.customerRewardCancelled;
  return status;
}

function rewardBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "available")
    return "border-emerald-300 bg-emerald-50 text-emerald-700";
  if (s === "redeemed") return "border-gray-200 bg-gray-50 text-gray-500";
  if (s === "expired") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-gray-200 bg-gray-50 text-gray-500";
}

export default function CustomerDetailPage() {
  const router = useRouter();
  const { txt } = useAppLang();
  const params = useParams();
  const rawId = params?.id;
  const idStr = Array.isArray(rawId) ? rawId[0] : rawId;
  const customerId = typeof idStr === "string" ? Number(idStr) : Number.NaN;

  const [toast, setToast] = useState<string | null>(null);
  const [rewardModal, setRewardModal] = useState<{ rewardId: number } | null>(null);

  const { ready, isAuthenticated } = useAuth();
  const { data, loading, error, refetch } = useQuery<CustomerDetailQueryResult>(
    CUSTOMER_DETAIL_QUERY,
    {
      variables: { customerId },
      skip: !ready || !isAuthenticated || !Number.isFinite(customerId) || customerId < 1,
      fetchPolicy: "network-only",
    },
  );

  const [giveVisit, { loading: giving }] = useMutation<GiveVisitMutationData>(GIVE_VISIT_MUTATION);
  const [redeemReward, { loading: redeeming }] = useMutation<RedeemRewardMutationData>(
    REDEEM_REWARD_MUTATION,
  );

  useEffect(() => {
    if (!toast) return;
    const toastTimer = window.setTimeout(() => setToast(null), 1500);
    return () => window.clearTimeout(toastTimer);
  }, [toast]);

  const detail = data?.customerDetail;

  const visitsSorted = useMemo(() => {
    const list = detail?.visits ?? [];
    return [...list].sort((a, b) => {
      const ta = new Date(a.visitTime).getTime();
      const tb = new Date(b.visitTime).getTime();
      return tb - ta;
    });
  }, [detail?.visits]);

  const rewardsSorted = useMemo(() => {
    const list = detail?.rewards ?? [];
    return [...list].sort((a, b) => {
      const ta = a.issuedAt ? new Date(a.issuedAt).getTime() : 0;
      const tb = b.issuedAt ? new Date(b.issuedAt).getTime() : 0;
      return tb - ta;
    });
  }, [detail?.rewards]);

  const handleGiveStamp = async () => {
    if (!Number.isFinite(customerId) || customerId < 1) return;
    try {
      const res = await giveVisit({
        variables: { customerId },
        refetchQueries: [{ query: CUSTOMER_DETAIL_QUERY, variables: { customerId } }],
      });
      const gv = res.data?.giveVisit;
      if (!gv?.success) return;

      if (gv.rewardUnlocked) {
        const rid = gv.rewardId;
        // Navigate to Rewards immediately when unlocked.
        router.push(rid != null ? `/rewards?rewardId=${Number(rid)}` : "/rewards");
        return;
      } else {
        setToast(txt.visitsStampAdded);
      }

      await refetch();
    } catch {
      setToast(txt.homeFailed);
    }
  };

  const handleRedeem = async () => {
    if (!rewardModal) return;
    try {
      const res = await redeemReward({
        variables: { rewardId: rewardModal.rewardId },
        refetchQueries: [{ query: CUSTOMER_DETAIL_QUERY, variables: { customerId } }],
      });
      if (res.data?.redeemReward !== true) {
        setToast(txt.homeFailed);
        return;
      }
      setRewardModal(null);
      setToast(txt.visitsRewardGiven);
      await refetch();
    } catch {
      setToast(txt.homeFailed);
    }
  };

  if (!Number.isFinite(customerId) || customerId < 1) {
    return (
      <div className="min-h-dvh bg-[#f7f7f8] text-black">
        <div className="mx-auto max-w-md px-4 pb-32 pt-8">
          <p className="text-sm text-gray-500">{txt.customerDetailInvalid}</p>
          <Link href="/customers" className="mt-4 inline-block text-sm font-medium text-black">
            {txt.customerDetailBack}
          </Link>
        </div>
        <BottomNav currentKey="users" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-dvh bg-[#f7f7f8] text-black">
        <div className="mx-auto max-w-md px-4 pb-32 pt-8 text-sm text-gray-500">{txt.homeLoading}</div>
        <BottomNav currentKey="users" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="min-h-dvh bg-[#f7f7f8] text-black">
        <div className="mx-auto max-w-md px-4 pb-32 pt-8">
          <p className="text-sm text-gray-500">{txt.customerDetailLoadError}</p>
          <Link href="/customers" className="mt-6 inline-block text-sm font-medium text-black">
            {txt.customerDetailBack}
          </Link>
        </div>
        <BottomNav currentKey="users" />
      </div>
    );
  }

  return (
    <RequireAuth>
    <div className="min-h-dvh overflow-y-auto bg-[#f7f7f8] text-black">
      <div className="mx-auto max-w-md px-4 pb-32 pt-8">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="h-9 w-9 rounded-full bg-[#00AEEF]/10 flex items-center justify-center active:scale-95"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5 text-[#0077A3]" aria-hidden />
            </button>
            <h1 className="text-xl font-semibold text-[#0F172A]">{txt.customerDetailHeading}</h1>
          </div>
          {toast ? <span className="text-xs text-gray-400">{toast}</span> : null}
        </div>

        <header className="mt-6">
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">{detail.name}</h2>
          <p className="mt-3 text-base text-gray-500">{detail.phone}</p>
        </header>

        <div className="mt-10 grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-5">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-400">{txt.visitsTitle}</div>
            <div className="mt-2 text-3xl font-semibold tabular-nums text-gray-900">
              {detail.total_visits}
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-5">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
              {txt.visitsMetaStamps}
            </div>
            <div className="mt-2 text-3xl font-semibold tabular-nums text-gray-900">
              {detail.stamp_count}
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled={giving || redeeming}
          onClick={() => void handleGiveStamp()}
          className="mt-10 w-full rounded-2xl bg-black py-4 text-base font-semibold text-white disabled:opacity-50"
        >
          {txt.visitsGiveStamp}
        </button>

        <section className="mt-14">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">{txt.visitsTitle}</h2>
          <ul className="mt-5 space-y-3">
            {visitsSorted.length === 0 ? (
              <li className="rounded-2xl border border-gray-200 bg-white px-5 py-6 text-sm text-gray-500">
                {txt.customerDetailNoVisits}
              </li>
            ) : (
              visitsSorted.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white px-5 py-4"
                >
                  <span className="text-sm text-gray-900">{txt.visitsStampAdded}</span>
                  <time className="shrink-0 text-sm tabular-nums text-gray-400">
                    {formatVisitWhen(v.visitTime)}
                  </time>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="mt-14">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">{txt.homeRewards}</h2>
          <ul className="mt-5 space-y-3">
            {rewardsSorted.length === 0 ? (
              <li className="rounded-2xl border border-gray-200 bg-white px-5 py-6 text-sm text-gray-500">
                {txt.customerDetailNoRewardsList}
              </li>
            ) : (
              rewardsSorted.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white px-5 py-4"
                >
                  <span className="text-sm text-gray-700">
                    {txt.customerDetailRewardLine}
                    {r.id}
                  </span>
                  <span
                    className={[
                      "shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wide",
                      rewardBadgeClass(r.status),
                    ].join(" ")}
                  >
                    {rewardBadgeLabel(r.status, txt)}
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      <BottomNav currentKey="users" />

      {rewardModal ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-6">
          <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
            <div className="text-lg font-semibold text-gray-900">{txt.visitsModalTitle}</div>
            <div className="mt-2 text-sm text-gray-500">{txt.visitsModalSubtitle}</div>
            <button
              type="button"
              disabled={redeeming}
              onClick={() => void handleRedeem()}
              className="mt-6 w-full rounded-xl bg-black py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {txt.visitsModalButton}
            </button>
          </div>
        </div>
      ) : null}
    </div>
    </RequireAuth>
  );
}
