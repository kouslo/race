import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import {
  favoriteTargetEnum,
  notificationChannelEnum,
  notificationTypeEnum,
  pushPlatformEnum,
} from "./enums";
import { users } from "./users";

export const pushTokens = pgTable(
  "push_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Provider-specific token. For Expo: "ExponentPushToken[...]" */
    token: text("token").notNull(),
    platform: pushPlatformEnum("platform").notNull(),
    deviceId: varchar("device_id", { length: 200 }),
    isActive: boolean("is_active").notNull().default(true),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("push_tokens_token_uq").on(t.token),
    index("push_tokens_user_idx").on(t.userId, t.isActive),
  ],
);

/**
 * Each row represents one notification we have already sent.
 * Unique on (userId, kind, targetType, targetId) so re-running the
 * dispatcher never sends the same notification twice.
 */
export const notificationDeliveries = pgTable(
  "notification_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: notificationTypeEnum("kind").notNull(),
    targetType: favoriteTargetEnum("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    channel: notificationChannelEnum("channel").notNull(),
    pushTicketId: text("push_ticket_id"),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("notification_deliveries_uq").on(t.userId, t.kind, t.targetType, t.targetId),
    index("notification_deliveries_sent_idx").on(t.sentAt),
  ],
);
