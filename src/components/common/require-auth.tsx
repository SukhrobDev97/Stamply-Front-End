"use client";

import { useAuth } from "@/app/providers";
import { t } from "@/app/profile/copy";
import { apolloClient } from "@/lib/apollo/client";
import { setStoredLang, STAMPLY_LANG_CHANGED, type AppLang } from "@/lib/lang";
import { CREATE_BUSINESS } from "@/graphql/mutations/createBusiness";
import { PROFILE_QUERY } from "@/graphql/queries/profile.query";
import { MY_WORKSPACES_QUERY } from "@/graphql/queries/myWorkspaces.query";
import { SELECT_WORKSPACE_MUTATION } from "@/graphql/mutations/selectWorkspace.mutation";
import { useMutation, useQuery } from "@apollo/client/react";
import { Building2, MessageCircle, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const BUSINESS_TYPE_SUGGESTIONS = [
  "Cafe",
  "Restaurant",
  "Bakery",
  "Beauty Salon",
  "Gym",
];

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

  const [bizName, setBizName] = useState("");
  const [bizPhone, setBizPhone] = useState("");
  const [bizAddress, setBizAddress] = useState("");
  const [bizType, setBizType] = useState("");
  const [bizTypeTouched, setBizTypeTouched] = useState(false);
  const [registerMsg, setRegisterMsg] = useState<string | null>(null);
  const [createBusiness, { loading: creatingBusiness }] = useMutation(CREATE_BUSINESS);
  const [creating, setCreating] = useState(false);
  const [selectWorkspace] = useMutation(SELECT_WORKSPACE_MUTATION);
  const normalizedBizType = bizType.trim();
  const isBizTypeInvalid = normalizedBizType.length === 0;

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
      // ignore; fall back to existing profile-based flow
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

  // Platform owners have their own auth on /owner; skip PROFILE_QUERY entirely for them.
  // Running PROFILE_QUERY as a platform_owner returns Unauthorized (no business_user record),
  // which would trigger session invalidation and log the owner out.
  const { loading: validating, error: profileError, data: profileData } = useQuery(PROFILE_QUERY, {
    skip: !ready || !token || isPlatformOwner,
    fetchPolicy: "network-only",
  });

  useEffect(() => {
    if (!ready) return;
    if (!token) return;
    if (!profileError) return;
    // Force global session reset (no reload loops).
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
  }, [profileError, ready, token]);

  useEffect(() => {
    if (!ready) return;
    const authedNow = !!token && !profileError && !validating;
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

    setToast(txt.welcomeBackToast);
    const welcomeTimer = window.setTimeout(() => setToast(null), 1400);
    return () => window.clearTimeout(welcomeTimer);
  }, [ready, token, profileError, validating, txt.welcomeBackToast]);

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
                    // Telegram-first: user must login first; backend should ideally not return this anymore.
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

  // Platform owners bypass profile/business validation — they have their own guards.
  if (isPlatformOwner) {
    return <>{children}</>;
  }

  if (validating) {
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

  if (creating) {
    return (
      <div className="min-h-dvh bg-[#f7f7f8] text-black">
        <div className="mx-auto max-w-md px-4 pt-10 pb-32">
          <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="text-sm font-semibold text-gray-900">{txt.registerCreatingTitle}</div>
            <div className="mt-2 text-sm text-gray-500">{txt.registerCreatingSubtitle}</div>
            <div className="mt-4 h-10 rounded-xl bg-gray-100" />
          </div>
        </div>
      </div>
    );
  }

  // If profile failed to load, session invalidation effect will run.
  // Do NOT render app or business form while invalidating.
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

  // While profileData is not present yet, do not render UI.
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

  const business = (profileData as any)?.profile?.business ?? null;
  if (!business) {
    // If user has workspaces but none selected, go to selector instead of onboarding.
    if (token) {
      void bootstrapWorkspaces();
    }
    return (
      <div className="min-h-dvh bg-[#f7f7f8] text-black">
        <div className="mx-auto grid min-h-dvh max-w-md place-items-center px-4 pb-24 pt-6">
          <div className="w-full rounded-[28px] border border-black/5 bg-white p-6 text-center shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] bg-[#00AEEF]/10 text-[#0077A3]">
              <Building2 className="h-7 w-7" aria-hidden />
            </div>
            <div className="mt-4 text-lg font-semibold text-[#0F172A]">{txt.registerTitle}</div>
            <div className="mt-1 text-sm text-gray-500">{txt.registerSubtitle}</div>

            <div className="mt-4 space-y-2 text-left">
              <input
                value={bizName}
                onChange={(e) => setBizName(e.target.value)}
                placeholder={txt.registerBizNamePh}
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
              />
              <input
                value={bizPhone}
                onChange={(e) => setBizPhone(e.target.value)}
                placeholder={txt.registerPhonePh}
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
              />
              <input
                value={bizAddress}
                onChange={(e) => setBizAddress(e.target.value)}
                placeholder={txt.registerAddressPh}
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
              />
              <input
                value={bizType}
                onChange={(e) => setBizType(e.target.value)}
                onBlur={() => setBizTypeTouched(true)}
                placeholder={txt.registerTypePh}
                list="business-type-suggestions-auth"
                className={[
                  "w-full rounded-2xl border bg-white px-4 py-3 text-sm text-black placeholder:text-gray-400 focus:outline-none focus:ring-2",
                  bizTypeTouched && isBizTypeInvalid
                    ? "border-red-300 focus:ring-red-100"
                    : "border-gray-200 focus:ring-gray-300",
                ].join(" ")}
              />
              <datalist id="business-type-suggestions-auth">
                {BUSINESS_TYPE_SUGGESTIONS.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
              {bizTypeTouched && isBizTypeInvalid ? (
                <div className="text-xs font-medium text-red-600">Business type is required.</div>
              ) : null}
            </div>

            {registerMsg ? <div className="mt-3 text-sm text-gray-600">{registerMsg}</div> : null}

            <button
              type="button"
              disabled={creatingBusiness || !bizName.trim() || !bizPhone.trim() || isBizTypeInvalid}
              onClick={() => {
                setRegisterMsg(null);
                setBizTypeTouched(true);
                if (isBizTypeInvalid) {
                  setRegisterMsg("Please enter a valid business type.");
                  return;
                }
                void (async () => {
                  setCreating(true);
                  try {
                    await createBusiness({
                      variables: {
                        input: {
                          name: bizName.trim(),
                          phone: bizPhone.trim(),
                          address: bizAddress.trim() || null,
                          businessType: normalizedBizType.toUpperCase().replace(/\s+/g, "_"),
                        },
                      },
                      refetchQueries: [{ query: PROFILE_QUERY }],
                      awaitRefetchQueries: true,
                    });
                    setRegisterMsg(null);
                  } catch {
                    setRegisterMsg(txt.registerFailed);
                  } finally {
                    setCreating(false);
                  }
                })();
              }}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0284C7] py-3 text-sm font-semibold text-white transition disabled:opacity-50 active:scale-[0.99]"
            >
              {creatingBusiness ? txt.registerCreating : txt.registerCreateBusiness}
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

