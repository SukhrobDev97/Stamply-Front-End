import imageCompression from "browser-image-compression";
import { isLikelyImage } from "@/lib/is-likely-image";
import {
  fetchWithTimeout,
  FetchTimeoutError,
  normalizeApiError,
  parseHttpErrorBody,
  type ApiError,
} from "@/lib/api";
import { stamplyDebugLog } from "@/lib/stamply-debug-log";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const COMPRESS_THRESHOLD_BYTES = 1.5 * 1024 * 1024;

const LEGACY_UPLOAD_CODE: Record<string, string> = {
  not_configured: "NOT_CONFIGURED",
  upload_failed: "UPLOAD_FAILED",
  bad_url: "BAD_URL",
  not_image: "UNSUPPORTED_FILE",
  too_large: "VALIDATION_FAILED",
  no_file: "VALIDATION_FAILED",
};

function mapLegacyUploadBody(j: Record<string, unknown>, httpStatus: number): ApiError {
  const legacy = typeof j.error === "string" ? j.error.trim() : "";
  const code = LEGACY_UPLOAD_CODE[legacy] ?? (legacy ? legacy.toUpperCase().replace(/-/g, "_") : "UPLOAD_FAILED");
  const detail = typeof j.detail === "string" ? j.detail : undefined;
  return {
    code,
    message: detail ?? code,
    statusCode: httpStatus,
    retryable: code === "UPLOAD_FAILED" || code === "NETWORK_ERROR",
  };
}

export class UploadBroadcastImageError extends Error {
  constructor(public readonly apiError: ApiError) {
    super(apiError.code);
    this.name = "UploadBroadcastImageError";
  }
}

function pickUrlFromJson(j: Record<string, unknown>): string | null {
  const nested = j.data;
  const nestedUrl =
    nested && typeof nested === "object" && nested !== null && "url" in nested
      ? (nested as { url?: unknown }).url
      : undefined;
  const urls = j.urls;
  const firstUrl = Array.isArray(urls) ? urls.find((v) => typeof v === "string") : undefined;
  const raw = j.url ?? j.secure_url ?? nestedUrl ?? firstUrl;
  const url = typeof raw === "string" ? raw.trim() : null;
  if (!url) return null;
  if (url.startsWith("https://") || url.startsWith("http://")) return url;
  if (url.startsWith("/uploads/")) return url;
  return null;
}

function compressionOptions(useWebWorker: boolean) {
  return {
    maxSizeMB: 2,
    maxWidthOrHeight: 1280,
    useWebWorker,
  };
}

function toUploadableFile(blob: Blob, originalName: string): File {
  if (blob instanceof File) return blob;
  const base = originalName.replace(/\.[^.]+$/, "") || "image";
  const ext = blob.type.includes("png") ? ".png" : ".jpg";
  return new File([blob], `${base}${ext}`, { type: blob.type || "image/jpeg" });
}

async function compressForUpload(file: File): Promise<File> {
  if (file.size <= COMPRESS_THRESHOLD_BYTES) {
    return file;
  }
  try {
    const out = await imageCompression(file, compressionOptions(true));
    return toUploadableFile(out, file.name);
  } catch (e) {
    stamplyDebugLog("upload", "compress worker failed, retry main thread", String(e));
    const out = await imageCompression(file, compressionOptions(false));
    return toUploadableFile(out, file.name);
  }
}

async function postUploadOnce(file: File, headers: HeadersInit): Promise<Response> {
  const fd = new FormData();
  fd.append("file", file);
  return fetchWithTimeout("/upload", { method: "POST", body: fd, headers }, 30_000);
}

/**
 * Compress client-side, then POST /upload. Returns public image URL.
 * Throws UploadBroadcastImageError with normalized ApiError.
 */
export async function uploadBroadcastImage(file: File, attempt = 0): Promise<string> {
  stamplyDebugLog("upload", "pick", {
    name: file.name,
    type: file.type || "(empty)",
    size: file.size,
    attempt,
  });

  if (!isLikelyImage(file)) {
    throw new UploadBroadcastImageError({
      code: "UNSUPPORTED_FILE",
      message: "Unsupported file",
      retryable: false,
    });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadBroadcastImageError({
      code: "VALIDATION_FAILED",
      message: "too_large",
      retryable: false,
    });
  }

  let uploadFile: File;
  try {
    uploadFile = await compressForUpload(file);
  } catch (e) {
    stamplyDebugLog("upload", "compress failed", String(e));
    throw new UploadBroadcastImageError({
      code: "UPLOAD_FAILED",
      message: "compress",
      retryable: false,
    });
  }

  const headers: HeadersInit = {};
  const auth = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
  if (auth) headers.Authorization = `Bearer ${auth}`;

  let res: Response;
  try {
    res = await postUploadOnce(uploadFile, headers);
  } catch (e) {
    if (e instanceof FetchTimeoutError) {
      const api: ApiError = { code: "NETWORK_ERROR", message: "timeout", retryable: true };
      if (attempt < 1) {
        stamplyDebugLog("upload", "retry after timeout");
        return uploadBroadcastImage(file, attempt + 1);
      }
      throw new UploadBroadcastImageError(api);
    }
    stamplyDebugLog("upload", "network error", String(e));
    const api: ApiError = { code: "NETWORK_ERROR", message: "network", retryable: true };
    if (attempt < 1) {
      return uploadBroadcastImage(file, attempt + 1);
    }
    throw new UploadBroadcastImageError(api);
  }

  let j: Record<string, unknown>;
  try {
    j = (await res.json()) as Record<string, unknown>;
  } catch {
    const api: ApiError = {
      code: "UPLOAD_FAILED",
      message: "invalid json",
      statusCode: res.status,
      retryable: res.status >= 500,
    };
    if (attempt < 1 && api.retryable) {
      return uploadBroadcastImage(file, attempt + 1);
    }
    throw new UploadBroadcastImageError(api);
  }

  if (!res.ok) {
    const fromBackend = parseHttpErrorBody(j, res.status);
    const api = fromBackend ?? mapLegacyUploadBody(j, res.status);
    stamplyDebugLog("upload", "failed", api);
    if (attempt < 1 && (api.retryable || res.status >= 500)) {
      return uploadBroadcastImage(file, attempt + 1);
    }
    throw new UploadBroadcastImageError(api);
  }

  const url = pickUrlFromJson(j);
  if (!url) {
    throw new UploadBroadcastImageError({
      code: "BAD_URL",
      message: "missing url",
      statusCode: res.status,
      retryable: false,
    });
  }

  stamplyDebugLog("upload", "ok", { url });
  return url;
}

export function uploadErrorToApiError(err: unknown): ApiError {
  if (err instanceof UploadBroadcastImageError) return err.apiError;
  return normalizeApiError(err);
}
