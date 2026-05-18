import { getTelegramWebApp } from "@/lib/telegram/webapp";

const DEFAULT_FILE_NAME = "stamply-qr.png";

/** TEMPORARY — remove after QR save works in Telegram. */
const QR_DOWNLOAD_DEBUG = true;

type QrPlatform = "ios" | "android" | "desktop";

function dbg(message: string): void {
  if (!QR_DOWNLOAD_DEBUG) return;
  window.alert(message);
}

function detectQrPlatform(): QrPlatform {
  const tg = getTelegramWebApp();
  const platform = tg?.platform?.toLowerCase() ?? "";
  if (platform === "ios") return "ios";
  if (platform === "android") return "android";
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return "ios";
  if (/Android/i.test(navigator.userAgent)) return "android";
  return "desktop";
}

function downloadViaAnchor(blobUrl: string, fileName: string): void {
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function scheduleRevoke(blobUrl: string, delayMs: number): void {
  window.setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
  }, delayMs);
}

function openFullscreenSaveOverlay(blobUrl: string, onClose: () => void): void {
  document.getElementById("stamply-qr-save-overlay")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "stamply-qr-save-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "99999",
    background: "rgba(0,0,0,0.92)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px",
    boxSizing: "border-box",
  });

  const hint = document.createElement("p");
  hint.textContent = "Long-press the image to save";
  Object.assign(hint.style, {
    color: "#fff",
    fontSize: "14px",
    marginBottom: "12px",
    textAlign: "center",
  });

  const img = document.createElement("img");
  img.src = blobUrl;
  img.alt = "QR code";
  Object.assign(img.style, {
    maxWidth: "100%",
    maxHeight: "75vh",
    objectFit: "contain",
    background: "#fff",
    borderRadius: "12px",
    padding: "12px",
  });

  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Close";
  Object.assign(close.style, {
    marginTop: "16px",
    padding: "10px 20px",
    borderRadius: "10px",
    border: "none",
    background: "#0284C7",
    color: "#fff",
    fontSize: "14px",
    fontWeight: "600",
  });

  const remove = () => {
    overlay.remove();
    onClose();
  };
  close.addEventListener("click", remove);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) remove();
  });

  overlay.append(hint, img, close);
  document.body.appendChild(overlay);
}

function runBlobDownload(blob: Blob, fileName: string): void {
  dbg("blob created");

  const blobUrl = URL.createObjectURL(blob);
  dbg("blob URL created");

  const platform = detectQrPlatform();
  const inTelegram = Boolean(getTelegramWebApp());

  try {
    downloadViaAnchor(blobUrl, fileName);
    dbg("a.click executed");
  } catch {
    dbg("a.click failed");
  }

  if (platform === "ios") {
    openFullscreenSaveOverlay(blobUrl, () => URL.revokeObjectURL(blobUrl));
    return;
  }

  if (inTelegram) {
    const opened = window.open(blobUrl, "_blank");
    dbg(opened ? "fallback executed" : "fallback executed (popup blocked)");
    scheduleRevoke(blobUrl, opened ? 120_000 : 15_000);
    return;
  }

  scheduleRevoke(blobUrl, 60_000);
}

/** In-memory QR download via Blob URL (no /upload). */
export function downloadCanvasPng(
  canvas: HTMLCanvasElement,
  fileName: string = DEFAULT_FILE_NAME,
): void {
  canvas.toBlob(
    (blob) => {
      if (!blob) {
        dbg("blob failed");
        return;
      }
      runBlobDownload(blob, fileName);
    },
    "image/png",
    1,
  );
}
