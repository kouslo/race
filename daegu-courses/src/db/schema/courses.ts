import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  date,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import {
  applyMethodEnum,
  courseCategoryEnum,
  courseStatusEnum,
} from "./enums";
import { institutions } from "./institutions";
import { crawlSources } from "./crawl-sources";

export type CourseScheduleSlot = {
  dayOfWeek: "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";
  startTime: string;
  endTime: string;
};

export const courses = pgTable(
  "courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => crawlSources.id, { onDelete: "cascade" }),
    externalId: varchar("external_id", { length: 200 }).notNull(),

    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    category: courseCategoryEnum("category").notNull().default("etc"),
    tags: text("tags").array().notNull().default(sql`ARRAY[]::text[]`),

    instructor: varchar("instructor", { length: 200 }),
    targetAudience: varchar("target_audience", { length: 200 }),
    capacity: integer("capacity"),
    enrolled: integer("enrolled"),

    fee: integer("fee").notNull().default(0),
    feeNote: varchar("fee_note", { length: 300 }),

    startDate: date("start_date"),
    endDate: date("end_date"),
    schedule: jsonb("schedule").$type<CourseScheduleSlot[]>(),
    totalSessions: integer("total_sessions"),

    applyStartAt: timestamp("apply_start_at", { withTimezone: true }),
    applyEndAt: timestamp("apply_end_at", { withTimezone: true }),
    applyMethod: applyMethodEnum("apply_method").notNull().default("online"),
    applyUrl: text("apply_url").notNull(),

    location: varchar("location", { length: 300 }),
    thumbnailUrl: text("thumbnail_url"),

    status: courseStatusEnum("status").notNull().default("upcoming"),
    rawData: jsonb("raw_data"),

    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),
  },
  (t) => [
    uniqueIndex("courses_institution_external_uq").on(t.institutionId, t.externalId),
    index("courses_status_apply_end_idx").on(t.status, t.applyEndAt),
    index("courses_category_idx").on(t.category),
    index("courses_start_date_idx").on(t.startDate),
    index("courses_institution_idx").on(t.institutionId),
  ],
);
