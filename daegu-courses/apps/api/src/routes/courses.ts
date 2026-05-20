import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, asc, count, desc, eq, gt, ilike, inArray, lte, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client";
import { courses } from "../db/schema/courses";
import { institutions } from "../db/schema/institutions";
import { coursesListQuery, type ListResponse } from "@daegu-courses/api-schemas";
import { zErr } from "../context";

export const coursesRoute = new Hono();

coursesRoute.get(
  "/",
  zValidator("query", coursesListQuery, (r, c) =>
    r.success ? undefined : c.json(zErr(r.error.issues), 400),
  ),
  async (c) => {
    const q = c.req.valid("query");

    const filters = [];
    if (q.q) {
      filters.push(
        or(ilike(courses.title, `%${q.q}%`), ilike(courses.description, `%${q.q}%`)),
      );
    }
    if (q.category) filters.push(eq(courses.category, q.category));
    if (q.institutionId) filters.push(eq(courses.institutionId, q.institutionId));
    if (q.status) filters.push(eq(courses.status, q.status));
    if (q.free === true) filters.push(eq(courses.fee, 0));
    if (q.applyOpen) {
      const now = new Date();
      filters.push(lte(courses.applyStartAt, now));
      filters.push(gt(courses.applyEndAt, now));
    }
    if (q.district) filters.push(eq(institutions.district, q.district));

    const where = filters.length ? and(...filters) : undefined;

    const orderBy =
      q.sort === "applyEndSoon"
        ? asc(courses.applyEndAt)
        : q.sort === "startDate"
          ? asc(courses.startDate)
          : q.sort === "relevance" && q.q
            ? sql`greatest(similarity(${courses.title}, ${q.q}), similarity(coalesce(${courses.description}, ''), ${q.q})) desc`
            : desc(courses.updatedAt);

    const offset = (q.page - 1) * q.pageSize;

    const [rows, totalRow] = await Promise.all([
      db
        .select({
          id: courses.id,
          title: courses.title,
          category: courses.category,
          status: courses.status,
          fee: courses.fee,
          startDate: courses.startDate,
          endDate: courses.endDate,
          applyStartAt: courses.applyStartAt,
          applyEndAt: courses.applyEndAt,
          schedule: courses.schedule,
          capacity: courses.capacity,
          enrolled: courses.enrolled,
          thumbnailUrl: courses.thumbnailUrl,
          applyUrl: courses.applyUrl,
          institution: {
            id: institutions.id,
            name: institutions.name,
            district: institutions.district,
          },
        })
        .from(courses)
        .innerJoin(institutions, eq(courses.institutionId, institutions.id))
        .where(where)
        .orderBy(orderBy)
        .limit(q.pageSize)
        .offset(offset),
      db
        .select({ total: count() })
        .from(courses)
        .innerJoin(institutions, eq(courses.institutionId, institutions.id))
        .where(where),
    ]);
    const total = totalRow[0]?.total ?? 0;

    const body: ListResponse<(typeof rows)[number]> = {
      items: rows,
      page: q.page,
      pageSize: q.pageSize,
      total,
      hasMore: offset + rows.length < total,
    };
    return c.json(body);
  },
);

/**
 * Lightweight autocomplete endpoint for the search box.
 * Uses pg_trgm `similarity()` for ranking (see SEARCH.md), backed by
 * the GIN index on `courses.title`. Returns at most 8 currently open
 * or upcoming courses.
 */
const suggestQuery = z.object({
  q: z.string().trim().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

coursesRoute.get(
  "/suggest",
  zValidator("query", suggestQuery, (r, c) =>
    r.success ? undefined : c.json(zErr(r.error.issues), 400),
  ),
  async (c) => {
    const { q, limit } = c.req.valid("query");
    const rows = await db
      .select({
        id: courses.id,
        title: courses.title,
        status: courses.status,
        fee: courses.fee,
        institutionName: institutions.name,
        district: institutions.district,
      })
      .from(courses)
      .innerJoin(institutions, eq(courses.institutionId, institutions.id))
      .where(
        and(
          ilike(courses.title, `%${q}%`),
          inArray(courses.status, ["open", "upcoming"]),
        ),
      )
      .orderBy(sql`similarity(${courses.title}, ${q}) desc`)
      .limit(limit);

    return c.json({
      items: rows.map((r) => ({
        id: r.id,
        title: r.title,
        status: r.status,
        fee: r.fee,
        institution: { name: r.institutionName, district: r.district },
      })),
    });
  },
);

coursesRoute.get(
  "/:id",
  zValidator("param", z.object({ id: z.string().uuid() }), (r, c) =>
    r.success ? undefined : c.json(zErr(r.error.issues), 400),
  ),
  async (c) => {
    const { id } = c.req.valid("param");
    const [row] = await db
      .select({
        course: courses,
        institution: {
          id: institutions.id,
          name: institutions.name,
          district: institutions.district,
          address: institutions.address,
          homepageUrl: institutions.homepageUrl,
        },
      })
      .from(courses)
      .innerJoin(institutions, eq(courses.institutionId, institutions.id))
      .where(eq(courses.id, id));

    if (!row) return c.json({ error: "not_found" }, 404);
    return c.json(row);
  },
);

/**
 * Similar courses for the detail page. Strategy:
 *   1) same category & same district & open (best match)
 *   2) fall back to same category & open across districts
 *   3) finally same district & open
 * Always excludes the source course itself; capped at 6.
 */
coursesRoute.get(
  "/:id/similar",
  zValidator("param", z.object({ id: z.string().uuid() }), (r, c) =>
    r.success ? undefined : c.json(zErr(r.error.issues), 400),
  ),
  async (c) => {
    const { id } = c.req.valid("param");
    const [source] = await db
      .select({
        category: courses.category,
        district: institutions.district,
        institutionId: courses.institutionId,
      })
      .from(courses)
      .innerJoin(institutions, eq(courses.institutionId, institutions.id))
      .where(eq(courses.id, id));
    if (!source) return c.json({ items: [] });

    const limit = 6;
    const select = () =>
      db
        .select({
          id: courses.id,
          title: courses.title,
          category: courses.category,
          status: courses.status,
          fee: courses.fee,
          startDate: courses.startDate,
          endDate: courses.endDate,
          applyStartAt: courses.applyStartAt,
          applyEndAt: courses.applyEndAt,
          schedule: courses.schedule,
          capacity: courses.capacity,
          enrolled: courses.enrolled,
          thumbnailUrl: courses.thumbnailUrl,
          applyUrl: courses.applyUrl,
          institution: {
            id: institutions.id,
            name: institutions.name,
            district: institutions.district,
          },
        })
        .from(courses)
        .innerJoin(institutions, eq(courses.institutionId, institutions.id));

    const baseFilters = [ne(courses.id, id), eq(courses.status, "open" as const)];

    let rows = await select()
      .where(
        and(
          ...baseFilters,
          eq(courses.category, source.category),
          eq(institutions.district, source.district),
        ),
      )
      .orderBy(desc(courses.updatedAt))
      .limit(limit);

    if (rows.length < limit) {
      const extras = await select()
        .where(and(...baseFilters, eq(courses.category, source.category)))
        .orderBy(desc(courses.updatedAt))
        .limit(limit);
      const seen = new Set(rows.map((r) => r.id));
      for (const e of extras) {
        if (rows.length >= limit) break;
        if (!seen.has(e.id)) rows.push(e);
      }
    }

    if (rows.length < limit) {
      const extras = await select()
        .where(and(...baseFilters, eq(institutions.district, source.district)))
        .orderBy(desc(courses.updatedAt))
        .limit(limit);
      const seen = new Set(rows.map((r) => r.id));
      for (const e of extras) {
        if (rows.length >= limit) break;
        if (!seen.has(e.id)) rows.push(e);
      }
    }

    return c.json({ items: rows });
  },
);
