"use client";

import { BottomNav } from "@/components/common/bottom-nav";
import { RequireAuth } from "@/components/common/require-auth";
import { PROFILE_QUERY } from "@/graphql/queries/profile.query";
import { useAuth } from "@/app/providers";
import { useQuery } from "@apollo/client/react";
import { ArrowLeft, ChevronRight, Globe, HelpCircle, LogOut, QrCode } from "lucide-react";
import { useRouter } from "next/navigation";

type ProfileData = {
  profile: {
    id: number;
    telegram_id?: string | number | null;
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

function getInitials(name: string) {
  const safe = (name ?? "").trim();
  if (!safe) return "G";
  const parts = safe.split(" ").filter(Boolean);
  return parts.length === 1 ? parts[0][0] : (parts[0][0] ?? "") + (parts[1][0] ?? "");
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
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
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
      <ChevronRight className="h-4 w-4 text-gray-400" aria-hidden />
    </button>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { ready, isAuthenticated, logout } = useAuth();
  const { data, loading, error } = useQuery<ProfileData>(PROFILE_QUERY, {
    skip: !ready || !isAuthenticated,
    fetchPolicy: "network-only",
  });

  const profile = data?.profile ?? null;
  const name = typeof profile?.name === "string" && profile.name.trim() ? profile.name.trim() : "Guest";
  const role = typeof profile?.role === "string" && profile.role.trim() ? profile.role.trim() : "User";
  const avatarUrl = typeof profile?.avatar_url === "string" && profile.avatar_url.trim() ? profile.avatar_url : null;
  const biz = profile?.business ?? null;

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
          <div className="space-y-4">
            {/* Account */}
            <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="flex items-center gap-3">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt=""
                    className="h-14 w-14 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-full bg-[#E6F4FA] flex items-center justify-center text-[#0284C7] font-semibold text-lg">
                    {getInitials(name)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="truncate text-base font-semibold text-gray-900">{name}</div>
                    <RoleBadge role={role} />
                  </div>
                  <div className="mt-1 text-xs text-gray-400">
                    ID: {profile?.id ?? "—"} · TG: {profile?.telegram_id ?? "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* Business */}
            <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="text-sm font-semibold text-[#0F172A]">Business</div>
              <div className="mt-3 space-y-2">
                <div>
                  <div className="text-xs text-gray-400">Name</div>
                  <div className="text-sm font-semibold text-gray-900">
                    {biz?.name?.trim() ? biz.name : <span className="text-gray-400 font-medium">No business name</span>}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Phone</div>
                  <div className="text-sm font-semibold text-gray-900">
                    {biz?.phone?.trim() ? biz.phone : <span className="text-gray-400 font-medium">No phone</span>}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Address</div>
                  <div className="text-sm font-semibold text-gray-900">
                    {biz?.address?.trim() ? biz.address : <span className="text-gray-400 font-medium">No address</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Settings */}
            <div className="rounded-2xl border border-black/5 bg-white p-2 shadow-[0_2px_12px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)]">
              <SettingsRow icon={<QrCode className="h-5 w-5" aria-hidden />} label="QR Code" />
              <div className="h-px bg-gray-100 mx-3" />
              <SettingsRow icon={<Globe className="h-5 w-5" aria-hidden />} label="Language" />
              <div className="h-px bg-gray-100 mx-3" />
              <SettingsRow icon={<HelpCircle className="h-5 w-5" aria-hidden />} label="Support" />
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
    </div>
    </RequireAuth>
  );
}

