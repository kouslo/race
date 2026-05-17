import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * Kakao OIDC client.
 *   discovery: https://kauth.kakao.com/.well-known/openid-configuration
 */
const ISSUER = "https://kauth.kakao.com";
const TOKEN_URL = "https://kauth.kakao.com/oauth/token";
const JWKS_URL = "https://kauth.kakao.com/.well-known/jwks.json";

const jwks = createRemoteJWKSet(new URL(JWKS_URL));

export type KakaoTokenResponse = {
  access_token: string;
  refresh_token: string;
  id_token: string;
  token_type: string;
  expires_in: number;
  refresh_token_expires_in: number;
  scope: string;
};

export type KakaoIdClaims = {
  sub: string;
  email?: string;
  nickname?: string;
  picture?: string;
  iss: string;
  aud: string | string[];
  exp: number;
  iat: number;
  nonce?: string;
};

function clientId() {
  const v = process.env.KAKAO_REST_API_KEY;
  if (!v) throw new Error("KAKAO_REST_API_KEY is not set");
  return v;
}

export async function exchangeKakaoCode(input: {
  code: string;
  redirectUri: string;
  codeVerifier?: string;
}): Promise<KakaoTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId(),
    redirect_uri: input.redirectUri,
    code: input.code,
  });
  if (process.env.KAKAO_CLIENT_SECRET) {
    body.set("client_secret", process.env.KAKAO_CLIENT_SECRET);
  }
  if (input.codeVerifier) body.set("code_verifier", input.codeVerifier);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Kakao token exchange failed: ${res.status} ${text}`);
  }
  return (await res.json()) as KakaoTokenResponse;
}

export async function verifyKakaoIdToken(idToken: string): Promise<KakaoIdClaims> {
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: ISSUER,
    audience: clientId(),
  });
  return payload as unknown as KakaoIdClaims;
}
