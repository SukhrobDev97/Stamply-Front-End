"use client";

import { BottomNav } from "@/components/common/bottom-nav";
import { RequireAuth } from "@/components/common/require-auth";
import { REDEEM_REWARD_MUTATION } from "@/graphql/mutations/redeemReward.mutation";
import { LIST_MY_REWARDS_QUERY } from "@/graphql/queries/list-my-rewards.query";
import { useAuth } from "@/app/providers";
import { useAppLang } from "@/lib/use-app-lang";
import { useMutation, useQuery } from "@apollo/client/react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

type RewardRow = {
  id: number;
  customerId?: number | null;
  customerName?: string | null;
  status: string;
  issuedAt?: string | null;
  redeemedAt?: string | null;
};

type ListMyRewardsQueryData = {
  listMyRewards: RewardRow[];
};

function isUnlocked(status: string) {
  const s = status.toLowerCase();
  return s === "available";
}

function isRedeemed(status: string) {
  return status.toLowerCase() === "redeemed";
}

function formatListDate(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

function RewardsPageFallback() {
  const { txt } = useAppLang();
  return (
    <div className="min-h-dvh bg-[#f7f7f8] text-black">
      <div className="mx-auto max-w-md px-4 pt-3 pb-32">
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">
          {txt.homeLoading}
        </div>
      </div>
      <BottomNav currentKey="rewards" />
    </div>
  );
}

function RewardsPageInner() {
  const router = useRouter();
  const { txt } = useAppLang();
  const { ready, isAuthenticated } = useAuth();
  const { data, loading, error } = useQuery<ListMyRewardsQueryData>(LIST_MY_REWARDS_QUERY, {
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    notifyOnNetworkStatusChange: true,
    skip: !ready || !isAuthenticated,
  });
  const [redeemReward, { loading: redeeming }] = useMutation<
    { redeemReward: boolean },
    { rewardId: number }
  >(REDEEM_REWARD_MUTATION);
  const [redeemedIds, setRedeemedIds] = useState<Record<number, string>>({});

  const rows = useMemo(() => {
    const next = (data?.listMyRewards ?? []).map((row) => {
      const redeemedAt = redeemedIds[row.id];
      return redeemedAt ? { ...row, status: "REDEEMED", redeemedAt } : row;
    });
    // Show unlocked first, then redeemed; newest first by issuedAt.
    next.sort((a, b) => {
      const sa = isUnlocked(a.status) ? 0 : isRedeemed(a.status) ? 1 : 2;
      const sb = isUnlocked(b.status) ? 0 : isRedeemed(b.status) ? 1 : 2;
      if (sa !== sb) return sa - sb;
      const ta = a.issuedAt ? new Date(a.issuedAt).getTime() : 0;
      const tb = b.issuedAt ? new Date(b.issuedAt).getTime() : 0;
      return tb - ta;
    });
    return next;
  }, [data?.listMyRewards, redeemedIds]);

  const unlockedCount = rows.filter((r) => isUnlocked(r.status)).length;

  const onRedeem = async (rewardId: number) => {
    try {
      const res = await redeemReward({ variables: { rewardId: Number(rewardId) } });
      if (res.data?.redeemReward !== true) return;
      const now = new Date().toISOString();
      setRedeemedIds((prev) => ({ ...prev, [rewardId]: now }));
    } catch {
      // keep simple (no new toasts)
    }
  };

  return (
    <div className="min-h-dvh bg-[#f7f7f8] text-black">
      <div className="mx-auto max-w-md px-4 pt-3 pb-32">
        <div className="flex items-center gap-3 mb-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="h-9 w-9 rounded-full bg-[#00AEEF]/10 flex items-center justify-center active:scale-95"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5 text-[#0077A3]" aria-hidden />
          </button>
          <h1 className="text-xl font-semibold text-[#0F172A]">{txt.homeRewards}</h1>
        </div>

        <div className="mt-4 space-y-2">
          {loading && rows.length > 0 ? (
            <div className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-700">
              {txt.homeLoading}
            </div>
          ) : null}

          {loading && rows.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">
              {txt.homeLoading}
            </div>
          ) : error ? (
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">
              {txt.rewardsFailed}
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">
              {txt.rewardsEmpty}
            </div>
          ) : (
            rows.map((r) => {
              const unlocked = isUnlocked(r.status);
              const redeemed = isRedeemed(r.status);
              const dateLabel = redeemed
                ? formatListDate(r.redeemedAt ?? r.issuedAt)
                : formatListDate(r.issuedAt ?? r.redeemedAt);

              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-3"
                >
                  <div className="min-w-0">
                    <div className="text-base font-semibold text-gray-900">
                      {r.customerName || "Guest"}
                    </div>
                    <div className="text-xs text-gray-400">{dateLabel || "—"}</div>
                  </div>

                  {unlocked ? (
                    <button
                      type="button"
                      disabled={redeeming}
                      onClick={() => void onRedeem(r.id)}
                      className="shrink-0 rounded-xl bg-[#0284C7] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {txt.rewardsRedeem}
                    </button>
                  ) : (
                    <div
                      className={[
                        "shrink-0 text-sm font-semibold",
                        redeemed ? "text-green-600" : "text-yellow-600",
                      ].join(" ")}
                    >
                      {redeemed ? txt.homeRewardRedeemed : txt.homeRewardUnlocked}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="mt-3 text-xs text-gray-400">
          {txt.rewardsPending}: {unlockedCount}
        </div>
      </div>

      <BottomNav currentKey="rewards" />
    </div>
  );
}

export default function RewardsPage() {
  return (
    <Suspense fallback={<RewardsPageFallback />}>
      <RequireAuth>
        <RewardsPageInner />
      </RequireAuth>
    </Suspense>
  );
}
