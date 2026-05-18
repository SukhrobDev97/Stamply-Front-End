import type { TrialWarningKind } from "@/lib/trial/get-trial-warning-state";

const PREFIX = "stamply:trial-warn-dismiss";

function localDayKey(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function storageKey(businessId: number, kind: TrialWarningKind): string {
  return `${PREFIX}:${businessId}:${kind}:${localDayKey()}`;
}

export function isTrialWarningDismissed(businessId: number, kind: TrialWarningKind): boolean {
  try {
    return sessionStorage.getItem(storageKey(businessId, kind)) === "1";
  } catch {
    return false;
  }
}

export function dismissTrialWarning(businessId: number, kind: TrialWarningKind): void {
  try {
    sessionStorage.setItem(storageKey(businessId, kind), "1");
  } catch {
    // ignore
  }
}
