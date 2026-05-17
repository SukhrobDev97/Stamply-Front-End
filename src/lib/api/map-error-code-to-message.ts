import { mapErrorCodeToMessage as mapFromCopy } from "@/app/profile/error-copy";
import type { ProfileLang } from "@/app/profile/copy";
import type { ApiError } from "@/lib/api/api-error";
import { normalizeApiError } from "@/lib/api/normalize-api-error";

export function mapErrorCodeToMessage(code: string, lang: ProfileLang = "uz"): string {
  return mapFromCopy(code, lang);
}

export function mapApiErrorToUserMessage(err: ApiError, lang: ProfileLang = "uz"): string {
  return mapFromCopy(err.code, lang);
}

export function userMessageFromUnknown(err: unknown, lang: ProfileLang = "uz"): string {
  return mapApiErrorToUserMessage(normalizeApiError(err), lang);
}
