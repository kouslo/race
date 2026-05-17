import type { MiddlewareHandler } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { users } from "../db/schema/users";
import { verifyAccessToken } from "./jwt";

export type AuthVars = { Variables: { userId: string } };

export const requireAuth: MiddlewareHandler<AuthVars> = async (c, next) => {
  const header = c.req.header("authorization");
  if (!header || !header.toLowerCase().startsWith("bearer ")) {
    return c.json({ error: "unauthorized" }, 401);
  }
  const token = header.slice(7).trim();
  try {
    const { sub } = await verifyAccessToken(token);
    c.set("userId", sub);
    await next();
  } catch {
    return c.json({ error: "unauthorized" }, 401);
  }
};

/** Must follow requireAuth. Checks users.isAdmin. */
export const requireAdmin: MiddlewareHandler<AuthVars> = async (c, next) => {
  const userId = c.var.userId;
  if (!userId) return c.json({ error: "unauthorized" }, 401);
  const [user] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, userId));
  if (!user?.isAdmin) return c.json({ error: "forbidden" }, 403);
  await next();
};
