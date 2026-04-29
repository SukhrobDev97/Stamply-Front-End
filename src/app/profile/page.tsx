"use client";

import { BottomNav } from "@/components/common/bottom-nav";
import { Avatar } from "@/components/common/avatar";
import { RequireAuth } from "@/components/common/require-auth";
import { CREATE_STAFF_INVITE_MUTATION } from "@/graphql/mutations/createStaffInvite.mutation";
import { PROFILE_QUERY } from "@/graphql/queries/profile.query";
import { useAuth } from "@/app/providers";
import { useQuery } from "@apollo/client/react";
import { useMutation } from "@apollo/client/react";
import { ArrowLeft, ChevronRight, Globe, HelpCircle, LogOut, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type ProfileData = {
  profile: {
    role?: string | null;
    name?: string | null;
    avatar_url?: string | null;
    business?: {
      id: number;
      name?: string | null;
      phone?: string | null;
      address?: string | null;
    } | null;
  } | null;
};

function getFirstLetter(value: string) {
  const safe = (value ?? "").trim();
  return safe ? safe[0]!.toUpperCase() : "U";
}

function RoleBadge({ role }: { role: string }) {
  const r = role.toLowerCase();
  const label = r === "owner" ? "Owner" : r === "staff" ? "Staff" : role;
  return (
    <span className="inline-flex items-center rounded-full bg-[#00AEEF]/10 px-2 py-1 text-xs font-semibold text-[#0077A3]">
      {label}
    </span>
  );
}

function SettingsRow({
  icon,
  label,
  value,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left active:scale-[0.99] transition-all duration-200 hover:bg-gray-50"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-600">
          {icon}
        </div>
        <div className="text-sm font-semibold text-gray-900">{label}</div>
      </div>
      <div className="flex items-center gap-2">
        {value ? <span className="text-xs font-semibold text-gray-400">{value}</span> : null}
        <ChevronRight className="h-4 w-4 text-gray-400" aria-hidden />
      </div>
    </button>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { ready, isAuthenticated, logout } = useAuth();
  const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
  const { data, loading, error } = useQuery<ProfileData>(PROFILE_QUERY, {
    skip: !ready || !isAuthenticated || !token,
    fetchPolicy: "network-only",
  });
  const [toast, setToast] = useState<string | null>(null);
  const [createInvite, { loading: inviteLoading }] = useMutation<{
    createStaffInvite?: { inviteUrl?: string | null } | null;
  }>(CREATE_STAFF_INVITE_MUTATION);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 1600);
    return () => window.clearTimeout(t);
  }, [toast]);

  const profile = data?.profile ?? null;
  const name = typeof profile?.name === "string" && profile.name.trim() ? profile.name.trim() : "User";
  const role = typeof profile?.role === "string" && profile.role.trim() ? profile.role.trim() : "User";
  const avatarUrl = typeof profile?.avatar_url === "string" && profile.avatar_url.trim() ? profile.avatar_url : null;
  const biz = profile?.business ?? null;
  const businessName =
    typeof biz?.name === "string" && biz.name.trim() ? biz.name.trim() : "";
  const fallbackAvatarText = businessName || name;

  const [languageSheetOpen, setLanguageSheetOpen] = useState(false);
  const [language, setLanguage] = useState<"uz" | "ru">("uz");

  useEffect(() => {
    try {
      const v = localStorage.getItem("stamply_language");
      if (v === "ru" || v === "uz") setLanguage(v);
    } catch {
      // ignore
    }
  }, []);

  const languageLabel = useMemo(() => {
    return language === "ru" ? "🇷🇺 Russian" : "🇺🇿 Uzbek";
  }, [language]);

  const onSupport = () => {
    const url = "https://t.me/sukhr0b97";
    const tg = (window as any)?.Telegram?.WebApp;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(url);
      return;
    }
    window.open(url, "_blank");
  };

  const onInviteStaff = async () => {
    if (inviteLoading) return;
    try {
      const res = await createInvite();
      const inviteUrl = res.data?.createStaffInvite?.inviteUrl ?? null;
      if (!inviteUrl) {
        setToast("Failed to generate invite link");
        return;
      }

      const shareText = `Join our staff:\n\n🏪 ${businessName || "Our business"}\n\nTap the link below 👇`;
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(
        shareText,
      )}`;

      const tg = (window as any)?.Telegram?.WebApp;
      if (tg?.openTelegramLink) {
        tg.openTelegramLink(shareUrl);
        return;
      }

      try {
        await navigator.clipboard.writeText(inviteUrl);
        setToast("Invite link copied");
      } catch {
        // Last-resort fallback if clipboard is blocked
        window.prompt("Copy invite link:", inviteUrl);
      }
    } catch {
      setToast("Failed to generate invite link");
    }
  };

  return (
    <RequireAuth>
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
            <h1 className="text-xl font-semibold text-[#0F172A]">Profile</h1>
          </div>

        {!ready ? (
          <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="h-10 w-40 rounded-lg bg-gray-100" />
            <div className="mt-4 h-24 rounded-xl bg-gray-100" />
          </div>
        ) : !isAuthenticated ? (
          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
            Please login in Telegram mini app.
          </div>
        ) : loading ? (
          <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="h-10 w-40 rounded-lg bg-gray-100" />
            <div className="mt-4 h-24 rounded-xl bg-gray-100" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500">
            Failed to load profile
            {error?.message ? <div className="mt-2 text-xs text-gray-400">{error.message}</div> : null}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Business */}
            <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="flex items-center gap-3">
                <Avatar src={avatarUrl} fallbackText={fallbackAvatarText} size={48} className="text-lg" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-base font-semibold text-gray-900">{businessName || "—"}</div>
                    <RoleBadge role={role} />
                  </div>
                  {biz?.phone?.trim() ? (
                    <div className="mt-1 text-sm text-gray-500">{biz.phone}</div>
                  ) : null}
                  {biz?.address?.trim() ? (
                    <div className="mt-1 text-sm text-gray-500">{biz.address}</div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Settings */}
            <div className="rounded-2xl border border-black/5 bg-white p-2 shadow-[0_2px_12px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)]">
              <SettingsRow
                icon={<UserPlus className="h-5 w-5" aria-hidden />}
                label={inviteLoading ? "Generating invite…" : "Invite Staff"}
                onClick={() => void onInviteStaff()}
              />
              <div className="h-px bg-gray-100 mx-3" />
              <SettingsRow
                icon={<Globe className="h-5 w-5" aria-hidden />}
                label="Language"
                value={language === "ru" ? "RU" : "UZ"}
                onClick={() => setLanguageSheetOpen(true)}
              />
              <div className="h-px bg-gray-100 mx-3" />
              <SettingsRow icon={<HelpCircle className="h-5 w-5" aria-hidden />} label="Support" onClick={onSupport} />
              <div className="h-px bg-gray-100 mx-3" />
              <SettingsRow
                icon={<LogOut className="h-5 w-5" aria-hidden />}
                label="Logout"
                onClick={() => {
                  const ok = window.confirm("Logout?");
                  if (!ok) return;
                  void logout();
                }}
              />
            </div>
          </div>
        )}
        </div>

        <BottomNav currentKey="profile" />

        {toast ? (
          <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2">
            <div className="rounded-full bg-black/80 px-4 py-2 text-xs font-semibold text-white shadow-lg">
              {toast}
            </div>
          </div>
        ) : null}

        {languageSheetOpen ? (
          <div
            className="fixed inset-0 z-50 bg-black/40 px-4"
            onClick={() => setLanguageSheetOpen(false)}
          >
            <div className="mx-auto max-w-md" onClick={(e) => e.stopPropagation()}>
              <div className="fixed inset-x-0 bottom-0 mx-auto w-full max-w-md rounded-t-[28px] border border-gray-200 bg-white p-4 shadow-[0_-12px_40px_rgba(0,0,0,0.12)]">
                <div className="flex items-center justify-between">
                  <div className="text-base font-semibold text-gray-900">Language</div>
                  <button
                    type="button"
                    className="text-sm font-semibold text-gray-500"
                    onClick={() => setLanguageSheetOpen(false)}
                  >
                    Close
                  </button>
                </div>

              <div className="mt-3 space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setLanguage("uz");
                    try {
                      localStorage.setItem("stamply_language", "uz");
                    } catch {
                      // ignore
                    }
                    setLanguageSheetOpen(false);
                  }}
                  className={[
                    "w-full rounded-2xl border px-4 py-3 text-left text-sm font-semibold",
                    language === "uz"
                      ? "border-[#00AEEF]/30 bg-[#00AEEF]/10 text-[#0077A3]"
                      : "border-gray-200 bg-white text-gray-900",
                  ].join(" ")}
                >
                  🇺🇿 Uzbek
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLanguage("ru");
                    try {
                      localStorage.setItem("stamply_language", "ru");
                    } catch {
                      // ignore
                    }
                    setLanguageSheetOpen(false);
                  }}
                  className={[
                    "w-full rounded-2xl border px-4 py-3 text-left text-sm font-semibold",
                    language === "ru"
                      ? "border-[#00AEEF]/30 bg-[#00AEEF]/10 text-[#0077A3]"
                      : "border-gray-200 bg-white text-gray-900",
                  ].join(" ")}
                >
                  🇷🇺 Russian
                </button>
              </div>

              <div className="mt-3 text-xs text-gray-400">{languageLabel}</div>
            </div>
            </div>
          </div>
        ) : null}
    </div>
    </RequireAuth>
  );
}

