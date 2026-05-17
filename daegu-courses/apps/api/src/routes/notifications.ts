import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client";
import { notificationSubscriptions } from "../db/schema/users";
import { notificationDeliveries } from "../db/schema/push";
import { subscriptionCreate } from "@daegu-courses/api-schemas";
import { requireAuth, type AuthVars } from "../auth/middleware";
import { zErr } from "../context";

export const notificationsRoute = new Hono<AuthVars>();
notificationsRoute.use("*", requireAuth);

notificationsRoute.get("/subscriptions", async (c) => {
  const rows = await db
    .select()
    .from(notificationSubscriptions)
    .where(eq(notificationSubscriptions.userId, c.var.userId))
    .orderBy(desc(notificationSubscriptions.createdAt));
  return c.json({ items: rows });
});

notificationsRoute.post(
  "/subscriptions",
  zValidator("json", subscriptionCreate, (r, c) =>
    r.success ? undefined : c.json(zErr(r.error.issues), 400),
  ),
  async (c) => {
    const body = c.req.valid("json");
    const userId = c.var.userId;

    const [row] = await db
      .insert(notificationSubscriptions)
      .values({
        userId,
        type: body.type,
        category: body.category ?? null,
        targetType: body.targetType ?? null,
        targetId: body.targetId ?? null,
      })
      .returning();
    return c.json(row);
  },
);

notificationsRoute.delete(
  "/subscriptions/:id",
  zValidator("param", z.object({ id: z.string().uuid() }), (r, c) =>
    r.success ? undefined : c.json(zErr(r.error.issues), 400),
  ),
  async (c) => {
    const { id } = c.req.valid("param");
    const deleted = await db
      .delete(notificationSubscriptions)
      .where(
        and(
          eq(notificationSubscriptions.id, id),
          eq(notificationSubscriptions.userId, c.var.userId),
        ),
      )
      .returning({ id: notificationSubscriptions.id });
    if (deleted.length === 0) return c.json({ error: "not_found" }, 404);
    return c.json({ ok: true });
  },
);

notificationsRoute.get("/deliveries", async (c) => {
  const rows = await db
    .select()
    .from(notificationDeliveries)
    .where(eq(notificationDeliveries.userId, c.var.userId))
    .orderBy(desc(notificationDeliveries.sentAt))
    .limit(50);
  return c.json({ items: rows });
});
