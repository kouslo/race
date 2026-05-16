import type { CourseScheduleSlot } from "../db/schema/courses";

export type ParsedCourse = {
  externalId: string;
  title: string;
  description?: string;
  category?:
    | "art"
    | "music"
    | "sports"
    | "language"
    | "cooking"
    | "tech"
    | "humanities"
    | "kids"
    | "senior"
    | "etc";
  tags?: string[];
  instructor?: string;
  targetAudience?: string;
  capacity?: number;
  enrolled?: number;
  fee?: number;
  feeNote?: string;
  startDate?: string;
  endDate?: string;
  schedule?: CourseScheduleSlot[];
  totalSessions?: number;
  applyStartAt?: Date;
  applyEndAt?: Date;
  applyMethod?: "online" | "visit" | "phone" | "mixed";
  applyUrl: string;
  location?: string;
  thumbnailUrl?: string;
  status?: "upcoming" | "open" | "closed" | "full" | "cancelled";
  rawData?: unknown;
};

export type ParsedEvent = {
  externalId: string;
  title: string;
  description?: string;
  category?: ParsedCourse["category"];
  tags?: string[];
  thumbnailUrl?: string;
  eventStartAt: Date;
  eventEndAt?: Date;
  location: string;
  isFree?: boolean;
  fee?: number;
  needsReservation?: boolean;
  reserveStartAt?: Date;
  reserveEndAt?: Date;
  reserveUrl?: string;
  status?: "upcoming" | "ongoing" | "ended" | "cancelled";
  rawData?: unknown;
};

export type AdapterContext = {
  sourceUrl: string;
  fetcher: Fetcher;
  logger: Logger;
};

export type AdapterResult = {
  courses?: ParsedCourse[];
  events?: ParsedEvent[];
};

export interface CourseAdapter {
  /** Unique key matching `crawl_sources.adapter_key`. */
  key: string;
  /** Display name for logs and admin UI. */
  name: string;
  /** What this adapter produces. */
  contentType: "course" | "event" | "both";
  /** Run the adapter against `ctx.sourceUrl`. */
  run(ctx: AdapterContext): Promise<AdapterResult>;
}

export interface Fetcher {
  html(url: string, init?: { headers?: Record<string, string> }): Promise<string>;
  json<T = unknown>(url: string, init?: { headers?: Record<string, string> }): Promise<T>;
}

export interface Logger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}
