import { CombinedGraphQLErrors, ServerError } from "@apollo/client/errors";
import type { ApiError } from "@/lib/api/api-error";
import { isBusinessInactiveCode } from "@/lib/api/api-error";
import { parseGraphQLErrors } from "@/lib/api/parse-graphql-error";
import { parseHttpErrorBody } from "@/lib/api/parse-http-error";

const NETWORK_ERROR: ApiError = {
  code: "NETWORK_ERROR",
  message: "Network request failed",
  retryable: true,
};

export function normalizeApiError(err: unknown): ApiError {
  if (isApiError(err)) return err;

  const apollo = normalizeApolloError(err);
  if (apollo) return apollo;

  if (err instanceof Error && err.message) {
    return {
      code: "UNKNOWN_ERROR",
      message: err.message,
      retryable: false,
    };
  }

  return {
    code: "UNKNOWN_ERROR",
    message: "Unknown error",
    retryable: false,
  };
}

export function isApiError(v: unknown): v is ApiError {
  return (
    !!v &&
    typeof v === "object" &&
    typeof (v as ApiError).code === "string" &&
    typeof (v as ApiError).message === "string"
  );
}

function parseServerErrorBody(err: ServerError): ApiError | null {
  try {
    const parsed = JSON.parse(err.bodyText) as unknown;
    return parseHttpErrorBody(parsed, err.statusCode);
  } catch {
    // ignore invalid JSON
  }
  if (err.statusCode === 401) {
    return { code: "UNAUTHORIZED", message: "Unauthorized", statusCode: 401, retryable: false };
  }
  if (err.statusCode >= 500) {
    return {
      code: "NETWORK_ERROR",
      message: "Upstream unavailable",
      statusCode: err.statusCode,
      retryable: true,
    };
  }
  return null;
}

/** Normalize Apollo Client errors using backend extensions.code. */
export function normalizeApolloError(err: unknown): ApiError | null {
  if (CombinedGraphQLErrors.is(err)) {
    return parseGraphQLErrors(err.errors);
  }
  if (ServerError.is(err)) {
    return parseServerErrorBody(err);
  }

  if (!err || typeof err !== "object") return null;
  const e = err as {
    graphQLErrors?: readonly {
      message?: string;
      extensions?: {
        code?: string;
        statusCode?: number;
        requestId?: string;
      };
    }[];
    networkError?: {
      statusCode?: number;
      status?: number;
      result?: unknown;
      bodyText?: string;
    };
  };

  const gql = parseGraphQLErrors(e.graphQLErrors);
  if (gql) return gql;

  const ne = e.networkError;
  if (ne) {
    const status = ne.statusCode ?? ne.status;
    const fromBody = parseHttpErrorBody(ne.result, status);
    if (fromBody) return fromBody;
    if (status === 401) {
      return {
        code: "UNAUTHORIZED",
        message: "Unauthorized",
        statusCode: 401,
        retryable: false,
      };
    }
    if (status != null && status >= 500) {
      return {
        code: "NETWORK_ERROR",
        message: "Upstream unavailable",
        statusCode: status,
        retryable: true,
      };
    }
    return NETWORK_ERROR;
  }

  return null;
}

export function getPrimaryErrorCode(err: unknown): string {
  return normalizeApiError(err).code;
}

export function isBusinessInactiveApiError(err: unknown): boolean {
  const api = normalizeApolloError(err) ?? (isApiError(err) ? err : null);
  return api ? isBusinessInactiveCode(api.code) : false;
}
