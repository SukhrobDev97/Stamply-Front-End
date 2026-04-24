"use client";

import { BottomNav } from "@/components/common/bottom-nav";
import { RequireAuth } from "@/components/common/require-auth";
import { SectionTitle } from "@/components/common/section-title";
import { GIVE_VISIT_MUTATION } from "@/graphql/mutations/giveVisit.mutation";
import { REDEEM_REWARD_MUTATION } from "@/graphql/mutations/redeemReward.mutation";
import { MY_CUSTOMERS_QUERY } from "@/graphql/queries/myCustomers.query";
import { useMutation, useQuery } from "@apollo/client/react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/providers";

type Customer = {
  id: number;
  name: string;
  phone: string;
  totalVisits: number;
  stampCount: number;
};

type RecentItem = {
  id: string;
  title: string;
  createdAt: string;
};

type MyCustomersQueryData = {
  myCustomers: Customer[];
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

function Avatar({ name }: { name: string }) {
  const letter = (name?.trim()?.[0] ?? "?").toUpperCase();
  return (
    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gray-200 text-sm font-semibold text-black">
      {letter}
    </div>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default function VisitsPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [rewardModal, setRewardModal] = useState<{ rewardId: number } | null>(null);
  const [recent, setRecent] = useState<RecentItem[]>([]);

  const { ready, isAuthenticated } = useAuth();
  const { data, loading, error } = useQuery<MyCustomersQueryData>(MY_CUSTOMERS_QUERY, {
    fetchPolicy: "network-only",
    skip: !ready || !isAuthenticated,
  });
  const [giveVisit, { loading: giving }] = useMutation<GiveVisitMutationData>(GIVE_VISIT_MUTATION);
  const [redeemReward, { loading: redeeming }] = useMutation<RedeemRewardMutationData>(
    REDEEM_REWARD_MUTATION,
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1500);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = useMemo(() => {
    if (loading || error) return [];
    const customers = data?.myCustomers ?? [];
    const s = q.trim().toLowerCase();
    if (!s) return customers;
    return customers.filter((c) => {
      return (
        String(c.name ?? "").toLowerCase().includes(s) ||
        String(c.phone ?? "").toLowerCase().includes(s)
      );
    });
  }, [data, error, loading, q]);

  const onGiveStamp = async (c: Customer) => {
    try {
      const res = await giveVisit({
        variables: { customerId: Number(c.id) },
        refetchQueries: [{ query: MY_CUSTOMERS_QUERY }],
      });

      const data = res.data?.giveVisit;
      if (!data?.success) return;

      const now = new Date().toISOString();

      if (data.rewardUnlocked) {
        const rewardId = data.rewardId;
        // Navigate to Rewards immediately when unlocked.
        router.push(rewardId != null ? `/rewards?rewardId=${Number(rewardId)}` : "/rewards");
        setRecent((prev) =>
          [
            {
              id: `${now}:${c.id}`,
              title: `${c.name} → reward unlocked`,
              createdAt: now,
            },
            ...prev,
          ].slice(0, 5),
        );
        return;
      } else {
        setToast("Stamp added");
        setRecent((prev) =>
          [
            {
              id: `${now}:${c.id}`,
              title: `${c.name} → stamp added`,
              createdAt: now,
            },
            ...prev,
          ].slice(0, 5),
        );
      }
    } catch {
      setToast("Failed");
    }
  };

  const handleRedeem = async () => {
    if (!rewardModal) return;
    try {
      const res = await redeemReward({
        variables: { rewardId: rewardModal.rewardId },
        refetchQueries: [{ query: MY_CUSTOMERS_QUERY }],
      });
      if (res.data?.redeemReward !== true) {
        setToast("Failed");
        return;
      }
      setRewardModal(null);
      setToast("Reward given");
    } catch {
      setToast("Failed");
    }
  };

  return (
    <RequireAuth>
      <div className="min-h-dvh bg-[#f7f7f8] text-black">
        <div className="mx-auto max-w-md px-4 pb-32 pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="h-9 w-9 rounded-full bg-[#00AEEF]/10 flex items-center justify-center active:scale-95"
                aria-label="Back"
              >
                <ArrowLeft className="h-5 w-5 text-[#0077A3]" aria-hidden />
              </button>
              <h1 className="text-xl font-semibold text-[#0F172A]">Visits</h1>
            </div>
            {toast ? <div className="text-xs text-gray-400">{toast}</div> : null}
          </div>

          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">
              Loading...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">
              Failed to load visits
            </div>
          ) : (
            <>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search customer"
                className="mt-4 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
              />

              <div className="mt-4 space-y-2">
                {filtered.map((c) => (
                  <div
                    key={c.id}
                    className="flex min-h-[64px] items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3"
                  >
                    <Avatar name={c.name} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base font-semibold text-gray-900">{c.name}</div>
                      <div className="mt-1 text-sm text-gray-500">
                        {c.phone} • {c.totalVisits} visits • {c.stampCount} stamps
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={giving || redeeming}
                      onClick={() => onGiveStamp(c)}
                      className="rounded-xl bg-black px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Give Stamp
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-8">
                <SectionTitle>Recent visits</SectionTitle>
                <div className="space-y-2">
                  {recent.length === 0 ? (
                    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500">
                      No recent visits
                    </div>
                  ) : (
                    recent.slice(0, 5).map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-xs text-black"
                      >
                        <div className="min-w-0 truncate text-sm text-gray-500">{r.title}</div>
                        <div className="shrink-0 text-xs text-gray-400">{formatTime(r.createdAt)}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <BottomNav currentKey="visits" />

        {rewardModal ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-6">
            <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
              <div className="text-lg font-semibold text-black">🎉 Reward unlocked!</div>
              <div className="mt-2 text-sm text-gray-500">Customer reached 8 stamps</div>
              <button
                type="button"
                disabled={redeeming}
                onClick={() => void handleRedeem()}
                className="mt-6 w-full rounded-xl bg-black py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                Give Reward
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </RequireAuth>
  );
}
