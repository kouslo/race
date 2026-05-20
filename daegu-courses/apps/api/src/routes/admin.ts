import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { asc, desc, eq, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import {
  crawlSourceCreate,
  crawlSourceUpdate,
  institutionCreate,
  institutionUpdate,
} from "@daegu-courses/api-schemas";
import { db } from "../db/client";
import { institutions } from "../db/schema/institutions";
import { crawlLogs, crawlSources } from "../db/schema/crawl-sources";
import { courses } from "../db/schema/courses";
import { events } from "../db/schema/events";
import { listAdapters, getAdapter } from "../crawler/registry";
import { runSource } from "../crawler/runner";
import { requireAdmin, requireAuth, type AuthVars } from "../auth/middleware";
import { zErr } from "../context";

export const adminRoute = new Hono<AuthVars>();
adminRoute.use("*", requireAuth, requireAdmin);

/* ─────────── institutions ─────────── */

adminRoute.get("/institutions", async (c) => {
  const rows = await db.select().from(institutions).orderBy(asc(institutions.name));
  return c.json({ items: rows });
});

adminRoute.post(
  "/institutions",
  zValidator("json", institutionCreate, (r, c) =>
    r.success ? undefined : c.json(zErr(r.error.issues), 400),
  ),
  async (c) => {
    const body = c.req.valid("json");
    try {
      const [row] = await db
        .insert(institutions)
        .values({
          name: body.name,
          slug: body.slug,
          type: body.type,
          district: body.district,
          address: body.address ?? null,
          lat: body.lat?.toString() ?? null,
          lng: body.lng?.toString() ?? null,
          phone: body.phone ?? null,
          homepageUrl: body.homepageUrl,
          logoUrl: body.logoUrl ?? null,
        })
        .returning();
      return c.json(row, 201);
    } catch (err) {
      console.error(err);
      return c.json({ error: "create_failed" }, 400);
    }
  },
);

adminRoute.patch(
  "/institutions/:id",
  zValidator("param", z.object({ id: z.string().uuid() }), (r, c) =>
    r.success ? undefined : c.json(zErr(r.error.issues), 400),
  ),
  zValidator("json", institutionUpdate, (r, c) =>
    r.success ? undefined : c.json(zErr(r.error.issues), 400),
  ),
  async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const [row] = await db
      .update(institutions)
      .set({
        ...body,
        lat: body.lat?.toString(),
        lng: body.lng?.toString(),
      })
      .where(eq(institutions.id, id))
      .returning();
    if (!row) return c.json({ error: "not_found" }, 404);
    return c.json(row);
  },
);

adminRoute.delete(
  "/institutions/:id",
  zValidator("param", z.object({ id: z.string().uuid() }), (r, c) =>
    r.success ? undefined : c.json(zErr(r.error.issues), 400),
  ),
  async (c) => {
    const { id } = c.req.valid("param");
    const deleted = await db
      .delete(institutions)
      .where(eq(institutions.id, id))
      .returning({ id: institutions.id });
    if (deleted.length === 0) return c.json({ error: "not_found" }, 404);
    return c.json({ ok: true });
  },
);

/* ─────────── crawl sources ─────────── */

adminRoute.get("/adapters", (c) => {
  return c.json({
    items: listAdapters().map((a) => ({
      key: a.key,
      name: a.name,
      contentType: a.contentType,
    })),
  });
});

adminRoute.get("/crawl-sources", async (c) => {
  const institutionId = c.req.query("institutionId");
  const where = institutionId ? eq(crawlSources.institutionId, institutionId) : undefined;
  const rows = await db
    .select({
      source: crawlSources,
      institution: {
        id: institutions.id,
        name: institutions.name,
        district: institutions.district,
      },
    })
    .from(crawlSources)
    .innerJoin(institutions, eq(crawlSources.institutionId, institutions.id))
    .where(where)
    .orderBy(asc(institutions.name));
  return c.json({ items: rows });
});

adminRoute.post(
  "/crawl-sources",
  zValidator("json", crawlSourceCreate, (r, c) =>
    r.success ? undefined : c.json(zErr(r.error.issues), 400),
  ),
  async (c) => {
    const body = c.req.valid("json");
    try {
      getAdapter(body.adapterKey);
    } catch {
      return c.json(
        { error: "unknown_adapter_key", available: listAdapters().map((a) => a.key) },
        400,
      );
    }
    const [institution] = await db
      .select({ id: institutions.id })
      .from(institutions)
      .where(eq(institutions.id, body.institutionId));
    if (!institution) return c.json({ error: "institution_not_found" }, 404);

    const [row] = await db
      .insert(crawlSources)
      .values({
        institutionId: body.institutionId,
        sourceUrl: body.sourceUrl,
        adapterKey: body.adapterKey,
        contentType: body.contentType,
        crawlIntervalMinutes: body.crawlIntervalMinutes,
        isActive: body.isActive,
      })
      .returning();
    return c.json(row, 201);
  },
);

adminRoute.patch(
  "/crawl-sources/:id",
  zValidator("param", z.object({ id: z.string().uuid() }), (r, c) =>
    r.success ? undefined : c.json(zErr(r.error.issues), 400),
  ),
  zValidator("json", crawlSourceUpdate, (r, c) =>
    r.success ? undefined : c.json(zErr(r.error.issues), 400),
  ),
  async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    if (body.adapterKey) {
      try {
        getAdapter(body.adapterKey);
      } catch {
        return c.json({ error: "unknown_adapter_key" }, 400);
      }
    }
    const [row] = await db
      .update(crawlSources)
      .set(body)
      .where(eq(crawlSources.id, id))
      .returning();
    if (!row) return c.json({ error: "not_found" }, 404);
    return c.json(row);
  },
);

adminRoute.delete(
  "/crawl-sources/:id",
  zValidator("param", z.object({ id: z.string().uuid() }), (r, c) =>
    r.success ? undefined : c.json(zErr(r.error.issues), 400),
  ),
  async (c) => {
    const { id } = c.req.valid("param");
    const deleted = await db
      .delete(crawlSources)
      .where(eq(crawlSources.id, id))
      .returning({ id: crawlSources.id });
    if (deleted.length === 0) return c.json({ error: "not_found" }, 404);
    return c.json({ ok: true });
  },
);

adminRoute.post(
  "/crawl-sources/:id/crawl",
  zValidator("param", z.object({ id: z.string().uuid() }), (r, c) =>
    r.success ? undefined : c.json(zErr(r.error.issues), 400),
  ),
  async (c) => {
    const { id } = c.req.valid("param");
    try {
      const stats = await runSource(db, id);
      return c.json({ ok: true, stats });
    } catch (err) {
      return c.json(
        { ok: false, error: err instanceof Error ? err.message : String(err) },
        500,
      );
    }
  },
);

/* ─────────── logs / stats ─────────── */

adminRoute.get("/crawl-logs", async (c) => {
  const sourceId = c.req.query("sourceId");
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);
  const where = sourceId ? eq(crawlLogs.sourceId, sourceId) : undefined;
  const rows = await db
    .select()
    .from(crawlLogs)
    .where(where)
    .orderBy(desc(crawlLogs.startedAt))
    .limit(limit);
  return c.json({ items: rows });
});

adminRoute.get("/stats", async (c) => {
  const [instRow] = await db.select({ n: countStar() }).from(institutions);
  const [srcRow] = await db.select({ n: countStar() }).from(crawlSources);
  const [courseRow] = await db.select({ n: countStar() }).from(courses);
  const [eventRow] = await db.select({ n: countStar() }).from(events);
  return c.json({
    institutions: Number(instRow?.n ?? 0),
    crawlSources: Number(srcRow?.n ?? 0),
    courses: Number(courseRow?.n ?? 0),
    events: Number(eventRow?.n ?? 0),
  });
});

function countStar(): SQL<number> {
  return sql<number>`count(*)::int`;
}
