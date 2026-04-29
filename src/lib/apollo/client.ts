"use client";

import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { onError } from "@apollo/client/link/error";

const httpLink = new HttpLink({
  uri: process.env.NEXT_PUBLIC_GRAPHQL_URL,
  credentials: "omit",
});

function shouldInvalidateSession(message: string | undefined | null) {
  const m = String(message ?? "");
  return (
    m.includes("Unauthorized") ||
    m.includes("Session outdated") ||
    m.includes("Missing business_id") ||
    m.includes("Business not found for current user")
  );
}

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
  // Redirect to login entry point without forcing reload loops.
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

  // Temporary debug log (remove later).
  console.log("TOKEN SENT:", token);

  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : "",
    },
  };
});

let clientRef: ApolloClient | null = null;

// Apollo version in this repo has narrower `onError` typings; keep runtime behavior.
const errorLink = onError((opts: any) => {
  const graphQLErrors = opts?.graphQLErrors as Array<{ message?: string }> | undefined;
  const networkError = opts?.networkError as { message?: string; statusCode?: number; status?: number } | undefined;
  const messages: string[] = [];
  for (const e of graphQLErrors ?? []) messages.push(e?.message ?? "");
  if (networkError && typeof (networkError as any).message === "string") {
    messages.push((networkError as any).message);
  }

  const status =
    (networkError as any)?.statusCode ??
    (networkError as any)?.status ??
    (networkError as any)?.response?.status;

  const hit = messages.some((m) => shouldInvalidateSession(m)) || status === 401;
  if (!hit) return;

  invalidateSession();
  // Best-effort clear cache so stale UI disappears.
  void clientRef?.clearStore();
});

export const apolloClient = new ApolloClient({
  link: errorLink.concat(authLink).concat(httpLink),
  cache: new InMemoryCache(),
});

clientRef = apolloClient;
