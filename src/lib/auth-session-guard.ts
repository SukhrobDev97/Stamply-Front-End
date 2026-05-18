import { ServerError } from "@apollo/client/errors";
import {
  isRecoverableAuthCode,
  isSessionInvalidCode,
  type ApiError,
} from "@/lib/api/api-error";
import { normalizeApolloError } from "@/lib/api/normalize-api-error";

export function getApolloPrimaryError(err: unknown): ApiError | null {
  return normalizeApolloError(err);
}

export function profileApolloErrorOnlyRecoverable(err: unknown): boolean {
  const api = getApolloPrimaryError(err);
  if (!api) return false;
  return isRecoverableAuthCode(api.code);
}

/** @deprecated Use isSessionInvalidCode via getApolloPrimaryError */
export function shouldInvalidateStamplySession(_messages: string[], httpStatus: number | undefined): boolean {
  if (httpStatus === 401) return true;
  return false;
}

export function shouldDestroySessionForProfileError(err: unknown): boolean {
  if (!err) return false;
  if (profileApolloErrorOnlyRecoverable(err)) return false;
  const api = getApolloPrimaryError(err);
  if (api) return isSessionInvalidCode(api.code);
  if (ServerError.is(err) && err.statusCode === 401) return true;
  const e = err as { networkError?: { statusCode?: number; status?: number } };
  const status = e.networkError?.statusCode ?? e.networkError?.status;
  return status === 401;
}

export function shouldLogoutForApiError(err: unknown): boolean {
  const api = getApolloPrimaryError(err);
  if (!api) return false;
  return isSessionInvalidCode(api.code);
}

export {
  isBusinessAccessBlockedError,
  isBusinessInactiveApiError,
} from "@/lib/business-lifecycle";
