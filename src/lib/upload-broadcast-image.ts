import imageCompression from "browser-image-compression";

export type BroadcastImageUploadErrorCode =
  | "not_configured"
  | "bad_url"
  | "failed"
  | "upload_failed";

export class BroadcastImageUploadError extends Error {
  constructor(public readonly code: BroadcastImageUploadErrorCode) {
    super(code);
    this.name = "BroadcastImageUploadError";
  }
}

function pickUrlFromJson(j: Record<string, unknown>): string | null {
  const nested = j.data;
  const nestedUrl =
    nested && typeof nested === "object" && nested !== null && "url" in nested
      ? (nested as { url?: unknown }).url
      : undefined;
  const raw = j.url ?? j.secure_url ?? nestedUrl;
  const url = typeof raw === "string" ? raw.trim() : null;
  if (!url) return null;
  if (url.startsWith("https://") || url.startsWith("http://")) return url;
  return null;
}

const compressionOptions = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1280,
  useWebWorker: true,
};

function toUploadableFile(blob: Blob, originalName: string): File {
  if (blob instanceof File) return blob;
  const base = originalName.replace(/\.[^.]+$/, "") || "image";
  const ext = blob.type.includes("png") ? ".png" : ".jpg";
  return new File([blob], `${base}${ext}`, { type: blob.type || "image/jpeg" });
}

/**
 * Compress client-side, then POST /upload (FormData field `file`). Returns public image URL.
 */
export async function uploadBroadcastImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new BroadcastImageUploadError("failed");
  }

  let compressed: File;
  try {
    const out = await imageCompression(file, compressionOptions);
    compressed = toUploadableFile(out, file.name);
  } catch {
    throw new BroadcastImageUploadError("failed");
  }

  const fd = new FormData();
  fd.append("file", compressed);

  const headers: HeadersInit = {};
  const auth = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
  if (auth) headers.Authorization = `Bearer ${auth}`;

  let res: Response;
  try {
    res = await fetch("/upload", { method: "POST", body: fd, headers });
  } catch {
    throw new BroadcastImageUploadError("failed");
  }

  let j: Record<string, unknown>;
  try {
    j = (await res.json()) as Record<string, unknown>;
  } catch {
    throw new BroadcastImageUploadError("failed");
  }

  if (res.status === 503 && j.error === "not_configured") {
    throw new BroadcastImageUploadError("not_configured");
  }

  if (!res.ok) {
    const err = typeof j.error === "string" ? j.error : "";
    if (err === "upload_failed") throw new BroadcastImageUploadError("upload_failed");
    if (err === "bad_url") throw new BroadcastImageUploadError("bad_url");
    throw new BroadcastImageUploadError("failed");
  }

  const url = pickUrlFromJson(j);
  if (!url) throw new BroadcastImageUploadError("bad_url");
  return url;
}
