"use client";

import { useAuth } from "@/app/providers";
import { MessageCircle, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function RequireAuth({
  children,
}: {
  children: React.ReactNode;
}) {
  const { ready, isAuthenticated, loginWithTelegram } = useAuth();
  const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
  const prevAuthedRef = useRef(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    try {
      console.log("TOKEN:", localStorage.getItem("accessToken"));
    } catch {
      // ignore
    }
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    const authedNow = !!isAuthenticated && !!token;
    prevAuthedRef.current = authedNow;
    if (!authedNow) return;

    // Show only once per session (RequireAuth may remount on navigation).
    const key = "stamply_welcome_shown";
    try {
      const alreadyShown = sessionStorage.getItem(key) === "1";
      if (alreadyShown) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // If sessionStorage is blocked, fall back to one-time-per-mount.
      if (prevAuthedRef.current) return;
    }

    setToast("Welcome back 👋");
    const t = window.setTimeout(() => setToast(null), 1400);
    return () => window.clearTimeout(t);
  }, [isAuthenticated, ready, token]);

  if (!ready) {
    return (
      <div className="min-h-dvh bg-[#f7f7f8] text-black">
        <div className="mx-auto max-w-md px-4 pt-10 pb-32">
          <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="h-6 w-40 rounded-lg bg-gray-100" />
            <div className="mt-3 h-10 rounded-xl bg-gray-100" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !token) {
    return (
      <div className="min-h-dvh bg-[#f7f7f8] text-black">
        <div className="mx-auto grid min-h-dvh max-w-md place-items-center px-4 pb-24 pt-6">
          <div className="w-full rounded-[28px] border border-black/5 bg-white p-6 text-center shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] bg-[#00AEEF]/10 text-[#0077A3]">
              <ShieldCheck className="h-7 w-7" aria-hidden />
            </div>

            <div className="mt-4 text-lg font-semibold text-[#0F172A]">Welcome to Stamply</div>
            <div className="mt-1 text-sm text-gray-500">Login to continue</div>

            <button
              type="button"
              onClick={() => void loginWithTelegram()}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0284C7] py-3 text-sm font-semibold text-white transition active:scale-[0.99]"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              Continue with Telegram
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      {toast ? (
        <div className="pointer-events-none fixed left-0 right-0 bottom-[104px] z-50 mx-auto flex max-w-md justify-center px-4">
          <div className="rounded-full bg-black/85 px-4 py-2 text-xs font-semibold text-white shadow-sm">
            {toast}
          </div>
        </div>
      ) : null}
    </>
  );
}

