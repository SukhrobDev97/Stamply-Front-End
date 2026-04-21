"use client";

import { ApolloProvider } from "@apollo/client/react";
import { useMutation } from "@apollo/client/react";
import { apolloClient } from "@/lib/apollo/client";
import { TELEGRAM_LOGIN_MUTATION } from "@/graphql/mutations/telegramLogin.mutation";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type AuthState = {
  accessToken: string | null;
  isAuthenticated: boolean;
  role: string | null;
  loginWithTelegram: () => Promise<void>;
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
  role,
  setAccessToken,
  setIsAuthenticated,
  setRole,
  decodeJwtPayload,
}: {
  children: ReactNode;
  accessToken: string | null;
  isAuthenticated: boolean;
  role: string | null;
  setAccessToken: (token: string | null) => void;
  setIsAuthenticated: (value: boolean) => void;
  setRole: (role: string | null) => void;
  decodeJwtPayload: (token: string) => any | null;
}) {
  const [telegramLogin] = useMutation(TELEGRAM_LOGIN_MUTATION);

  const loginWithTelegram = async () => {
    const tg = window.Telegram?.WebApp;

    if (!tg?.initData) {
      alert("Open inside Telegram");
      return;
    }

    try {
      const res = await telegramLogin({
        variables: { initData: tg.initData },
      });

      const token = (res.data as any)?.telegramLogin?.accessToken as
        | string
        | undefined;

      if (!token) {
        alert("Login failed");
        return;
      }

      const payload = decodeJwtPayload(token);
      console.log("DECODED TOKEN:", payload);

      localStorage.setItem("accessToken", token);
      setAccessToken(token);
      setIsAuthenticated(true);
      setRole(typeof payload?.role === "string" ? payload.role : null);

      console.log("LOGIN SUCCESS", token);
    } catch (e) {
      console.error("LOGIN ERROR", e);
      alert("Auth error");
    }
  };

  const authState: AuthState = useMemo(() => {
    return { accessToken, isAuthenticated, role, loginWithTelegram };
  }, [accessToken, isAuthenticated, role]);

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
    return typeof payload?.role === "string" ? payload.role : null;
  });

  useEffect(() => {
    const savedToken = localStorage.getItem("accessToken");
    if (!savedToken) return;

    const payload = decodeJwtPayload(savedToken);

    setAccessToken(savedToken);
    setIsAuthenticated(true);
    setRole(typeof payload?.role === "string" ? payload.role : null);
  }, []);

  const authState = useMemo<AuthState>(() => {
    return {
      accessToken,
      isAuthenticated,
      role,
      loginWithTelegram: async () => {},
    };
  }, [accessToken, isAuthenticated, role]);

  return (
    <ApolloProvider client={apolloClient}>
      <AuthGate
        accessToken={accessToken}
        isAuthenticated={isAuthenticated}
        role={role}
        setAccessToken={setAccessToken}
        setIsAuthenticated={setIsAuthenticated}
        setRole={setRole}
        decodeJwtPayload={decodeJwtPayload}
      >
        {children}
      </AuthGate>
    </ApolloProvider>
  );
}
