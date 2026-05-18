export type ApiError = {
  code: string;
  message: string;
  statusCode?: number;
  requestId?: string;
  retryable?: boolean;
};

/** Session must be cleared — logout / redirect home. */
export const SESSION_INVALID_CODES = new Set([
  "TOKEN_EXPIRED",
  "UNAUTHORIZED",
  "INVALID_SESSION",
]);

/** Profile/workspace recoverable — do not logout. */
export const RECOVERABLE_AUTH_CODES = new Set([
  "MEMBERSHIP_NOT_FOUND",
  "MISSING_BUSINESS_ID",
  "BUSINESS_NOT_FOUND",
  "BUSINESS_NOT_FOUND_FOR_USER",
]);

/** Business cannot be used — show inactive UX, do not logout. */
export const BUSINESS_ACCESS_BLOCKED_CODES = new Set([
  "TRIAL_EXPIRED",
  "BUSINESS_DEACTIVATED",
  "BUSINESS_INACTIVE",
  "BUSINESS_BLOCKED",
  "SUBSCRIPTION_EXPIRED",
]);

/** @deprecated Use BUSINESS_ACCESS_BLOCKED_CODES */
export const BUSINESS_INACTIVE_CODES = BUSINESS_ACCESS_BLOCKED_CODES;

export const RETRYABLE_HTTP_STATUSES = new Set([408, 429, 502, 503, 504]);

export function isSessionInvalidCode(code: string): boolean {
  return SESSION_INVALID_CODES.has(code);
}

export function isRecoverableAuthCode(code: string): boolean {
  return RECOVERABLE_AUTH_CODES.has(code);
}

export function isBusinessAccessBlockedCode(code: string): boolean {
  return BUSINESS_ACCESS_BLOCKED_CODES.has(code);
}

/** @deprecated Use isBusinessAccessBlockedCode */
export function isBusinessInactiveCode(code: string): boolean {
  return isBusinessAccessBlockedCode(code);
}

export function isRetryableApiError(err: ApiError): boolean {
  if (err.retryable === true) return true;
  if (err.statusCode && RETRYABLE_HTTP_STATUSES.has(err.statusCode)) return true;
  return err.code === "NETWORK_ERROR" || err.code === "UPLOAD_FAILED";
}
