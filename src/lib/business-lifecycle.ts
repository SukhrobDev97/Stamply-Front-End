import { isBusinessAccessBlockedCode } from "@/lib/api/api-error";
import { normalizeApiError, normalizeApolloError } from "@/lib/api/normalize-api-error";

/** Workspace row status when business cannot be used (ACTIVE | DEACTIVATED backend). */
export function isWorkspaceDeactivatedStatus(status?: string | null): boolean {
  const s = String(status ?? "").toLowerCase();
  return s === "deactivated" || s === "blocked";
}

export function getBusinessAccessBlockCode(err: unknown): string | null {
  const api = normalizeApolloError(err) ?? normalizeApiError(err);
  if (!api || !isBusinessAccessBlockedCode(api.code)) return null;
  return api.code;
}

export function isBusinessAccessBlockedError(err: unknown): boolean {
  return getBusinessAccessBlockCode(err) != null;
}

/** @deprecated Use isBusinessAccessBlockedError */
export const isBusinessInactiveApiError = isBusinessAccessBlockedError;

export function shouldBlockBusinessAccess(opts: {
  error?: unknown;
  workspaceStatus?: string | null;
  activeBusinessId?: number | null;
  hasWorkspaceRow?: boolean;
}): boolean {
  if (isBusinessAccessBlockedError(opts.error)) return true;
  if (
    opts.activeBusinessId != null &&
    opts.hasWorkspaceRow !== false &&
    isWorkspaceDeactivatedStatus(opts.workspaceStatus)
  ) {
    return true;
  }
  return false;
}
