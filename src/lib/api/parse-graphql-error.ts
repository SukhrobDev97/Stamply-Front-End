import type { ApiError } from "@/lib/api/api-error";
import { RETRYABLE_HTTP_STATUSES } from "@/lib/api/api-error";

type GraphQLErrorLike = {
  message?: string;
  extensions?: {
    code?: string;
    statusCode?: number;
    requestId?: string;
    details?: unknown;
  };
};

export function parseGraphQLErrorEntry(entry: GraphQLErrorLike | undefined | null): ApiError | null {
  if (!entry) return null;
  const ext = entry.extensions;
  const code =
    typeof ext?.code === "string" && ext.code.trim()
      ? ext.code.trim()
      : "GRAPHQL_ERROR";
  const statusCode =
    typeof ext?.statusCode === "number"
      ? ext.statusCode
      : undefined;
  const requestId =
    typeof ext?.requestId === "string" ? ext.requestId : undefined;
  const message =
    typeof entry.message === "string" && entry.message.trim()
      ? entry.message.trim()
      : code;

  return {
    code,
    message,
    statusCode,
    requestId,
    retryable: statusCode != null && RETRYABLE_HTTP_STATUSES.has(statusCode),
  };
}

export function parseGraphQLErrors(
  errors: readonly GraphQLErrorLike[] | undefined | null,
): ApiError | null {
  if (!errors?.length) return null;
  return parseGraphQLErrorEntry(errors[0]) ?? null;
}
