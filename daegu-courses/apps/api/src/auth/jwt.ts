import { SignJWT, jwtVerify } from "jose";
import { createHash, randomBytes } from "node:crypto";

export const ACCESS_TTL_SEC = Number(process.env.ACCESS_TOKEN_TTL_SEC ?? 60 * 15);
export const REFRESH_TTL_SEC = Number(
  process.env.REFRESH_TOKEN_TTL_SEC ?? 60 * 60 * 24 * 30,
);
const ISSUER = "daegu-courses";

let cachedKey: Uint8Array | null = null;
function secret(): Uint8Array {
  if (cachedKey) return cachedKey;
  const raw = process.env.JWT_SECRET;
  if (!raw || raw.length < 32) {
    throw new Error("JWT_SECRET must be set and at least 32 chars");
  }
  cachedKey = new TextEncoder().encode(raw);
  return cachedKey;
}

export type AccessPayload = { sub: string };

export async function signAccessToken(payload: AccessPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setSubject(payload.sub)
    .setExpirationTime(`${ACCESS_TTL_SEC}s`)
    .sign(secret());
}

export async function verifyAccessToken(token: string): Promise<AccessPayload> {
  const { payload } = await jwtVerify(token, secret(), { issuer: ISSUER });
  if (typeof payload.sub !== "string") {
    throw new Error("token missing sub");
  }
  return { sub: payload.sub };
}

export function generateRefreshToken() {
  const raw = randomBytes(32).toString("base64url");
  return {
    raw,
    hash: hashToken(raw),
    expiresAt: new Date(Date.now() + REFRESH_TTL_SEC * 1000),
  };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
