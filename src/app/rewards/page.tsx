"use client";

import { BottomNav } from "@/components/common/bottom-nav";
import { RequireAuth } from "@/components/common/require-auth";
import { REDEEM_REWARD_MUTATION } from "@/graphql/mutations/redeemReward.mutation";
import { CUSTOMER_DETAIL_QUERY } from "@/graphql/queries/customerDetail.query";
import { MY_CUSTOMERS_QUERY } from "@/graphql/queries/myCustomers.query";
import { useAuth } from "@/app/providers";
import { useAppLang } from "@/lib/use-app-lang";
import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

type Customer = {
  id: number;
  name?: string | null;
  stampCount: number;
};

type MyCustomersQueryData = {
  myCustomers: Customer[];
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
  const client = useApolloClient();
  const { ready, isAuthenticated } = useAuth();
  const { data, loading, error } = useQuery<MyCustomersQueryData>(MY_CUSTOMERS_QUERY, {
    fetchPolicy: "network-only",
    skip: !ready || !isAuthenticated,
  });
  const [redeemReward, { loading: redeeming }] = useMutation<
    { redeemReward: boolean },
    { rewardId: number }
  >(REDEEM_REWARD_MUTATION);

  const customerNameById = useMemo(() => {
    return new Map<number, string>(
      (data?.myCustomers ?? []).map((c) => [
        Number(c.id),
        typeof c.name === "string" && c.name.trim() ? c.name : "Guest",
      ]),
    );
  }, [data?.myCustomers]);
  const nameForCustomerId = (id: number) => customerNameById.get(Number(id)) ?? "Guest";

  // Don't filter by `stampCount >= 8` here:
  // after issuing a reward, many backends reset stamp count, which would hide rewards entirely.
  const customerIds = useMemo(() => {
    return (data?.myCustomers ?? [])
      .map((c) => Number(c.id))
      .filter((id) => Number.isFinite(id));
  }, [data?.myCustomers]);

  const [rows, setRows] = useState<RewardRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (customerIds.length === 0) {
        setRows([]);
        return;
      }
      setRowsLoading(true);
      try {
        const results = await Promise.all(
          customerIds.map((customerId) =>
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
          const rewards = detail?.rewards ?? [];
          for (const rw of rewards) {
            next.push({
              id: Number(rw.id),
              customerId: Number(detail.id),
              status: String(rw.status ?? ""),
              issuedAt: rw.issuedAt ?? null,
              redeemedAt: rw.redeemedAt ?? null,
            });
          }
        }

        // Show unlocked first, then redeemed; newest first by issuedAt.
        next.sort((a, b) => {
          const sa = isUnlocked(a.status) ? 0 : isRedeemed(a.status) ? 1 : 2;
          const sb = isUnlocked(b.status) ? 0 : isRedeemed(b.status) ? 1 : 2;
          if (sa !== sb) return sa - sb;
          const ta = a.issuedAt ? new Date(a.issuedAt).getTime() : 0;
          const tb = b.issuedAt ? new Date(b.issuedAt).getTime() : 0;
          return tb - ta;
        });

        setRows(next);
      } catch {
        if (cancelled) return;
        setRows([]);
      } finally {
        if (!cancelled) setRowsLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [client, customerIds]);

  const unlockedCount = rows.filter((r) => isUnlocked(r.status)).length;

  const onRedeem = async (rewardId: number) => {
    try {
      const res = await redeemReward({ variables: { rewardId: Number(rewardId) } });
      if (res.data?.redeemReward !== true) return;
      const now = new Date().toISOString();
      setRows((prev) =>
        prev.map((r) =>
          r.id === rewardId ? { ...r, status: "REDEEMED", redeemedAt: now } : r,
        ),
      );
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
          {loading || rowsLoading ? (
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
                      {nameForCustomerId(r.customerId)}
                    </div>
                    <div className="text-xs text-gray-400">{dateLabel || "—"}</div>
                  </div>

                  {unlocked ? (
                    <button
                      type="button"
                      disabled={redeeming}
                      onClick={() => void onRedeem(r.id)}
                      className="shrink-0 rounded-xl bg-black px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
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
