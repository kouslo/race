import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { institutions } from "../db/schema/institutions";
import { institutionsListQuery } from "@daegu-courses/api-schemas";
import { zErr } from "../context";

export const institutionsRoute = new Hono();

institutionsRoute.get(
  "/",
  zValidator("query", institutionsListQuery, (r, c) =>
    r.success ? undefined : c.json(zErr(r.error.issues), 400),
  ),
  async (c) => {
    const q = c.req.valid("query");
    const filters = [];
    if (q.district) filters.push(eq(institutions.district, q.district));
    if (q.type) filters.push(eq(institutions.type, q.type));
    const where = filters.length ? and(...filters) : undefined;

    const rows = await db
      .select()
      .from(institutions)
      .where(where)
      .orderBy(asc(institutions.name));

    return c.json({ items: rows });
  },
);
