"use client";

import { useAppLang } from "@/lib/use-app-lang";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { txt } = useAppLang();

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.error("[stamply-route-error]", error);
    }
  }, [error]);

  return (
    <div className="min-h-dvh bg-[#f7f7f8] text-black">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 pb-24">
        <div className="w-full rounded-2xl border border-black/5 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-[#0F172A]">{txt.errorsPageTitle}</h1>
          <p className="mt-2 text-sm text-gray-600">{txt.errorsPageBody}</p>
          <button
            type="button"
            onClick={() => reset()}
            className="mt-5 w-full rounded-2xl bg-[#0284C7] py-3 text-sm font-semibold text-white"
          >
            {txt.errorsRetry}
          </button>
        </div>
      </div>
    </div>
  );
}
