import type { ApiError } from "@/lib/api/api-error";
import { RETRYABLE_HTTP_STATUSES } from "@/lib/api/api-error";

/** Backend HTTP envelope: { code, message, statusCode, requestId, details } */
export function parseHttpErrorBody(
  body: unknown,
  httpStatus?: number,
): ApiError | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;

  const legacyError = typeof o.error === "string" ? o.error.trim() : "";
  const code =
    typeof o.code === "string" && o.code.trim()
      ? o.code.trim()
      : legacyError
        ? legacyError.toUpperCase().replace(/-/g, "_")
        : null;
  if (!code) return null;

  const statusCode =
    typeof o.statusCode === "number"
      ? o.statusCode
      : httpStatus;
  const requestId =
    typeof o.requestId === "string" ? o.requestId : undefined;
  const message =
    typeof o.message === "string" && o.message.trim()
      ? o.message.trim()
      : code;

  return {
    code,
    message,
    statusCode,
    requestId,
    retryable:
      (statusCode != null && RETRYABLE_HTTP_STATUSES.has(statusCode)) ||
      code === "NETWORK_ERROR" ||
      code === "UPLOAD_FAILED",
  };
}
