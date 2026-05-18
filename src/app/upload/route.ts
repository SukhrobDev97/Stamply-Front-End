import { isLikelyImage } from "@/lib/is-likely-image";
import { loadEnvConfig } from "@next/env";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { NextResponse } from "next/server";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;

const PROJECT_ROOT = process.cwd();
const UPLOADS_DIR = path.join(PROJECT_ROOT, "public", "uploads", "broadcasts");

/** TEMPORARY — remove after Telegram /upload 502 is diagnosed. */
const UPLOAD_DEBUG = true;

function uploadDebug(step: string, extra: Record<string, unknown> = {}) {
  const payload = { step, ...extra, at: new Date().toISOString() };
  if (UPLOAD_DEBUG) console.error("[upload debug]", payload);
  return payload;
}

function jsonWithDebug(
  body: Record<string, unknown>,
  status: number,
  debug: Record<string, unknown>,
) {
  return NextResponse.json(
    UPLOAD_DEBUG ? { ...body, _debug: debug } : body,
    { status },
  );
}

function readUploadProxyUrl(): string | undefined {
  try {
    const { combinedEnv } = loadEnvConfig(
      PROJECT_ROOT,
      process.env.NODE_ENV !== "production",
    );
    const v = (combinedEnv.UPLOAD_PROXY_URL ?? process.env.UPLOAD_PROXY_URL)?.trim();
    return v || undefined;
  } catch {
    return process.env.UPLOAD_PROXY_URL?.trim() || undefined;
  }
}

function readPublicAppUrl(): string | undefined {
  const raw = (process.env.PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL)?.trim();
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    url.pathname = url.pathname.replace(/\/+$/, "");
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return undefined;
  }
}

function extractPublicUrl(j: Record<string, unknown>): string | null {
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

function isSelfProxy(proxy: string | undefined, reqUrl: string) {
  if (!proxy) return true;
  try {
    const target = new URL(proxy);
    const current = new URL(reqUrl);
    const targetPath = target.pathname.replace(/\/+$/, "");
    if (targetPath !== "/upload") return false;
    if (target.origin === current.origin) return true;

    const targetPort = target.port || (target.protocol === "https:" ? "443" : "80");
    const currentPort = current.port || (current.protocol === "https:" ? "443" : "80");
    const targetIsLocal =
      target.hostname === "localhost" ||
      target.hostname === "127.0.0.1" ||
      target.hostname === "0.0.0.0";
    return targetIsLocal && targetPort === currentPort;
  } catch {
    return false;
  }
}

function extFromType(type: string) {
  if (type.includes("png")) return ".png";
  if (type.includes("webp")) return ".webp";
  if (type.includes("gif")) return ".gif";
  return ".jpg";
}

async function saveLocal(file: File) {
  await mkdir(UPLOADS_DIR, { recursive: true });
  const name = `${Date.now()}-${randomUUID()}${extFromType(file.type)}`;
  await writeFile(path.join(UPLOADS_DIR, name), Buffer.from(await file.arrayBuffer()));
  return `/uploads/broadcasts/${name}`;
}

/** HTTPS origin for image URLs (Telegram needs absolute links in production). */
function requestPublicOrigin(req: Request): string | undefined {
  try {
    const fromUrl = new URL(req.url);
    const host = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ?? req.headers.get("host") ?? fromUrl.host;
    const proto =
      req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? fromUrl.protocol.replace(":", "");
    if (!host || !proto) return undefined;
    return `${proto}://${host}`.replace(/\/+$/, "");
  } catch {
    return undefined;
  }
}

function resolvePublicAppUrl(req: Request): string | undefined {
  return readPublicAppUrl() ?? requestPublicOrigin(req);
}

function publicLocalUploadUrl(relativeUrl: string, req: Request): string | null {
  const publicAppUrl = resolvePublicAppUrl(req);
  if (!publicAppUrl) {
    return process.env.NODE_ENV === "production" ? null : relativeUrl;
  }
  if (process.env.NODE_ENV === "production" && !publicAppUrl.startsWith("https://")) {
    return null;
  }
  return `${publicAppUrl}${relativeUrl}`;
}

function isDeployReachableUrl(url: string): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (parsed.protocol !== "https:") return false;
    return host !== "localhost" && host !== "127.0.0.1" && host !== "0.0.0.0";
  } catch {
    return false;
  }
}

/**
 * POST /upload — multipart `file` → forwards to UPLOAD_PROXY_URL → JSON `{ url }`.
 * No Cloudinary in this app; configure your storage API URL server-side.
 */
/** Dev-only: curl GET /upload — checks whether proxy URL is loaded from .env* */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({
    uploadProxyConfigured: Boolean(readUploadProxyUrl()),
  });
}

export async function POST(req: Request) {
  const proxy = readUploadProxyUrl();
  const selfProxy = isSelfProxy(proxy, req.url);
  const publicAppUrlEnv = readPublicAppUrl();
  const publicAppUrlResolved = resolvePublicAppUrl(req);
  const requestOrigin = requestPublicOrigin(req);

  uploadDebug("post_start", {
    reqUrl: req.url,
    proxy: proxy ?? "(empty)",
    selfProxy,
    branch: selfProxy ? "local_public_uploads" : "proxy_upstream",
    NODE_ENV: process.env.NODE_ENV,
    PUBLIC_APP_URL_env: publicAppUrlEnv ?? "(unset)",
    publicAppUrlResolved: publicAppUrlResolved ?? "(null)",
    requestOrigin: requestOrigin ?? "(null)",
    uploadsDir: UPLOADS_DIR,
  });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonWithDebug(
      { error: "bad_request", detail: message },
      400,
      uploadDebug("formData_parse_failed", { message }),
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return jsonWithDebug(
      { error: "no_file", detail: `form field type: ${typeof file}` },
      400,
      uploadDebug("no_file", { keys: [...formData.keys()] }),
    );
  }

  uploadDebug("file_received", {
    name: file.name,
    type: file.type || "(empty)",
    size: file.size,
    isLikelyImage: isLikelyImage(file),
  });

  if (!isLikelyImage(file)) {
    return jsonWithDebug(
      { error: "not_image" },
      400,
      uploadDebug("not_image", { name: file.name, type: file.type }),
    );
  }
  if (file.size > MAX_BYTES) {
    return jsonWithDebug(
      { error: "too_large" },
      400,
      uploadDebug("too_large", { size: file.size, max: MAX_BYTES }),
    );
  }

  if (selfProxy) {
    uploadDebug("local_branch_enter", { uploadsDir: UPLOADS_DIR });
    try {
      const relativePath = await saveLocal(file);
      uploadDebug("local_save_ok", { relativePath });

      const localUrl = publicLocalUploadUrl(relativePath, req);
      uploadDebug("local_public_url", {
        relativePath,
        localUrl: localUrl ?? "(null)",
        publicAppUrlResolved: publicAppUrlResolved ?? "(null)",
      });

      if (!localUrl) {
        return jsonWithDebug(
          {
            error: "not_configured",
            detail:
              "Set PUBLIC_APP_URL to your HTTPS app URL (e.g. ngrok), or UPLOAD_PROXY_URL to external storage. UPLOAD_PROXY_URL can stay empty for local public/uploads.",
          },
          503,
          uploadDebug("local_url_null", {
            relativePath,
            publicAppUrlEnv: publicAppUrlEnv ?? "(unset)",
            requestOrigin: requestOrigin ?? "(null)",
          }),
        );
      }

      return jsonWithDebug(
        { url: localUrl },
        200,
        uploadDebug("local_success", { url: localUrl, relativePath }),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      return jsonWithDebug(
        { error: "upload_failed", detail: message },
        502,
        uploadDebug("local_save_failed", { message, stack }),
      );
    }
  }

  if (!proxy) {
    return jsonWithDebug(
      { error: "not_configured" },
      503,
      uploadDebug("proxy_missing", { selfProxy: false }),
    );
  }

  uploadDebug("proxy_branch_enter", { proxyTarget: proxy });

  const upstream = new FormData();
  upstream.append("file", file);
  upstream.append("files", file);

  const headers: HeadersInit = {};
  const auth = req.headers.get("authorization");
  if (auth) headers.Authorization = auth;

  let res: Response;
  try {
    res = await fetch(proxy, { method: "POST", body: upstream, headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonWithDebug(
      { error: "upload_failed", detail: message },
      502,
      uploadDebug("proxy_fetch_failed", { proxyTarget: proxy, message }),
    );
  }

  let body: Record<string, unknown>;
  let rawText = "";
  try {
    rawText = await res.text();
    body = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonWithDebug(
      { error: "upload_failed", detail: message },
      502,
      uploadDebug("proxy_json_parse_failed", {
        proxyTarget: proxy,
        upstreamStatus: res.status,
        rawTextPreview: rawText.slice(0, 500),
        message,
      }),
    );
  }

  uploadDebug("proxy_upstream_response", {
    proxyTarget: proxy,
    upstreamStatus: res.status,
    body,
    rawTextPreview: rawText.slice(0, 500),
  });

  if (!res.ok) {
    const upstreamStatus = res.status;
    const status =
      upstreamStatus >= 400 && upstreamStatus < 500 ? upstreamStatus : 502;
    const rawErr = typeof body.error === "string" ? body.error.trim() : "";
    const detail =
      rawErr && rawErr !== "not_configured" ? rawErr : undefined;
    return jsonWithDebug(
      { error: "upload_failed", detail },
      status,
      uploadDebug("proxy_upstream_not_ok", {
        proxyTarget: proxy,
        upstreamStatus,
        body,
      }),
    );
  }

  const url = extractPublicUrl(body);
  const reachable = url ? isDeployReachableUrl(url) : false;
  if (!url || !reachable) {
    return jsonWithDebug(
      { error: "bad_url", detail: url ?? "(extract failed)" },
      502,
      uploadDebug("proxy_bad_url", {
        proxyTarget: proxy,
        extractedUrl: url ?? "(null)",
        reachable,
        body,
      }),
    );
  }

  return jsonWithDebug(
    { url },
    200,
    uploadDebug("proxy_success", { url, proxyTarget: proxy }),
  );
}
