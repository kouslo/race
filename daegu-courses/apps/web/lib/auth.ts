import { cookies } from "next/headers";

const ACCESS_COOKIE = "dc_at";
const REFRESH_COOKIE = "dc_rt";

const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;

export type SessionTokens = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
};

export async function setSessionCookies(tokens: SessionTokens) {
  const jar = await cookies();
  const secure = process.env.NODE_ENV === "production";
  const accessMaxAge = Math.max(
    1,
    Math.floor((new Date(tokens.accessTokenExpiresAt).getTime() - Date.now()) / 1000),
  );
  jar.set(ACCESS_COOKIE, tokens.accessToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: accessMaxAge,
  });
  jar.set(REFRESH_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_MAX_AGE,
  });
}

export async function clearSessionCookies() {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
}

export async function getAccessToken(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(ACCESS_COOKIE)?.value;
}

export async function getRefreshToken(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(REFRESH_COOKIE)?.value;
}
