"use client";

import { BottomNav } from "@/components/common/bottom-nav";
import { RequireAuth } from "@/components/common/require-auth";
import { MY_CUSTOMERS_QUERY } from "@/graphql/queries/myCustomers.query";
import { useQuery } from "@apollo/client/react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useAuth } from "@/app/providers";

type Customer = {
  id: number;
  name: string;
  phone: string;
  totalVisits: number;
  stampCount: number;
};

type MyCustomersQueryData = {
  myCustomers: Customer[];
};

function ArrowIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Avatar({ name }: { name: string }) {
  const letter = (name?.trim()?.[0] ?? "?").toUpperCase();
  return (
    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gray-200 text-sm font-semibold text-black">
      {letter}
    </div>
  );
}

export default function CustomersPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const { ready, isAuthenticated } = useAuth();
  const { data, loading, error } = useQuery<MyCustomersQueryData>(MY_CUSTOMERS_QUERY, {
    fetchPolicy: "network-only",
    skip: !ready || !isAuthenticated,
  });

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

  const customers = data?.myCustomers ?? [];

  return (
    <RequireAuth>
      <div className="min-h-dvh bg-[#f7f7f8] text-black">
        <div className="mx-auto max-w-md px-4 pb-32 pt-6">
          <div className="flex items-center gap-3 mb-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="h-9 w-9 rounded-full bg-[#00AEEF]/10 flex items-center justify-center active:scale-95"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5 text-[#0077A3]" aria-hidden />
            </button>
            <h1 className="text-xl font-semibold text-[#0F172A]">Customers</h1>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">
              Loading...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">
              Failed to load customers
            </div>
          ) : (
            <>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name or phone"
                className="mt-4 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
              />

              <div className="mt-3 text-xs text-gray-400">Total: {customers.length}</div>

              <div className="mt-4 space-y-2">
                {filtered.length === 0 ? (
                  <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500">
                    No customers yet
                  </div>
                ) : (
                  filtered.map((c) => (
                    <Link
                      key={c.id}
                      href={`/customers/${c.id}`}
                      className="flex min-h-[64px] items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 transition hover:border-gray-300 active:scale-[0.99]"
                    >
                      <Avatar name={c.name} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-base font-semibold text-gray-900">{c.name}</div>
                        <div className="mt-1 text-sm text-gray-500">
                          {c.phone} • {c.totalVisits} visits • {c.stampCount} stamps
                        </div>
                      </div>
                      <ArrowIcon className="h-5 w-5 shrink-0 text-gray-400" />
                    </Link>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        <BottomNav currentKey="users" />
      </div>
    </RequireAuth>
  );
}
