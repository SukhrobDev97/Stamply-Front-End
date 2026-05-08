"use client";

import { ApolloProvider, useApolloClient } from "@apollo/client/react";
import { useMutation } from "@apollo/client/react";
import { apolloClient } from "@/lib/apollo/client";
import { TELEGRAM_LOGIN_MUTATION } from "@/graphql/mutations/telegramLogin.mutation";
import { PROFILE_QUERY } from "@/graphql/queries/profile.query";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AppModeProvider } from "@/lib/app-mode";

type AuthState = {
  accessToken: string | null;
  isAuthenticated: boolean;
  ready: boolean;
  role: string | null;
  userId: string | null;
  telegramId: string | null;
  loginWithTelegram: () => Promise<{ ok: true } | { ok: false; reason: string }>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within Providers");
  return ctx;
}

function AuthGate({
  children,
  accessToken,
  isAuthenticated,
  ready,
  role,
  userId,
  telegramId,
  setAccessToken,
  setIsAuthenticated,
  setReady,
  setRole,
  setUserId,
  setTelegramId,
  decodeJwtPayload,
}: {
  children: ReactNode;
  accessToken: string | null;
  isAuthenticated: boolean;
  ready: boolean;
  role: string | null;
  userId: string | null;
  telegramId: string | null;
  setAccessToken: (token: string | null) => void;
  setIsAuthenticated: (value: boolean) => void;
  setReady: (value: boolean) => void;
  setRole: (role: string | null) => void;
  setUserId: (id: string | null) => void;
  setTelegramId: (id: string | null) => void;
  decodeJwtPayload: (token: string) => any | null;
}) {
  const [telegramLogin] = useMutation(TELEGRAM_LOGIN_MUTATION);
  const client = useApolloClient();

  const loginWithTelegram = async () => {
    const tg = window.Telegram?.WebApp;
    const initData = tg?.initData ?? "";

    console.log("TG INIT DATA:", initData);
    console.log("SENDING LOGIN REQUEST");

    if (!initData) {
      return { ok: false as const, reason: "OPEN_IN_TELEGRAM" };
    }

    try {
      const res = await telegramLogin({
        variables: { initData },
      });

      const token = (res.data as any)?.telegramLogin?.accessToken as
        | string
        | undefined;

      if (!token) {
        return { ok: false as const, reason: "LOGIN_FAILED" };
      }

      const payload = decodeJwtPayload(token);

      localStorage.setItem("accessToken", token);
      setAccessToken(token);
      setIsAuthenticated(true);
      setRole(
        typeof payload?.role === "string"
          ? payload.role
          : typeof payload?.global_role === "string"
            ? payload.global_role
            : null
      );
      setUserId(payload?.sub != null ? String(payload.sub) : null);
      setTelegramId(payload?.telegram_id != null ? String(payload.telegram_id) : null);
      // Ensure business context (profile) is fresh right after login.
      try {
        await client.query({ query: PROFILE_QUERY, fetchPolicy: "network-only" });
      } catch {
        // ignore; RequireAuth/profile validation will handle invalid sessions
      }
      console.log("TOKEN AFTER LOGIN:", localStorage.getItem("accessToken"));
      return { ok: true as const };
    } catch (e) {
      console.log("LOGIN ERROR:", e);
      console.log("GRAPHQL ERROR:", (e as any)?.graphQLErrors);
      console.log("NETWORK ERROR:", (e as any)?.networkError);
      const msg = (e as any)?.message ? String((e as any).message) : "LOGIN_FAILED";
      return {
        ok: false as const,
        reason: msg.includes("USER_NOT_REGISTERED") ? "USER_NOT_REGISTERED" : msg,
      };
    }
  };

  const logout = async () => {
    try {
      localStorage.removeItem("accessToken");
    } catch {
      // ignore
    }
    try {
      await client.clearStore();
    } catch {
      // ignore
    }
    setAccessToken(null);
    setIsAuthenticated(false);
    setRole(null);
    setUserId(null);
    setTelegramId(null);
    setReady(true);
  };

  const authState: AuthState = useMemo(() => {
    return { accessToken, isAuthenticated, ready, role, userId, telegramId, loginWithTelegram, logout };
  }, [accessToken, isAuthenticated, ready, role, userId, telegramId]);

  return (
    <AuthContext.Provider value={authState}>{children}</AuthContext.Provider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  function decodeJwtPayload(token: string): any | null {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload;
    } catch {
      return null;
    }
  }

  const [accessToken, setAccessToken] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("accessToken");
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return !!localStorage.getItem("accessToken");
  });
  const [role, setRole] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const token = localStorage.getItem("accessToken");
    const payload = token ? decodeJwtPayload(token) : null;
    if (!payload) return null;
    return typeof payload.role === "string"
      ? payload.role
      : typeof payload.global_role === "string"
        ? payload.global_role
        : null;
  });
  const [userId, setUserId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const token = localStorage.getItem("accessToken");
    const payload = token ? decodeJwtPayload(token) : null;
    return payload?.sub != null ? String(payload.sub) : null;
  });
  const [telegramId, setTelegramId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const token = localStorage.getItem("accessToken");
    const payload = token ? decodeJwtPayload(token) : null;
    return payload?.telegram_id != null ? String(payload.telegram_id) : null;
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const savedToken = localStorage.getItem("accessToken");
    if (!savedToken) {
      setReady(true);
      return;
    }

    const payload = decodeJwtPayload(savedToken);

    setAccessToken(savedToken);
    setIsAuthenticated(true);
    setRole(
      typeof payload?.role === "string"
        ? payload.role
        : typeof payload?.global_role === "string"
          ? payload.global_role
          : null
    );
    setUserId(payload?.sub != null ? String(payload.sub) : null);
    setTelegramId(payload?.telegram_id != null ? String(payload.telegram_id) : null);
    setReady(true);
  }, []);

  useEffect(() => {
    const onInvalid = async () => {
      setAccessToken(null);
      setIsAuthenticated(false);
      setRole(null);
      setUserId(null);
      setTelegramId(null);
      setReady(true);
    };

    window.addEventListener("stamply:session-invalidated", onInvalid);
    return () => window.removeEventListener("stamply:session-invalidated", onInvalid);
  }, []);

  return (
    <AppModeProvider initialRole={role}>
      <ApolloProvider client={apolloClient}>
        <AuthGate
          accessToken={accessToken}
          isAuthenticated={isAuthenticated}
          ready={ready}
          role={role}
          userId={userId}
          telegramId={telegramId}
          setAccessToken={setAccessToken}
          setIsAuthenticated={setIsAuthenticated}
          setReady={setReady}
          setRole={setRole}
          setUserId={setUserId}
          setTelegramId={setTelegramId}
          decodeJwtPayload={decodeJwtPayload}
        >
          {children}
        </AuthGate>
      </ApolloProvider>
    </AppModeProvider>
  );
}
