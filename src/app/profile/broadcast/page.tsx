"use client";

import { BottomNav } from "@/components/common/bottom-nav";
import { RequireAuth } from "@/components/common/require-auth";
import { useAuth } from "@/app/providers";
import { CREATE_BROADCAST_MUTATION } from "@/graphql/mutations/createBroadcast.mutation";
import { DELETE_BROADCAST_MUTATION } from "@/graphql/mutations/deleteBroadcast.mutation";
import { BROADCASTS_PAGE_QUERY } from "@/graphql/queries/broadcastsPage.query";
import { LoadMoreButton } from "@/components/common/load-more-button";
import { useCursorPage } from "@/hooks/use-cursor-page";
import { GET_BROADCAST_QUERY } from "@/graphql/queries/getBroadcast.query";
import { useProfile } from "@/components/common/require-auth";
import { useAppLang } from "@/lib/use-app-lang";
import { isLikelyImage } from "@/lib/is-likely-image";
import { stamplyDebugLog } from "@/lib/stamply-debug-log";
import { getPrimaryErrorCode, mapApiErrorToUserMessage, normalizeApiError } from "@/lib/api";
import { UploadBroadcastImageError, uploadBroadcastImage } from "@/lib/upload-broadcast-image";
import { useApolloClient, useMutation } from "@apollo/client/react";
import { ArrowLeft, ImagePlus, Loader2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { t, type ProfileLang } from "@/app/profile/copy";
import { useEffect, useId, useRef, useState } from "react";

const MAX_MSG = 300;
const MAX_IMAGES = 2;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const POLL_MS = 4000;
const MAX_POLL_TICKS = 120;

type BroadcastType = "ANNOUNCEMENT" | "DISCOUNT";

type CreateBroadcastData = {
  createBroadcast: { id: number | string; status: string };
};

type GetBroadcastData = {
  getBroadcast: { id: number; status: string; sentCount?: number | null };
};

type BroadcastHistoryRow = {
  id: number;
  type: string;
  message: string;
  createdAt: string;
  status: string;
  sentCount?: number | null;
};

type DeleteBroadcastData = {
  deleteBroadcast: boolean;
};

function parseBroadcastIdAsInt(raw: number | string | null | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const t = Math.trunc(raw);
    return Number.isSafeInteger(t) ? t : null;
  }
  const s = String(raw).trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : null;
}

function normalizeStatus(s: string | null | undefined) {
  return String(s ?? "").toUpperCase();
}

function formatBroadcastDate(iso: string, lang: ProfileLang) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const loc = lang === "ru" ? "ru-RU" : "uz-UZ";
  return new Intl.DateTimeFormat(loc, { dateStyle: "short", timeStyle: "short" }).format(d);
}

function previewHistoryMessage(text: string, maxChars = 100) {
  const s = (text ?? "").replace(/\s+/g, " ").trim();
  if (s.length <= maxChars) return s;
  return `${s.slice(0, maxChars)}…`;
}

function historyStatusLabel(st: string, txt: (typeof t)[ProfileLang]): string {
  const u = normalizeStatus(st);
  if (u === "SENT") return txt.broadcastHistoryStatusSent;
  if (u === "FAILED") return txt.broadcastHistoryStatusFailed;
  if (u === "DRAFT") return txt.broadcastHistoryStatusDraft;
  if (u === "SENDING") return txt.broadcastHistoryStatusSending;
  return st || "—";
}

function historyTypeLabel(type: string, txt: (typeof t)[ProfileLang]): string {
  const u = String(type).toUpperCase();
  if (u === "DISCOUNT") return txt.broadcastTypeDiscount;
  return txt.broadcastTypeAnnouncement;
}

function BroadcastPageInner() {
  const router = useRouter();
  const { lang, txt } = useAppLang();
  const client = useApolloClient();
  const { ready, isAuthenticated } = useAuth();
  const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;

  const { profileData, loading: profileLoading } = useProfile();

  const roleRaw = profileData?.profile?.role;
  const role = typeof roleRaw === "string" ? roleRaw.toLowerCase() : "";
  const canAccess = role === "owner" || role === "staff";

  const [message, setMessage] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [pendingUploadPreview, setPendingUploadPreview] = useState<string | null>(null);
  const imagesRef = useRef<string[]>([]);
  const pendingPreviewRef = useRef<string | null>(null);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);
  useEffect(() => {
    return () => {
      if (pendingPreviewRef.current) {
        URL.revokeObjectURL(pendingPreviewRef.current);
        pendingPreviewRef.current = null;
      }
    };
  }, []);

  const clearPendingPreview = () => {
    if (pendingPreviewRef.current) {
      URL.revokeObjectURL(pendingPreviewRef.current);
      pendingPreviewRef.current = null;
    }
    setPendingUploadPreview(null);
  };
  const [submitting, setSubmitting] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [pollTargetId, setPollTargetId] = useState<number | null>(null);
  const [remoteStatus, setRemoteStatus] = useState<string | null>(null);
  const pollTickRef = useRef(0);
  const [banner, setBanner] = useState<string | null>(null);
  const [formToast, setFormToast] = useState<string | null>(null);

  const fileInputId = useId();

  const [createBroadcast] = useMutation<CreateBroadcastData>(CREATE_BROADCAST_MUTATION);
  const [deleteBroadcast] = useMutation<DeleteBroadcastData>(DELETE_BROADCAST_MUTATION);

  const historySkip = !ready || !isAuthenticated || !token || profileLoading || !canAccess;
  const {
    items: historyItems,
    loading: historyLoading,
    loadingMore: historyLoadingMore,
    error: historyError,
    hasMore: historyHasMore,
    loadMore: loadMoreHistory,
    refetchFirstPage: refetchHistoryFirstPage,
  } = useCursorPage<BroadcastHistoryRow>({
    query: BROADCASTS_PAGE_QUERY,
    fieldName: "broadcastsPage",
    skip: historySkip,
  });

  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletedHistoryIds, setDeletedHistoryIds] = useState<number[]>([]);
  const historyRows = historyItems.filter((row) => !deletedHistoryIds.includes(Number(row.id)));

  const inProgress =
    pollTargetId != null &&
    remoteStatus != null &&
    (remoteStatus === "DRAFT" || remoteStatus === "SENDING");
  const formLocked = submitting || inProgress || imageUploading;

  useEffect(() => {
    if (pollTargetId == null) return;
    pollTickRef.current = 0;
    let cancelled = false;

    const stopPollUnlocked = (toastMsg?: string) => {
      setPollTargetId(null);
      setRemoteStatus(null);
      setBanner(null);
      if (toastMsg) setFormToast(toastMsg);
    };

    const tick = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      pollTickRef.current += 1;
      if (pollTickRef.current > MAX_POLL_TICKS) {
        stopPollUnlocked(txt.broadcastPollFailed);
        return;
      }
      try {
        const r = await client.query<GetBroadcastData>({
          query: GET_BROADCAST_QUERY,
          variables: { id: pollTargetId },
          fetchPolicy: "network-only",
        });
        if (cancelled) return;
        const b = r.data?.getBroadcast;
        if (!b) {
          stopPollUnlocked(txt.broadcastPollFailed);
          return;
        }
        const st = normalizeStatus(b.status);
        setRemoteStatus(st);

        if (st === "DRAFT" || st === "SENDING") {
          setBanner(txt.broadcastSending);
        } else if (st === "SENT") {
          setBanner(txt.broadcastSent.replace("{count}", String(Number(b.sentCount ?? 0))));
          setPollTargetId(null);
          setRemoteStatus(null);
          setMessage("");
          clearPendingPreview();
          setImages([]);
          void refetchHistoryFirstPage();
        } else if (st === "FAILED") {
          setBanner(txt.broadcastFailed);
          setPollTargetId(null);
          setRemoteStatus(null);
          void refetchHistoryFirstPage();
        } else {
          setBanner(txt.broadcastSending);
        }
      } catch {
        if (cancelled) return;
        stopPollUnlocked(txt.broadcastPollFailed);
      }
    };

    void tick();
    const id = window.setInterval(() => {
      void tick();
    }, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [
    pollTargetId,
    client,
    txt.broadcastSending,
    txt.broadcastSent,
    txt.broadcastFailed,
    txt.broadcastPollFailed,
    refetchHistoryFirstPage,
  ]);

  useEffect(() => {
    if (!formToast) return;
    const ms = formToast.includes("(") ? 5000 : 2200;
    const t = window.setTimeout(() => setFormToast(null), ms);
    return () => window.clearTimeout(t);
  }, [formToast]);

  const onPickFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const picked = input.files?.length ? Array.from(input.files) : [];
    input.value = "";
    if (!picked.length) return;

    stamplyDebugLog("broadcast", `picker: ${picked.length} file(s)`);

    const room = MAX_IMAGES - imagesRef.current.length;
    if (room <= 0) {
      setFormToast(txt.broadcastMaxImages);
      return;
    }

    setImageUploading(true);
    const add: string[] = [];
    try {
      for (const f of picked.slice(0, room)) {
        if (!isLikelyImage(f)) {
          stamplyDebugLog("broadcast", "rejected: not an image", { name: f.name, type: f.type || "(empty)" });
          setFormToast(txt.broadcastImageUnsupported);
          continue;
        }
        if (f.size > MAX_IMAGE_BYTES) {
          setFormToast(txt.broadcastImageTooBig);
          continue;
        }
        clearPendingPreview();
        const previewUrl = URL.createObjectURL(f);
        pendingPreviewRef.current = previewUrl;
        setPendingUploadPreview(previewUrl);
        try {
          const url = await uploadBroadcastImage(f);
          add.push(url);
          setImages((prev) => [...prev, url].slice(0, MAX_IMAGES));
        } catch (err) {
          const api = err instanceof UploadBroadcastImageError ? err.apiError : normalizeApiError(err);
          setFormToast(mapApiErrorToUserMessage(api, lang));
          break;
        } finally {
          clearPendingPreview();
        }
        if (add.length >= room) break;
      }
    } finally {
      setImageUploading(false);
    }

    if (add.length === 0) return;
  };

  const onSubmit = async () => {
    const body = message.trim();
    if (!body || formLocked) return;
    setBanner(null);
    setFormToast(null);
    setSubmitting(true);
    try {
      if (images.some((u) => u.startsWith("data:"))) {
        setFormToast(txt.broadcastUploadFailed);
        return;
      }
      const input: { type: BroadcastType; message: string; images?: string[] } = {
        type: "ANNOUNCEMENT",
        message: body,
      };
      if (images.length > 0) input.images = images;

      const res = await createBroadcast({
        variables: { input },
        errorPolicy: "all",
      });
      const errs = (res as { errors?: readonly { message?: string; extensions?: { code?: string } }[] }).errors ?? [];
      const row = res.data?.createBroadcast;
      const idNum = parseBroadcastIdAsInt(row?.id);
      if (idNum != null) {
        const st = normalizeStatus(row?.status) || "DRAFT";
        setRemoteStatus(st);
        setPollTargetId(idNum);
        setBanner(txt.broadcastSending);
        return;
      }
      const code = errs[0]?.extensions?.code;
      const apiCode = typeof code === "string" ? code : "UNKNOWN_ERROR";
      setFormToast(
        apiCode === "BROADCAST_LIMIT_REACHED"
          ? txt.broadcastLimitReached
          : mapApiErrorToUserMessage({ code: apiCode, message: apiCode }, lang),
      );
    } catch (err) {
      const code = getPrimaryErrorCode(err);
      setFormToast(
        code === "BROADCAST_LIMIT_REACHED"
          ? txt.broadcastLimitReached
          : mapApiErrorToUserMessage(normalizeApiError(err), lang),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const onDeleteHistory = async (id: number) => {
    if (!window.confirm(txt.broadcastDeleteConfirm)) return;
    setDeletingId(id);
    try {
      const res = await deleteBroadcast({
        variables: { id },
        refetchQueries: [{ query: BROADCASTS_PAGE_QUERY, variables: { limit: 50, cursor: null } }],
        awaitRefetchQueries: true,
      });
      if (res.data?.deleteBroadcast === true) {
        setDeletedHistoryIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      } else {
        setFormToast(txt.broadcastDeleteFailed);
      }
    } catch {
      setFormToast(txt.broadcastDeleteFailed);
    } finally {
      setDeletingId(null);
    }
  };

  return (
      <div className="min-h-dvh bg-[#f7f7f8] text-black">
        <div className="mx-auto max-w-md px-4 pb-40 pt-4">
          <div className="flex items-center gap-3 mb-4">
            <button
              type="button"
              onClick={() => router.push("/profile")}
              className="h-9 w-9 rounded-full bg-[#00AEEF]/10 flex items-center justify-center active:scale-95"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5 text-[#0077A3]" aria-hidden />
            </button>
            <h1 className="text-xl font-semibold text-[#0F172A]">{txt.broadcastPageTitle}</h1>
          </div>

          {!ready || !isAuthenticated || profileLoading ? (
            <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
              <div className="h-8 w-48 rounded-lg bg-gray-100" />
              <div className="mt-4 h-32 rounded-xl bg-gray-100" />
            </div>
          ) : !canAccess ? (
            <div className="rounded-2xl border border-gray-200 bg-white px-4 py-6 text-sm text-gray-600">
              {txt.broadcastAccessDenied}
              <Link href="/profile" className="mt-4 block text-sm font-semibold text-[#0284C7]">
                ← {txt.profileTitle}
              </Link>
            </div>
          ) : (
            <div className="space-y-5">
              {banner ? (
                <div className="rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm font-medium text-gray-800 shadow-sm">
                  {banner}
                </div>
              ) : null}
              {formToast ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                  {formToast}
                </div>
              ) : null}

              <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm space-y-4">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      {txt.broadcastMessageLabel}
                    </label>
                    <span className="text-xs tabular-nums text-gray-400">
                      {txt.broadcastCharsCounter.replace("{n}", String(Math.min(message.length, MAX_MSG)))}
                    </span>
                  </div>
                  <textarea
                    value={message}
                    disabled={formLocked}
                    onChange={(e) => setMessage(e.target.value.slice(0, MAX_MSG))}
                    rows={5}
                    maxLength={MAX_MSG}
                    placeholder={txt.broadcastMessagePlaceholder}
                    className="mt-2 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-60"
                  />
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">{txt.broadcastImagesLabel}</div>
                  <input
                    id={fileInputId}
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    disabled={
                      formLocked ||
                      images.length + (pendingUploadPreview ? 1 : 0) >= MAX_IMAGES ||
                      imageUploading
                    }
                    onChange={(e) => void onPickFiles(e)}
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    {images.map((src, i) => (
                      <div key={`${i}-${src.slice(0, 64)}`} className="relative h-20 w-20 overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt="" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          disabled={formLocked}
                          onClick={() => {
                            setImages((prev) => prev.filter((_, j) => j !== i));
                          }}
                          className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white disabled:opacity-50"
                          aria-label={txt.broadcastRemoveImage}
                        >
                          <X className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                    ))}
                    {pendingUploadPreview ? (
                      <div className="relative h-20 w-20 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 opacity-80">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={pendingUploadPreview} alt="" className="h-full w-full object-cover" />
                        <div className="absolute inset-0 grid place-items-center bg-black/20">
                          <Loader2 className="h-5 w-5 animate-spin text-white" aria-hidden />
                        </div>
                      </div>
                    ) : null}
                    {images.length + (pendingUploadPreview ? 1 : 0) < MAX_IMAGES ? (
                      <label
                        htmlFor={fileInputId}
                        className={[
                          "flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-gray-300 bg-gray-50 text-xs font-semibold text-gray-500",
                          formLocked ||
                          images.length + (pendingUploadPreview ? 1 : 0) >= MAX_IMAGES ||
                          imageUploading
                            ? "pointer-events-none opacity-50"
                            : "",
                        ].join(" ")}
                      >
                        {imageUploading ? (
                          <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
                        ) : (
                          <ImagePlus className="h-5 w-5 shrink-0" aria-hidden />
                        )}
                        {imageUploading ? txt.broadcastImageUploading : txt.broadcastAddImage}
                      </label>
                    ) : null}
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={formLocked || !message.trim()}
                onClick={() => void onSubmit()}
                className="w-full rounded-2xl bg-[#0284C7] py-3.5 text-sm font-semibold text-white shadow-sm transition active:scale-[0.99] disabled:opacity-50"
              >
                {txt.broadcastSubmit}
              </button>

              <section className="pt-2">
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{txt.broadcastHistoryTitle}</h2>
                <div className="max-h-[min(380px,50vh)] overflow-y-auto rounded-2xl border border-black/5 bg-white p-2 shadow-sm">
                  {historyLoading && historyRows.length === 0 ? (
                    <div className="space-y-2 px-2 py-3">
                      <div className="h-14 rounded-xl bg-gray-100" />
                      <div className="h-14 rounded-xl bg-gray-100" />
                    </div>
                  ) : historyError ? (
                    <div className="px-3 py-4 text-xs text-gray-500">{txt.broadcastHistoryLoadError}</div>
                  ) : historyRows.length === 0 ? (
                    <div className="px-3 py-6 text-center text-xs text-gray-500">{txt.broadcastHistoryEmpty}</div>
                  ) : (
                    <ul className="space-y-2">
                      {historyRows.map((row) => {
                        const id = Number(row.id);
                        const sent = Number(row.sentCount ?? 0);
                        return (
                          <li
                            key={id}
                            className="rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2.5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                                  <span className="text-[#0284C7]">{historyTypeLabel(row.type, txt)}</span>
                                  <span className="tabular-nums text-gray-400">
                                    {formatBroadcastDate(row.createdAt, lang)}
                                  </span>
                                </div>
                                <p className="mt-1 line-clamp-2 text-xs leading-snug text-gray-800">
                                  {previewHistoryMessage(row.message)}
                                </p>
                                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[11px] text-gray-500">
                                  <span className="font-medium text-gray-700">{historyStatusLabel(row.status, txt)}</span>
                                  <span className="tabular-nums">
                                    {txt.broadcastHistorySentCount.replace("{n}", String(sent))}
                                  </span>
                                </div>
                              </div>
                              <button
                                type="button"
                                disabled={deletingId === id}
                                onClick={() => void onDeleteHistory(id)}
                                className="shrink-0 rounded-lg border border-red-200 bg-white px-2 py-1 text-[11px] font-semibold text-red-600 active:scale-[0.98] disabled:opacity-50"
                              >
                                {txt.broadcastHistoryDelete}
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <LoadMoreButton
                    hasMore={historyHasMore}
                    loadingMore={historyLoadingMore}
                    loadMoreLabel={txt.loadMore}
                    loadingMoreLabel={txt.loadingMore}
                    onLoadMore={loadMoreHistory}
                  />
                </div>
              </section>
            </div>
          )}
        </div>
        <BottomNav currentKey="profile" />
      </div>
  );
}

export default function BroadcastPage() {
  return (
    <RequireAuth>
      <BroadcastPageInner />
    </RequireAuth>
  );
}
