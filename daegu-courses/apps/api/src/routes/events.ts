import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, asc, count, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client";
import { events } from "../db/schema/events";
import { institutions } from "../db/schema/institutions";
import { eventsListQuery, type ListResponse } from "@daegu-courses/api-schemas";
import { zErr } from "../context";

export const eventsRoute = new Hono();

eventsRoute.get(
  "/",
  zValidator("query", eventsListQuery, (r, c) =>
    r.success ? undefined : c.json(zErr(r.error.issues), 400),
  ),
  async (c) => {
    const q = c.req.valid("query");

    const filters = [];
    if (q.q) {
      filters.push(
        or(ilike(events.title, `%${q.q}%`), ilike(events.description, `%${q.q}%`)),
      );
    }
    if (q.category) filters.push(eq(events.category, q.category));
    if (q.institutionId) filters.push(eq(events.institutionId, q.institutionId));
    if (q.from) filters.push(gte(events.eventStartAt, q.from));
    if (q.to) filters.push(lte(events.eventStartAt, q.to));
    if (q.district) filters.push(eq(institutions.district, q.district));

    const where = filters.length ? and(...filters) : undefined;
    const orderBy =
      q.sort === "recent"
        ? desc(events.updatedAt)
        : q.sort === "relevance" && q.q
          ? sql`greatest(similarity(${events.title}, ${q.q}), similarity(coalesce(${events.description}, ''), ${q.q})) desc`
          : asc(events.eventStartAt);
    const offset = (q.page - 1) * q.pageSize;

    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          id: events.id,
          title: events.title,
          category: events.category,
          status: events.status,
          eventStartAt: events.eventStartAt,
          eventEndAt: events.eventEndAt,
          location: events.location,
          isFree: events.isFree,
          fee: events.fee,
          needsReservation: events.needsReservation,
          reserveUrl: events.reserveUrl,
          thumbnailUrl: events.thumbnailUrl,
          institution: {
            id: institutions.id,
            name: institutions.name,
            district: institutions.district,
          },
        })
        .from(events)
        .innerJoin(institutions, eq(events.institutionId, institutions.id))
        .where(where)
        .orderBy(orderBy)
        .limit(q.pageSize)
        .offset(offset),
      db
        .select({ total: count() })
        .from(events)
        .innerJoin(institutions, eq(events.institutionId, institutions.id))
        .where(where),
    ]);

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

eventsRoute.get(
  "/:id",
  zValidator("param", z.object({ id: z.string().uuid() }), (r, c) =>
    r.success ? undefined : c.json(zErr(r.error.issues), 400),
  ),
  async (c) => {
    const { id } = c.req.valid("param");
    const [row] = await db
      .select({
        event: events,
        institution: {
          id: institutions.id,
          name: institutions.name,
          district: institutions.district,
          address: institutions.address,
          homepageUrl: institutions.homepageUrl,
        },
      })
      .from(events)
      .innerJoin(institutions, eq(events.institutionId, institutions.id))
      .where(eq(events.id, id));

    if (!row) return c.json({ error: "not_found" }, 404);
    return c.json(row);
  },
);
