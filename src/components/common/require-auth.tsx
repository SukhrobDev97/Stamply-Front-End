"use client";

import { useAuth } from "@/app/providers";
import { t } from "@/app/profile/copy";
import { apolloClient } from "@/lib/apollo/client";
import { setStoredLang, STAMPLY_LANG_CHANGED, type AppLang } from "@/lib/lang";
import { PROFILE_QUERY } from "@/graphql/queries/profile.query";
import { MY_WORKSPACES_QUERY } from "@/graphql/queries/myWorkspaces.query";
import { SELECT_WORKSPACE_MUTATION } from "@/graphql/mutations/selectWorkspace.mutation";
import {
  shouldDestroySessionForProfileError,
} from "@/lib/auth-session-guard";
import { useMutation, useQuery } from "@apollo/client/react";
import { MessageCircle, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function RequireAuth({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { ready, loginWithTelegram, role } = useAuth();
  const isPlatformOwner = role === "platform_owner";
  const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
  const prevAuthedRef = useRef(false);
  const [toast, setToast] = useState<string | null>(null);
  const [loginMsg, setLoginMsg] = useState<string | null>(null);
  const [lang, setLang] = useState<AppLang>("uz");
  const [selectWorkspace] = useMutation(SELECT_WORKSPACE_MUTATION);

  const bootstrapWorkspaces = async () => {
    try {
      const res = await apolloClient.query({
        query: MY_WORKSPACES_QUERY,
        fetchPolicy: "network-only",
      });
      const payload = (res.data as any)?.myWorkspaces as
        | { items?: any[]; hasPlatformDashboard?: boolean }
        | undefined;
      const items = Array.isArray(payload?.items) ? payload!.items : [];
      const hasPlatform = Boolean(payload?.hasPlatformDashboard);
      if (items.length === 0) return;
      if (hasPlatform || items.length > 1) {
        router.replace("/workspaces");
        return;
      }
      const only = items[0];
      const bid = Number(only?.business_id);
      if (Number.isFinite(bid) && bid > 0) {
        await selectWorkspace({ variables: { businessId: bid } });
        try {
          await apolloClient.query({ query: PROFILE_QUERY, fetchPolicy: "network-only" });
        } catch {
          // ignore
        }
        router.replace("/");
      }
    } catch {
      // ignore
    }
  };

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

  const txt = t[lang];

  const { loading: validating, error: profileError, data: profileData } = useQuery(PROFILE_QUERY, {
    skip: !ready || !token || isPlatformOwner,
    fetchPolicy: "network-only",
  });

  const fatalProfile = Boolean(
    profileError && shouldDestroySessionForProfileError(profileError as unknown),
  );

  useEffect(() => {
    if (!ready) return;
    if (!token) return;
    if (!profileError) return;
    if (!fatalProfile) return;
    try {
      localStorage.removeItem("accessToken");
    } catch {
      // ignore
    }
    void apolloClient.clearStore();
    try {
      window.dispatchEvent(new Event("stamply:session-invalidated"));
    } catch {
      // ignore
    }
  }, [fatalProfile, profileError, ready, token]);

  useEffect(() => {
    if (!ready) return;
    if (!token || isPlatformOwner) return;
    const noBiz =
      profileData != null && !(profileData as { profile?: { business?: unknown } })?.profile?.business;
    const recoverErr = Boolean(
      profileError && !shouldDestroySessionForProfileError(profileError as unknown),
    );
    if (!noBiz && !recoverErr) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await apolloClient.query({
          query: MY_WORKSPACES_QUERY,
          fetchPolicy: "network-only",
        });
        if (cancelled) return;
        const items = Array.isArray((res.data as { myWorkspaces?: { items?: unknown[] } })?.myWorkspaces?.items)
          ? ((res.data as { myWorkspaces: { items: unknown[] } }).myWorkspaces.items)
          : [];
        if (items.length > 0) router.replace("/workspaces");
        else router.replace("/create-business");
      } catch {
        if (!cancelled) router.replace("/create-business");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isPlatformOwner, profileData, profileError, ready, router, token]);

  useEffect(() => {
    if (!ready) return;
    const authedNow =
      !!token &&
      !fatalProfile &&
      !validating &&
      Boolean((profileData as { profile?: { business?: unknown } } | undefined)?.profile?.business);
    prevAuthedRef.current = authedNow;
    if (!authedNow) return;

    const key = "stamply_welcome_shown";
    try {
      const alreadyShown = sessionStorage.getItem(key) === "1";
      if (alreadyShown) return;
      sessionStorage.setItem(key, "1");
    } catch {
      if (prevAuthedRef.current) return;
    }

    setToast(txt.welcomeBackToast);
    const welcomeTimer = window.setTimeout(() => setToast(null), 1400);
    return () => window.clearTimeout(welcomeTimer);
  }, [fatalProfile, profileData, ready, token, validating, txt.welcomeBackToast]);

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

  if (!token) {
    return (
      <div className="min-h-dvh bg-[#f7f7f8] text-black">
        <div className="mx-auto min-h-dvh max-w-md px-4 pb-24 pt-6">
          <div className="mb-6 flex items-center justify-end">
            <div className="flex shrink-0 items-center rounded-full border border-gray-200 bg-white p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setStoredLang("uz")}
                className={[
                  "rounded-full px-3 py-1.5 transition-colors",
                  lang === "uz" ? "bg-[#0284C7] text-white shadow-sm" : "text-gray-500",
                ].join(" ")}
              >
                UZ
              </button>
              <button
                type="button"
                onClick={() => setStoredLang("ru")}
                className={[
                  "rounded-full px-3 py-1.5 transition-colors",
                  lang === "ru" ? "bg-[#0284C7] text-white shadow-sm" : "text-gray-500",
                ].join(" ")}
              >
                RU
              </button>
            </div>
          </div>

          <div className="grid place-items-center">
          <div className="w-full rounded-[28px] border border-black/5 bg-white p-6 text-center shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] bg-[#00AEEF]/10 text-[#0077A3]">
              <ShieldCheck className="h-7 w-7" aria-hidden />
            </div>

            <div className="mt-4 text-lg font-semibold text-[#0F172A]">{txt.loginWelcomeTitle}</div>
            <div className="mt-1 text-sm text-gray-500">{txt.loginSubtitle}</div>

            {loginMsg ? <div className="mt-4 text-sm text-gray-600">{loginMsg}</div> : null}

            <button
              type="button"
              onClick={() => {
                setLoginMsg(null);
                void (async () => {
                  const res = await loginWithTelegram();
                  if (res.ok) {
                    await bootstrapWorkspaces();
                    return;
                  }
                  if (res.reason === "OPEN_IN_TELEGRAM") {
                    setLoginMsg(txt.loginOpenInTelegram);
                    return;
                  }
                  if (res.reason === "USER_NOT_REGISTERED") {
                    setLoginMsg(txt.loginFailed);
                    return;
                  }
                  setLoginMsg(txt.loginFailed);
                })();
              }}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0284C7] py-3.5 text-sm font-semibold text-white transition active:scale-[0.99]"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              {txt.loginContinueTelegram}
            </button>

            <div className="mt-4 text-xs text-gray-400">{txt.loginTermsNote}</div>
          </div>
          </div>

        </div>
      </div>
    );
  }

  if (isPlatformOwner) {
    return <>{children}</>;
  }

  if (validating && !profileError) {
    return (
      <div className="min-h-dvh bg-[#f7f7f8] text-black">
        <div className="mx-auto max-w-md px-4 pt-10 pb-32">
          <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="h-6 w-48 rounded-lg bg-gray-100" />
            <div className="mt-3 h-10 rounded-xl bg-gray-100" />
          </div>
        </div>
      </div>
    );
  }

  if (fatalProfile) {
    return (
      <div className="min-h-dvh bg-[#f7f7f8] text-black">
        <div className="mx-auto max-w-md px-4 pt-10 pb-32">
          <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="h-6 w-48 rounded-lg bg-gray-100" />
            <div className="mt-3 h-10 rounded-xl bg-gray-100" />
          </div>
        </div>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="min-h-dvh bg-[#f7f7f8] text-black">
        <div className="mx-auto max-w-md px-4 pt-10 pb-32">
          <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="h-6 w-48 rounded-lg bg-gray-100" />
            <div className="mt-3 h-10 rounded-xl bg-gray-100" />
          </div>
        </div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="min-h-dvh bg-[#f7f7f8] text-black">
        <div className="mx-auto max-w-md px-4 pt-10 pb-32">
          <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="h-6 w-48 rounded-lg bg-gray-100" />
            <div className="mt-3 h-10 rounded-xl bg-gray-100" />
          </div>
        </div>
      </div>
    );
  }

  if (!(profileData as { profile?: { business?: unknown } }).profile?.business) {
    return (
      <div className="min-h-dvh bg-[#f7f7f8] text-black">
        <div className="mx-auto max-w-md px-4 pt-10 pb-32">
          <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="h-6 w-48 rounded-lg bg-gray-100" />
            <div className="mt-3 h-10 rounded-xl bg-gray-100" />
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
