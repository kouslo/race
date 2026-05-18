import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Web fallback: SecureStore isn't available — Expo Web uses localStorage.
 * Acceptable for dev/demo; production web uses Next.js cookies anyway.
 */
const webStore: typeof SecureStore = {
  ...(SecureStore as object),
  getItemAsync: async (key) =>
    typeof window === "undefined" ? null : window.localStorage.getItem(key),
  setItemAsync: async (key, value) => {
    if (typeof window !== "undefined") window.localStorage.setItem(key, value);
  },
  deleteItemAsync: async (key) => {
    if (typeof window !== "undefined") window.localStorage.removeItem(key);
  },
} as typeof SecureStore;

const store = Platform.OS === "web" ? webStore : SecureStore;

export const ACCESS_KEY = "dc_at";
export const REFRESH_KEY = "dc_rt";
export const EXPIRES_KEY = "dc_at_exp";

export async function loadSession(): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
} | null> {
  const [accessToken, refreshToken, exp] = await Promise.all([
    store.getItemAsync(ACCESS_KEY),
    store.getItemAsync(REFRESH_KEY),
    store.getItemAsync(EXPIRES_KEY),
  ]);
  if (!accessToken || !refreshToken) return null;
  return {
    accessToken,
    refreshToken,
    expiresAt: exp ? Number(exp) : 0,
  };
}

export async function saveSession(tokens: {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
}) {
  const expMs = String(new Date(tokens.accessTokenExpiresAt).getTime());
  await Promise.all([
    store.setItemAsync(ACCESS_KEY, tokens.accessToken),
    store.setItemAsync(REFRESH_KEY, tokens.refreshToken),
    store.setItemAsync(EXPIRES_KEY, expMs),
  ]);
}

export async function clearSession() {
  await Promise.all([
    store.deleteItemAsync(ACCESS_KEY),
    store.deleteItemAsync(REFRESH_KEY),
    store.deleteItemAsync(EXPIRES_KEY),
  ]);
}
