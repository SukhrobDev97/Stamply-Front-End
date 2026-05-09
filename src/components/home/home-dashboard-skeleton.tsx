"use client";

/**
 * Layout-matched skeleton for home dashboard initial load.
 * Dimensions mirror OwnerHome to prevent CLS when real content mounts.
 */
export function HomeDashboardSkeleton() {
  return (
    <div
      className="animate-pulse motion-reduce:animate-none"
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading dashboard"
    >
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-[#f7f7f8]/80 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-full bg-gray-200/90" />
            <div className="flex flex-col gap-2">
              <div className="h-5 w-40 rounded-lg bg-gray-200/90" />
              <div className="h-3 w-24 rounded-md bg-gray-200/70" />
            </div>
          </div>
          <div className="h-8 w-[88px] shrink-0 rounded-full bg-gray-200/80" />
        </div>
      </header>

      <div className="mx-auto max-w-md overflow-visible px-4 pt-5 pb-[calc(88px+env(safe-area-inset-bottom,0px)+28px)] space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-3xl bg-white p-4 shadow-[0_10px_26px_rgba(17,24,39,0.06)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3.5 w-24 rounded-md bg-gray-200/90" />
                <div className="h-3 w-32 rounded-md bg-gray-200/60" />
              </div>
              <div className="h-9 w-9 shrink-0 rounded-2xl bg-gray-200/80" />
            </div>
            <div className="mt-3 h-10 w-14 rounded-lg bg-gray-200/85" />
          </div>
          <div className="rounded-3xl bg-white p-4 shadow-[0_10px_26px_rgba(17,24,39,0.06)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3.5 w-28 rounded-md bg-gray-200/90" />
                <div className="h-3 w-36 rounded-md bg-gray-200/60" />
              </div>
              <div className="h-9 w-9 shrink-0 rounded-2xl bg-gray-200/80" />
            </div>
            <div className="mt-3 h-10 w-14 rounded-lg bg-gray-200/85" />
          </div>
        </div>

        <div className="h-[190px] w-full rounded-[28px] bg-gradient-to-br from-gray-200/90 via-gray-200/70 to-gray-200/80 shadow-[0_18px_45px_rgba(17,24,39,0.08)]" />

        <div className="w-full rounded-[28px] bg-white px-4 pb-4 pt-4 shadow-[0_16px_40px_rgba(130,105,210,0.08)]">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <div className="h-4 w-36 rounded-md bg-gray-200/90" />
            <div className="h-7 w-7 shrink-0 rounded-full bg-gray-200/80" />
          </div>
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 rounded-2xl bg-gray-100/80 px-2.5 py-2"
              >
                <div className="h-8 w-8 shrink-0 rounded-full bg-gray-200/90" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="h-3 w-[55%] rounded-md bg-gray-200/85" />
                  <div className="h-2.5 w-[40%] rounded-md bg-gray-200/65" />
                </div>
                <div className="h-5 w-10 shrink-0 rounded-full bg-gray-200/75" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
