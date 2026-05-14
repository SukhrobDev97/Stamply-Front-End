import { loadEnvConfig } from "@next/env";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { NextResponse } from "next/server";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 2 * 1024 * 1024;

const PROJECT_ROOT = process.cwd();
const UPLOADS_DIR = path.join(PROJECT_ROOT, "public", "uploads", "broadcasts");

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

function publicLocalUploadUrl(relativeUrl: string): string | null {
  const publicAppUrl = readPublicAppUrl();
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

  if (isSelfProxy(proxy, req.url)) {
    try {
      if (process.env.NODE_ENV === "production" && !readPublicAppUrl()?.startsWith("https://")) {
        return NextResponse.json(
          { error: "not_configured", detail: "Use Cloudinary/S3 or set PUBLIC_APP_URL to an HTTPS host that serves /uploads." },
          { status: 503 },
        );
      }
      const localUrl = publicLocalUploadUrl(await saveLocal(file));
      if (!localUrl) {
        return NextResponse.json(
          { error: "not_configured", detail: "Use Cloudinary/S3 or set PUBLIC_APP_URL to an HTTPS host that serves /uploads." },
          { status: 503 },
        );
      }
      return NextResponse.json({ url: localUrl });
    } catch {
      return NextResponse.json({ error: "upload_failed" }, { status: 502 });
    }
  }

  if (!proxy) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const upstream = new FormData();
  upstream.append("file", file);
  upstream.append("files", file);

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
  if (!url || !isDeployReachableUrl(url)) {
    return NextResponse.json({ error: "bad_url" }, { status: 502 });
  }

  return NextResponse.json({ url });
}
