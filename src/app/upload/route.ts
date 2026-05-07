import { loadEnvConfig } from "@next/env";
import { NextResponse } from "next/server";
import path from "path";
import { fileURLToPath } from "url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 2 * 1024 * 1024;

/** Project root (cwd can differ under some runners; route lives at src/app/upload). */
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

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

function extractPublicUrl(j: Record<string, unknown>): string | null {
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
  if (!proxy) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no_file" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "not_image" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 400 });
  }

  const upstream = new FormData();
  upstream.append("file", file);

  const headers: HeadersInit = {};
  const auth = req.headers.get("authorization");
  if (auth) headers.Authorization = auth;

  let res: Response;
  try {
    res = await fetch(proxy, { method: "POST", body: upstream, headers });
  } catch {
    return NextResponse.json({ error: "upload_failed" }, { status: 502 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "upload_failed" }, { status: 502 });
  }

  if (!res.ok) {
    // Never forward upstream 5xx as 503 with arbitrary `error` — client maps 503+`not_configured`
    // to “set UPLOAD_PROXY_URL”, but that string may come from the storage API, not this app.
    const upstreamStatus = res.status;
    const status =
      upstreamStatus >= 400 && upstreamStatus < 500 ? upstreamStatus : 502;
    const rawErr = typeof body.error === "string" ? body.error.trim() : "";
    const detail =
      rawErr && rawErr !== "not_configured" ? rawErr : undefined;
    return NextResponse.json({ error: "upload_failed", detail }, { status });
  }

  const url = extractPublicUrl(body);
  if (!url) {
    return NextResponse.json({ error: "bad_url" }, { status: 502 });
  }

  return NextResponse.json({ url });
}
