import { and, eq, lt, inArray } from "drizzle-orm";
import type { DB } from "../db/client";
import { courses } from "../db/schema/courses";
import { events } from "../db/schema/events";
import type { ParsedCourse, ParsedEvent } from "./types";

export type UpsertStats = {
  found: number;
  created: number;
  updated: number;
  deactivated: number;
};

export async function upsertCourses(
  db: DB,
  institutionId: string,
  sourceId: string,
  parsed: ParsedCourse[],
  now: Date = new Date(),
): Promise<UpsertStats> {
  if (parsed.length === 0) {
    return { found: 0, created: 0, updated: 0, deactivated: 0 };
  }

  const rows = parsed.map((p) => ({
    institutionId,
    sourceId,
    externalId: p.externalId,
    title: p.title,
    description: p.description,
    category: p.category ?? ("etc" as const),
    tags: p.tags ?? [],
    instructor: p.instructor,
    targetAudience: p.targetAudience,
    capacity: p.capacity,
    enrolled: p.enrolled,
    fee: p.fee ?? 0,
    feeNote: p.feeNote,
    startDate: p.startDate,
    endDate: p.endDate,
    schedule: p.schedule,
    totalSessions: p.totalSessions,
    applyStartAt: p.applyStartAt,
    applyEndAt: p.applyEndAt,
    applyMethod: p.applyMethod ?? ("online" as const),
    applyUrl: p.applyUrl,
    location: p.location,
    thumbnailUrl: p.thumbnailUrl,
    status: p.status ?? ("upcoming" as const),
    rawData: p.rawData,
    firstSeenAt: now,
    lastSeenAt: now,
  }));

  const inserted = await db
    .insert(courses)
    .values(rows)
    .onConflictDoUpdate({
      target: [courses.institutionId, courses.externalId],
      set: {
        title: sqlExcluded("title"),
        description: sqlExcluded("description"),
        category: sqlExcluded("category"),
        tags: sqlExcluded("tags"),
        instructor: sqlExcluded("instructor"),
        targetAudience: sqlExcluded("target_audience"),
        capacity: sqlExcluded("capacity"),
        enrolled: sqlExcluded("enrolled"),
        fee: sqlExcluded("fee"),
        feeNote: sqlExcluded("fee_note"),
        startDate: sqlExcluded("start_date"),
        endDate: sqlExcluded("end_date"),
        schedule: sqlExcluded("schedule"),
        totalSessions: sqlExcluded("total_sessions"),
        applyStartAt: sqlExcluded("apply_start_at"),
        applyEndAt: sqlExcluded("apply_end_at"),
        applyMethod: sqlExcluded("apply_method"),
        applyUrl: sqlExcluded("apply_url"),
        location: sqlExcluded("location"),
        thumbnailUrl: sqlExcluded("thumbnail_url"),
        status: sqlExcluded("status"),
        rawData: sqlExcluded("raw_data"),
        lastSeenAt: now,
      },
    })
    .returning({ id: courses.id, firstSeenAt: courses.firstSeenAt });

  const created = inserted.filter((r) => r.firstSeenAt.getTime() === now.getTime()).length;
  const updated = inserted.length - created;

  // Soft-close: anything from this source not seen this run that is still open.
  const deact = await db
    .update(courses)
    .set({ status: "closed" })
    .where(
      and(
        eq(courses.sourceId, sourceId),
        lt(courses.lastSeenAt, now),
        inArray(courses.status, ["upcoming", "open"]),
      ),
    )
    .returning({ id: courses.id });

  return {
    found: parsed.length,
    created,
    updated,
    deactivated: deact.length,
  };
}

export async function upsertEvents(
  db: DB,
  institutionId: string,
  sourceId: string,
  parsed: ParsedEvent[],
  now: Date = new Date(),
): Promise<UpsertStats> {
  if (parsed.length === 0) {
    return { found: 0, created: 0, updated: 0, deactivated: 0 };
  }

  const rows = parsed.map((p) => ({
    institutionId,
    sourceId,
    externalId: p.externalId,
    title: p.title,
    description: p.description,
    category: p.category ?? ("etc" as const),
    tags: p.tags ?? [],
    thumbnailUrl: p.thumbnailUrl,
    eventStartAt: p.eventStartAt,
    eventEndAt: p.eventEndAt,
    location: p.location,
    isFree: p.isFree ?? true,
    fee: p.fee,
    needsReservation: p.needsReservation ?? false,
    reserveStartAt: p.reserveStartAt,
    reserveEndAt: p.reserveEndAt,
    reserveUrl: p.reserveUrl,
    status: p.status ?? ("upcoming" as const),
    rawData: p.rawData,
    firstSeenAt: now,
    lastSeenAt: now,
  }));

  const inserted = await db
    .insert(events)
    .values(rows)
    .onConflictDoUpdate({
      target: [events.institutionId, events.externalId],
      set: {
        title: sqlExcluded("title"),
        description: sqlExcluded("description"),
        category: sqlExcluded("category"),
        tags: sqlExcluded("tags"),
        thumbnailUrl: sqlExcluded("thumbnail_url"),
        eventStartAt: sqlExcluded("event_start_at"),
        eventEndAt: sqlExcluded("event_end_at"),
        location: sqlExcluded("location"),
        isFree: sqlExcluded("is_free"),
        fee: sqlExcluded("fee"),
        needsReservation: sqlExcluded("needs_reservation"),
        reserveStartAt: sqlExcluded("reserve_start_at"),
        reserveEndAt: sqlExcluded("reserve_end_at"),
        reserveUrl: sqlExcluded("reserve_url"),
        status: sqlExcluded("status"),
        rawData: sqlExcluded("raw_data"),
        lastSeenAt: now,
      },
    })
    .returning({ id: events.id, firstSeenAt: events.firstSeenAt });

  const created = inserted.filter((r) => r.firstSeenAt.getTime() === now.getTime()).length;
  const updated = inserted.length - created;

  const deact = await db
    .update(events)
    .set({ status: "ended" })
    .where(
      and(
        eq(events.sourceId, sourceId),
        lt(events.lastSeenAt, now),
        inArray(events.status, ["upcoming", "ongoing"]),
      ),
    )
    .returning({ id: events.id });

  return { found: parsed.length, created, updated, deactivated: deact.length };
}

import { sql } from "drizzle-orm";
function sqlExcluded(column: string) {
  return sql.raw(`excluded."${column}"`);
}
