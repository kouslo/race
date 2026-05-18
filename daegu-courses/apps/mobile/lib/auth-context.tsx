import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createClient, type ApiClient } from "@daegu-courses/api-client";
import type { AuthSession, AuthUser } from "@daegu-courses/api-schemas";
import Constants from "expo-constants";
import {
  clearSession,
  loadSession,
  saveSession,
} from "./secure-storage";

const baseUrl =
  (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl ??
  "http://localhost:3000";

type Tokens = { accessToken: string; refreshToken: string; expiresAt: number };

type AuthState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "authenticated"; user: AuthUser; tokens: Tokens };

type AuthContextValue = {
  state: AuthState;
  api: ApiClient;
  signIn: (session: AuthSession) => Promise<void>;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const REFRESH_BUFFER_MS = 60_000; // refresh 1 min before expiry

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const tokensRef = useRef<Tokens | null>(null);
  const refreshInflight = useRef<Promise<string | null> | null>(null);

  // ApiClient that always sends the current access token, refreshing if needed.
  const api = useMemo<ApiClient>(
    () =>
      createClient({
        baseUrl,
        accessToken: async () => {
          const t = tokensRef.current;
          if (!t) return undefined;
          if (Date.now() >= t.expiresAt - REFRESH_BUFFER_MS) {
            const next = await refreshTokens();
            return next ?? undefined;
          }
          return t.accessToken;
        },
      }),
    [],
  );

  const refreshTokens = useCallback(async (): Promise<string | null> => {
    if (refreshInflight.current) return refreshInflight.current;
    const t = tokensRef.current;
    if (!t) return null;
    refreshInflight.current = (async () => {
      try {
        const res = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: t.refreshToken }),
        });
        if (!res.ok) throw new Error(`refresh ${res.status}`);
        const data = (await res.json()) as {
          accessToken: string;
          refreshToken: string;
          accessTokenExpiresAt: string;
        };
        tokensRef.current = {
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          expiresAt: new Date(data.accessTokenExpiresAt).getTime(),
        };
        await saveSession(data);
        return data.accessToken;
      } catch (err) {
        console.warn("token refresh failed", err);
        tokensRef.current = null;
        await clearSession();
        setState({ status: "anonymous" });
        return null;
      } finally {
        refreshInflight.current = null;
      }
    })();
    return refreshInflight.current;
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const user = await api.auth.me();
      const t = tokensRef.current;
      if (!t) {
        setState({ status: "anonymous" });
        return;
      }
      setState({ status: "authenticated", user, tokens: t });
    } catch {
      setState({ status: "anonymous" });
    }
  }, [api]);

  // Bootstrap session from secure storage on app start.
  useEffect(() => {
    (async () => {
      const saved = await loadSession();
      if (!saved) {
        setState({ status: "anonymous" });
        return;
      }
      tokensRef.current = saved;
      await refreshMe();
    })();
  }, [refreshMe]);

  const signIn = useCallback(async (session: AuthSession) => {
    tokensRef.current = {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt: new Date(session.accessTokenExpiresAt).getTime(),
    };
    await saveSession(session);
    setState({ status: "authenticated", user: session.user, tokens: tokensRef.current });
  }, []);

  const signOut = useCallback(async () => {
    const t = tokensRef.current;
    if (t) {
      try {
        await fetch(`${baseUrl}/api/v1/auth/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: t.refreshToken }),
        });
      } catch {
        /* ignore — local logout always succeeds */
      }
    }
    tokensRef.current = null;
    await clearSession();
    setState({ status: "anonymous" });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ state, api, signIn, signOut, refreshMe }),
    [state, api, signIn, signOut, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
}
