import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client";
import { pushTokens } from "../db/schema/push";
import { pushTokenRegister } from "@daegu-courses/api-schemas";
import { requireAuth, type AuthVars } from "../auth/middleware";
import { zErr } from "../context";

export const pushRoute = new Hono<AuthVars>();
pushRoute.use("*", requireAuth);

pushRoute.get("/tokens", async (c) => {
  const rows = await db
    .select({
      id: pushTokens.id,
      platform: pushTokens.platform,
      isActive: pushTokens.isActive,
      lastUsedAt: pushTokens.lastUsedAt,
      createdAt: pushTokens.createdAt,
    })
    .from(pushTokens)
    .where(eq(pushTokens.userId, c.var.userId));
  return c.json({ items: rows });
});

pushRoute.post(
  "/tokens",
  zValidator("json", pushTokenRegister, (r, c) =>
    r.success ? undefined : c.json(zErr(r.error.issues), 400),
  ),
  async (c) => {
    const body = c.req.valid("json");
    const userId = c.var.userId;
    const now = new Date();

    const [row] = await db
      .insert(pushTokens)
      .values({
        userId,
        token: body.token,
        platform: body.platform,
        deviceId: body.deviceId ?? null,
        isActive: true,
        lastUsedAt: now,
      })
      .onConflictDoUpdate({
        target: pushTokens.token,
        set: { userId, platform: body.platform, isActive: true, lastUsedAt: now },
      })
      .returning();

    return c.json(row);
  },
);

pushRoute.delete(
  "/tokens/:id",
  zValidator("param", z.object({ id: z.string().uuid() }), (r, c) =>
    r.success ? undefined : c.json(zErr(r.error.issues), 400),
  ),
  async (c) => {
    const { id } = c.req.valid("param");
    const deleted = await db
      .delete(pushTokens)
      .where(and(eq(pushTokens.id, id), eq(pushTokens.userId, c.var.userId)))
      .returning({ id: pushTokens.id });
    if (deleted.length === 0) return c.json({ error: "not_found" }, 404);
    return c.json({ ok: true });
  },
);
