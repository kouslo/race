import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client";
import { favorites } from "../db/schema/users";
import { courses } from "../db/schema/courses";
import { events } from "../db/schema/events";
import { institutions } from "../db/schema/institutions";
import { favoriteCreate } from "@daegu-courses/api-schemas";
import { zErr } from "../context";
import { requireAuth, type AuthVars } from "../auth/middleware";

export const favoritesRoute = new Hono<AuthVars>();
favoritesRoute.use("*", requireAuth);

favoritesRoute.get("/", async (c) => {
  const userId = c.var.userId;

  // Drizzle's nested select doesn't support double-nesting cleanly,
  // so we select a flat row and reshape into the public {target, institution}
  // structure here in JS.
  const courseRows = await db
    .select({
      favId: favorites.id,
      favCreatedAt: favorites.createdAt,
      courseId: courses.id,
      title: courses.title,
      status: courses.status,
      startDate: courses.startDate,
      applyEndAt: courses.applyEndAt,
      applyUrl: courses.applyUrl,
      institutionId: institutions.id,
      institutionName: institutions.name,
    })
    .from(favorites)
    .innerJoin(courses, eq(favorites.targetId, courses.id))
    .innerJoin(institutions, eq(courses.institutionId, institutions.id))
    .where(and(eq(favorites.userId, userId), eq(favorites.targetType, "course")))
    .orderBy(desc(favorites.createdAt));

  const eventRows = await db
    .select({
      favId: favorites.id,
      favCreatedAt: favorites.createdAt,
      eventId: events.id,
      title: events.title,
      eventStartAt: events.eventStartAt,
      location: events.location,
      reserveUrl: events.reserveUrl,
      institutionId: institutions.id,
      institutionName: institutions.name,
    })
    .from(favorites)
    .innerJoin(events, eq(favorites.targetId, events.id))
    .innerJoin(institutions, eq(events.institutionId, institutions.id))
    .where(and(eq(favorites.userId, userId), eq(favorites.targetType, "event")))
    .orderBy(desc(favorites.createdAt));

  return c.json({
    courses: courseRows.map((r) => ({
      id: r.favId,
      createdAt: r.favCreatedAt,
      target: {
        id: r.courseId,
        title: r.title,
        status: r.status,
        startDate: r.startDate,
        applyEndAt: r.applyEndAt,
        applyUrl: r.applyUrl,
        institution: { id: r.institutionId, name: r.institutionName },
      },
    })),
    events: eventRows.map((r) => ({
      id: r.favId,
      createdAt: r.favCreatedAt,
      target: {
        id: r.eventId,
        title: r.title,
        eventStartAt: r.eventStartAt,
        location: r.location,
        reserveUrl: r.reserveUrl,
        institution: { id: r.institutionId, name: r.institutionName },
      },
    })),
  });
});

favoritesRoute.post(
  "/",
  zValidator("json", favoriteCreate, (r, c) =>
    r.success ? undefined : c.json(zErr(r.error.issues), 400),
  ),
  async (c) => {
    const userId = c.var.userId;
    const body = c.req.valid("json");

    if (body.targetType === "course") {
      const [exists] = await db
        .select({ id: courses.id })
        .from(courses)
        .where(eq(courses.id, body.targetId));
      if (!exists) return c.json({ error: "course_not_found" }, 404);
    } else {
      const [exists] = await db
        .select({ id: events.id })
        .from(events)
        .where(eq(events.id, body.targetId));
      if (!exists) return c.json({ error: "event_not_found" }, 404);
    }

    const [row] = await db
      .insert(favorites)
      .values({ userId, targetType: body.targetType, targetId: body.targetId })
      .onConflictDoNothing()
      .returning();

    return c.json(row ?? { ok: true });
  },
);

favoritesRoute.delete(
  "/:id",
  zValidator("param", z.object({ id: z.string().uuid() }), (r, c) =>
    r.success ? undefined : c.json(zErr(r.error.issues), 400),
  ),
  async (c) => {
    const userId = c.var.userId;
    const { id } = c.req.valid("param");
    const deleted = await db
      .delete(favorites)
      .where(and(eq(favorites.id, id), eq(favorites.userId, userId)))
      .returning({ id: favorites.id });
    if (deleted.length === 0) return c.json({ error: "not_found" }, 404);
    return c.json({ ok: true });
  },
);
