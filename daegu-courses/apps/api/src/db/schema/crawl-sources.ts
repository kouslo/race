import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { contentTypeEnum, crawlStatusEnum } from "./enums";
import { institutions } from "./institutions";

export const crawlSources = pgTable(
  "crawl_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    sourceUrl: text("source_url").notNull(),
    adapterKey: varchar("adapter_key", { length: 100 }).notNull(),
    contentType: contentTypeEnum("content_type").notNull().default("course"),
    isActive: boolean("is_active").notNull().default(true),
    crawlIntervalMinutes: integer("crawl_interval_minutes").notNull().default(1440),
    lastCrawledAt: timestamp("last_crawled_at", { withTimezone: true }),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    lastErrorMessage: text("last_error_message"),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),
  },
  (t) => [
    index("crawl_sources_institution_idx").on(t.institutionId),
    index("crawl_sources_active_idx").on(t.isActive, t.lastCrawledAt),
  ],
);

export const crawlLogs = pgTable(
  "crawl_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => crawlSources.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    status: crawlStatusEnum("status").notNull(),
    itemsFound: integer("items_found").notNull().default(0),
    itemsCreated: integer("items_created").notNull().default(0),
    itemsUpdated: integer("items_updated").notNull().default(0),
    itemsDeactivated: integer("items_deactivated").notNull().default(0),
    errorMessage: text("error_message"),
  },
  (t) => [index("crawl_logs_source_idx").on(t.sourceId, t.startedAt)],
);
