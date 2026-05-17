import type { MiddlewareHandler } from "hono";
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
