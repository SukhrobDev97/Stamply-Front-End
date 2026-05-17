"use client";

import { BottomNav } from "@/components/common/bottom-nav";
import { Avatar } from "@/components/common/avatar";
import { RequireAuth } from "@/components/common/require-auth";
import { CREATE_STAFF_INVITE_MUTATION } from "@/graphql/mutations/createStaffInvite.mutation";
import { LEAVE_BUSINESS_MUTATION } from "@/graphql/mutations/leaveBusiness.mutation";
import { REMOVE_STAFF_MUTATION } from "@/graphql/mutations/removeStaff.mutation";
import { PROFILE_QUERY } from "@/graphql/queries/profile.query";
import { GET_BUSINESS_STAFF_QUERY } from "@/graphql/queries/getBusinessStaff.query";
import { useAuth } from "@/app/providers";
import { useOverlayModal } from "@/hooks/use-overlay-modal";
import { useQuery } from "@apollo/client/react";
import { useMutation } from "@apollo/client/react";
import { ArrowLeft, ChevronRight, DoorOpen, HelpCircle, Loader2, LogOut, Megaphone, UserPlus } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { STAMPLY_LANG_CHANGED } from "@/lib/lang";
import { openStamplySupportTelegram } from "@/lib/support-telegram";
import { t, type ProfileLang } from "./copy";

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

type StaffRow = {
  id: string | number;
  name?: string | null;
  telegram_id?: string | null;
  avatar_url?: string | null;
};

type GetBusinessStaffData = {
  getBusinessStaff: StaffRow[];
};

function RoleBadge({ role, ownerLabel, staffLabel }: { role: string; ownerLabel: string; staffLabel: string }) {
  const r = role.toLowerCase();
  const label = r === "owner" ? ownerLabel : r === "staff" ? staffLabel : role;
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
  const [removeTarget, setRemoveTarget] = useState<{ id: number; name: string } | null>(null);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [createInvite, { loading: inviteLoading }] = useMutation<{
    createStaffInvite?: { inviteUrl?: string | null } | null;
  }>(CREATE_STAFF_INVITE_MUTATION);
  const [removeStaff, { loading: removeLoading }] = useMutation<{ removeStaff: boolean }>(REMOVE_STAFF_MUTATION, {
    refetchQueries: [{ query: GET_BUSINESS_STAFF_QUERY }],
    awaitRefetchQueries: true,
  });
  const [leaveBusiness, { loading: leaveLoading }] = useMutation<{ leaveBusiness: boolean }>(LEAVE_BUSINESS_MUTATION);
  const qrModal = useOverlayModal();
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 1600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const [lang, setLang] = useState<ProfileLang>("uz");

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

  const profile = data?.profile ?? null;
  const name = typeof profile?.name === "string" && profile.name.trim() ? profile.name.trim() : txt.userFallback;
  const role = typeof profile?.role === "string" && profile.role.trim() ? profile.role.trim() : txt.userFallback;
  const isOwner = role.toLowerCase() === "owner";
  const isStaff = role.toLowerCase() === "staff";
  const avatarUrl = typeof profile?.avatar_url === "string" && profile.avatar_url.trim() ? profile.avatar_url : null;
  const biz = profile?.business ?? null;
  const businessName =
    typeof biz?.name === "string" && biz.name.trim() ? biz.name.trim() : "";
  const fallbackAvatarText = businessName || name;

  const qrValue = useMemo(() => {
    const id = biz?.id;
    if (typeof id === "number" && Number.isFinite(id)) {
      return `https://t.me/stamplyBot?start=business_${id}`;
    }
    return "https://t.me/stamplyBot";
  }, [biz?.id]);

  const onDownloadQr = useCallback(() => {
    const canvas = qrCanvasRef.current ?? document.querySelector<HTMLCanvasElement>("#profile-qr canvas");
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "stamply-qr.png";
    a.rel = "noopener";
    a.style.position = "fixed";
    a.style.left = "-9999px";
    a.style.top = "0";
    a.style.width = "1px";
    a.style.height = "1px";
    a.style.opacity = "0";
    document.body.appendChild(a);
    const clicked = a.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, view: window }),
    );
    window.setTimeout(() => a.remove(), 0);
    if (!clicked) window.location.href = dataUrl;
  }, []);

  const { data: staffData, loading: staffLoading, error: staffError } = useQuery<GetBusinessStaffData>(
    GET_BUSINESS_STAFF_QUERY,
    {
      skip: !ready || !isAuthenticated || !token || !isOwner,
      fetchPolicy: "network-only",
    },
  );

  const onSupport = () => {
    openStamplySupportTelegram();
  };

  const onInviteStaff = async () => {
    if (inviteLoading) return;
    try {
      const res = await createInvite();
      const inviteUrl = res.data?.createStaffInvite?.inviteUrl ?? null;
      if (!inviteUrl) {
        setToast(txt.failedInvite);
        return;
      }

      const shareText = `${txt.inviteShareLine1}\n\n🏪 ${businessName || txt.ourBusiness}\n\n${txt.inviteShareLine3}`;
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(
        shareText,
      )}`;

      const tg = window.Telegram?.WebApp;
      if (tg?.openTelegramLink) {
        tg.openTelegramLink(shareUrl);
        return;
      }

      try {
        await navigator.clipboard.writeText(inviteUrl);
        setToast(txt.inviteCopied);
      } catch {
        // Last-resort fallback if clipboard is blocked
        window.prompt(txt.copyInvitePrompt, inviteUrl);
      }
    } catch {
      setToast(txt.failedInvite);
    }
  };

  return (
    <RequireAuth>
      <div className="min-h-dvh bg-[#f7f7f8] text-black">
        <div className="mx-auto max-w-md px-4 pt-3 pb-32">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#00AEEF]/10 active:scale-95"
                aria-label="Back"
              >
                <ArrowLeft className="h-5 w-5 text-[#0077A3]" aria-hidden />
              </button>
              <h1 className="truncate text-xl font-semibold text-[#0F172A]">{txt.profileTitle}</h1>
            </div>
            {ready && isAuthenticated && !loading && !error ? (
              <button
                type="button"
                onClick={() => qrModal.open()}
                className="shrink-0 rounded-full bg-[#00AEEF]/10 px-3 py-1.5 text-xs font-semibold text-[#0077A3] active:scale-95"
              >
                QR
              </button>
            ) : null}
          </div>

        {!ready ? (
          <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="h-10 w-40 rounded-lg bg-gray-100" />
            <div className="mt-4 h-24 rounded-xl bg-gray-100" />
          </div>
        ) : !isAuthenticated ? (
          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
            {txt.loginTelegramOnly}
          </div>
        ) : loading ? (
          <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="h-10 w-40 rounded-lg bg-gray-100" />
            <div className="mt-4 h-24 rounded-xl bg-gray-100" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500">
            {txt.failedLoadProfile}
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
                    <RoleBadge role={role} ownerLabel={txt.roleOwner} staffLabel={txt.roleStaff} />
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
              {isOwner ? (
                <>
                  <SettingsRow
                    icon={<UserPlus className="h-5 w-5" aria-hidden />}
                    label={inviteLoading ? txt.generatingInvite : txt.inviteStaff}
                    onClick={() => void onInviteStaff()}
                  />
                  <div className="h-px bg-gray-100 mx-3" />
                </>
              ) : null}
              {isOwner || isStaff ? (
                <>
                  <SettingsRow
                    icon={<Megaphone className="h-5 w-5" aria-hidden />}
                    label={txt.broadcastNav}
                    onClick={() => router.push("/profile/broadcast")}
                  />
                  <div className="h-px bg-gray-100 mx-3" />
                </>
              ) : null}
              <SettingsRow icon={<HelpCircle className="h-5 w-5" aria-hidden />} label={txt.support} onClick={onSupport} />
              <div className="h-px bg-gray-100 mx-3" />
              <SettingsRow
                icon={<LogOut className="h-5 w-5" aria-hidden />}
                label={txt.logout}
                onClick={() => {
                  const ok = window.confirm(txt.logoutConfirm);
                  if (!ok) return;
                  void logout();
                }}
              />
            </div>

            {isOwner ? (
              <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)]">
                <div className="text-sm font-semibold text-gray-900">{txt.staff}</div>
                {staffError ? (
                  <div className="mt-3 text-sm text-red-600">
                    {txt.staffLoadError}
                    {staffError.message ? (
                      <span className="mt-1 block text-xs text-red-500/90">{staffError.message}</span>
                    ) : null}
                  </div>
                ) : staffLoading ? (
                  <div className="mt-4 flex justify-center py-6 text-gray-400">
                    <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
                  </div>
                ) : (staffData?.getBusinessStaff?.length ?? 0) === 0 ? (
                  <div className="mt-3 text-sm text-gray-500">{txt.noStaffYet}</div>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {(staffData?.getBusinessStaff ?? []).map((s) => {
                      const sid = Number(s.id);
                      const sname =
                        typeof s.name === "string" && s.name.trim() ? s.name.trim() : txt.userFallback;
                      const surl =
                        typeof s.avatar_url === "string" && s.avatar_url.trim() ? s.avatar_url.trim() : null;
                      return (
                        <li
                          key={sid}
                          className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/50 px-3 py-2.5"
                        >
                          <Avatar src={surl} fallbackText={sname} size={40} className="text-sm shrink-0" />
                          <div className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">{sname}</div>
                          <button
                            type="button"
                            onClick={() => setRemoveTarget({ id: sid, name: sname })}
                            className="shrink-0 rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 active:scale-[0.98]"
                          >
                            {txt.remove}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ) : null}

            {isStaff ? (
              <div className="rounded-2xl border border-red-100 bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)]">
                <button
                  type="button"
                  onClick={() => setLeaveConfirmOpen(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white py-3 text-sm font-semibold text-red-600 active:scale-[0.99]"
                >
                  <DoorOpen className="h-4 w-4 shrink-0" aria-hidden />
                  {txt.leaveBusiness}
                </button>
              </div>
            ) : null}
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

        {leaveConfirmOpen ? (
          <div
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 px-4 pb-8 pt-10 sm:items-center"
            onClick={() => (!leaveLoading ? setLeaveConfirmOpen(false) : null)}
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-base font-semibold text-gray-900">{txt.leaveTitle}</div>
              <div className="mt-2 text-sm text-gray-500">{txt.leaveSubtitle}</div>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  disabled={leaveLoading}
                  onClick={() => setLeaveConfirmOpen(false)}
                  className="flex-1 rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-800 active:scale-[0.99] disabled:opacity-50"
                >
                  {txt.cancel}
                </button>
                <button
                  type="button"
                  disabled={leaveLoading}
                  onClick={() => {
                    void (async () => {
                      try {
                        const res = await leaveBusiness();
                        if (res.data?.leaveBusiness !== true) {
                          setToast(txt.couldNotLeave);
                          setLeaveConfirmOpen(false);
                          return;
                        }
                        setLeaveConfirmOpen(false);
                        await logout();
                        router.replace("/");
                      } catch {
                        setToast(txt.couldNotLeave);
                        setLeaveConfirmOpen(false);
                      }
                    })();
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-50"
                >
                  {leaveLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  {txt.leave}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {qrModal.show ? (
          <div
            className={qrModal.overlayClassName}
            onTransitionEnd={qrModal.onOverlayTransitionEnd}
          >
            <div
              className={[
                "w-full max-w-sm rounded-xl border border-gray-200 bg-white p-5",
                qrModal.panelClassName,
                qrModal.panelOpenClassName,
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-black">{txt.homeScanQr}</div>
                <button
                  type="button"
                  onClick={() => qrModal.close()}
                  className="text-xs font-semibold text-gray-500 hover:text-black"
                >
                  {txt.homeClose}
                </button>
              </div>
              <div
                id="profile-qr"
                className="mt-4 flex justify-center rounded-xl border border-gray-100 bg-white p-4"
              >
                <QRCodeCanvas ref={qrCanvasRef} value={qrValue} size={220} level="M" includeMargin />
              </div>
              <button
                type="button"
                onClick={onDownloadQr}
                className="mt-4 w-full rounded-xl bg-[#0284C7] py-3 text-sm font-semibold text-white active:scale-[0.99]"
              >
                {txt.homeDownload}
              </button>
            </div>
          </div>
        ) : null}

        {removeTarget ? (
          <div
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 px-4 pb-8 pt-10 sm:items-center"
            onClick={() => (!removeLoading ? setRemoveTarget(null) : null)}
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-base font-semibold text-gray-900">{txt.removeStaffTitle}</div>
              <div className="mt-2 text-sm text-gray-500">
                {removeTarget.name} {txt.removeStaffLossSuffix}
              </div>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  disabled={removeLoading}
                  onClick={() => setRemoveTarget(null)}
                  className="flex-1 rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-800 active:scale-[0.99] disabled:opacity-50"
                >
                  {txt.cancel}
                </button>
                <button
                  type="button"
                  disabled={removeLoading}
                  onClick={() => {
                    void (async () => {
                      try {
                        const res = await removeStaff({ variables: { staffId: removeTarget.id } });
                        if (res.data?.removeStaff !== true) {
                          setToast(txt.failedRemoveStaff);
                          setRemoveTarget(null);
                          return;
                        }
                        setRemoveTarget(null);
                        setToast(txt.staffRemoved);
                      } catch {
                        setToast(txt.failedRemoveStaff);
                        setRemoveTarget(null);
                      }
                    })();
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-50"
                >
                  {removeLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  {txt.remove}
                </button>
              </div>
            </div>
          </div>
        ) : null}

    </div>
    </RequireAuth>
  );
}

