import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { courseCategoryEnum, eventStatusEnum } from "./enums";
import { institutions } from "./institutions";
import { crawlSources } from "./crawl-sources";

export const events = pgTable(
  "events",
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
    thumbnailUrl: text("thumbnail_url"),

    eventStartAt: timestamp("event_start_at", { withTimezone: true }).notNull(),
    eventEndAt: timestamp("event_end_at", { withTimezone: true }),
    location: varchar("location", { length: 300 }).notNull(),

    isFree: boolean("is_free").notNull().default(true),
    fee: integer("fee"),

    needsReservation: boolean("needs_reservation").notNull().default(false),
    reserveStartAt: timestamp("reserve_start_at", { withTimezone: true }),
    reserveEndAt: timestamp("reserve_end_at", { withTimezone: true }),
    reserveUrl: text("reserve_url"),

    status: eventStatusEnum("status").notNull().default("upcoming"),
    rawData: jsonb("raw_data"),

    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),
  },
  (t) => [
    uniqueIndex("events_institution_external_uq").on(t.institutionId, t.externalId),
    index("events_status_start_idx").on(t.status, t.eventStartAt),
    index("events_category_idx").on(t.category),
    index("events_start_idx").on(t.eventStartAt),
    // Trigram GIN indexes — requires pg_trgm.
    index("events_title_trgm_idx").using("gin", sql`${t.title} gin_trgm_ops`),
    index("events_description_trgm_idx").using(
      "gin",
      sql`coalesce(${t.description}, '') gin_trgm_ops`,
    ),
  ],
);
