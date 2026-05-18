"use client";

import { ApolloClient, HttpLink } from "@apollo/client";
import { createApolloCache } from "@/lib/apollo/cache";
import { setContext } from "@apollo/client/link/context";
import { ErrorLink } from "@apollo/client/link/error";
import { shouldLogoutForApiError } from "@/lib/auth-session-guard";
import { logEnvIssuesDev } from "@/lib/api/validate-env";

function resolveGraphqlUri(): string {
  const raw = process.env.NEXT_PUBLIC_GRAPHQL_URL?.trim();
  if (raw) return raw;
  return "/graphql";
}

const httpLink = new HttpLink({
  uri: resolveGraphqlUri(),
  credentials: "omit",
});

function invalidateSession() {
  try {
    localStorage.removeItem("accessToken");
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new Event("stamply:session-invalidated"));
  } catch {
    // ignore
  }
  try {
    if (typeof window !== "undefined" && window.location.pathname !== "/") {
      window.location.assign("/");
    }
  } catch {
    // ignore
  }
}

const authLink = setContext((_, { headers }) => {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;

  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : "",
    },
  };
});

let clientRef: ApolloClient | null = null;

const errorLink = new ErrorLink(({ error }) => {
  if (!shouldLogoutForApiError(error)) return;

  invalidateSession();
  void clientRef?.clearStore();
});

if (typeof window !== "undefined") {
  logEnvIssuesDev();
}

export const apolloClient = new ApolloClient({
  link: errorLink.concat(authLink).concat(httpLink),
  cache: createApolloCache(),
});

clientRef = apolloClient;
