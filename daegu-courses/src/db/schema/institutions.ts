import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  varchar,
  text,
  decimal,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { daeguDistrictEnum, institutionTypeEnum } from "./enums";

export const institutions = pgTable(
  "institutions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 200 }).notNull().unique(),
    type: institutionTypeEnum("type").notNull(),
    district: daeguDistrictEnum("district").notNull(),
    address: text("address"),
    lat: decimal("lat", { precision: 10, scale: 7 }),
    lng: decimal("lng", { precision: 10, scale: 7 }),
    phone: varchar("phone", { length: 30 }),
    homepageUrl: text("homepage_url").notNull(),
    logoUrl: text("logo_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),
  },
  (t) => [
    index("institutions_district_idx").on(t.district),
    index("institutions_type_idx").on(t.type),
  ],
);
