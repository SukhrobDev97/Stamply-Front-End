"use client";

import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { onError } from "@apollo/client/link/error";
import { shouldInvalidateStamplySession } from "@/lib/auth-session-guard";

const httpLink = new HttpLink({
  uri: process.env.NEXT_PUBLIC_GRAPHQL_URL,
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

  const hit = shouldInvalidateStamplySession(messages, status);
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
