export type { ApiError } from "@/lib/api/api-error";
export {
  isSessionInvalidCode,
  isRecoverableAuthCode,
  isBusinessInactiveCode,
  isRetryableApiError,
  SESSION_INVALID_CODES,
} from "@/lib/api/api-error";
export {
  normalizeApiError,
  normalizeApolloError,
  getPrimaryErrorCode,
  isApiError,
  isBusinessInactiveApiError,
} from "@/lib/api/normalize-api-error";
export {
  mapErrorCodeToMessage,
  mapApiErrorToUserMessage,
  userMessageFromUnknown,
} from "@/lib/api/map-error-code-to-message";
export { parseHttpErrorBody } from "@/lib/api/parse-http-error";
export { fetchWithTimeout, FetchTimeoutError } from "@/lib/api/fetch-with-timeout";
export { validateClientEnv } from "@/lib/api/validate-env";
