import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq, gt, isNull } from "drizzle-orm";
import { kakaoCallbackInput, refreshInput } from "@daegu-courses/api-schemas";
import { db } from "../db/client";
import { refreshTokens } from "../db/schema/auth";
import { users } from "../db/schema/users";
import { exchangeKakaoCode, verifyKakaoIdToken } from "../auth/kakao";
import { upsertUserFromProvider } from "../auth/users";
import {
  ACCESS_TTL_SEC,
  generateRefreshToken,
  hashToken,
  signAccessToken,
} from "../auth/jwt";
import { requireAuth, type AuthVars } from "../auth/middleware";
import { zErr } from "../context";

export const authRoute = new Hono<AuthVars>();

authRoute.post(
  "/kakao/callback",
  zValidator("json", kakaoCallbackInput, (r, c) =>
    r.success ? undefined : c.json(zErr(r.error.issues), 400),
  ),
  async (c) => {
    const input = c.req.valid("json");

    let kakaoTokens;
    let claims;
    try {
      kakaoTokens = await exchangeKakaoCode(input);
      claims = await verifyKakaoIdToken(kakaoTokens.id_token);
    } catch (err) {
      console.error("kakao callback failed", err);
      return c.json({ error: "kakao_auth_failed" }, 400);
    }

    const user = await upsertUserFromProvider({
      provider: "kakao",
      providerUserId: claims.sub,
      email: claims.email,
      nickname: claims.nickname,
      profileUrl: claims.picture,
    });

    const accessToken = await signAccessToken({ sub: user.id });
    const refresh = generateRefreshToken();
    await db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: refresh.hash,
      expiresAt: refresh.expiresAt,
      userAgent: c.req.header("user-agent") ?? null,
      ipAddress: c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });

    return c.json({
      accessToken,
      refreshToken: refresh.raw,
      accessTokenExpiresAt: new Date(Date.now() + ACCESS_TTL_SEC * 1000).toISOString(),
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        profileUrl: user.profileUrl,
        provider: user.provider,
      },
    });
  },
);

authRoute.post(
  "/refresh",
  zValidator("json", refreshInput, (r, c) =>
    r.success ? undefined : c.json(zErr(r.error.issues), 400),
  ),
  async (c) => {
    const { refreshToken } = c.req.valid("json");
    const tokenHash = hashToken(refreshToken);

    const [row] = await db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.tokenHash, tokenHash),
          gt(refreshTokens.expiresAt, new Date()),
          isNull(refreshTokens.revokedAt),
        ),
      );
    if (!row) return c.json({ error: "invalid_refresh_token" }, 401);

    // Rotate: revoke old, issue new.
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, row.id));

    const next = generateRefreshToken();
    await db.insert(refreshTokens).values({
      userId: row.userId,
      tokenHash: next.hash,
      expiresAt: next.expiresAt,
      userAgent: c.req.header("user-agent") ?? null,
      ipAddress: c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });

    const accessToken = await signAccessToken({ sub: row.userId });
    return c.json({
      accessToken,
      refreshToken: next.raw,
      accessTokenExpiresAt: new Date(Date.now() + ACCESS_TTL_SEC * 1000).toISOString(),
    });
  },
);

authRoute.post(
  "/logout",
  zValidator("json", refreshInput, (r, c) =>
    r.success ? undefined : c.json(zErr(r.error.issues), 400),
  ),
  async (c) => {
    const { refreshToken } = c.req.valid("json");
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.tokenHash, hashToken(refreshToken)));
    return c.json({ ok: true });
  },
);

authRoute.get("/me", requireAuth, async (c) => {
  const userId = c.var.userId;
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return c.json({ error: "not_found" }, 404);
  return c.json({
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    profileUrl: user.profileUrl,
    provider: user.provider,
  });
});
