import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, asc, count, desc, eq, gt, ilike, lte, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/client";
import { courses } from "../../db/schema/courses";
import { institutions } from "../../db/schema/institutions";
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
          : desc(courses.updatedAt);

    const offset = (q.page - 1) * q.pageSize;

    const [rows, [{ total }]] = await Promise.all([
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
