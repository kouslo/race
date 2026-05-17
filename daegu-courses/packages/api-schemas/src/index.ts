import { z } from "zod";

/**
 * Public API contract. Reuse these schemas in web/mobile clients so
 * request/response types stay in sync with the server.
 */

export const courseCategoryValues = [
  "art",
  "music",
  "sports",
  "language",
  "cooking",
  "tech",
  "humanities",
  "kids",
  "senior",
  "etc",
] as const;

export const districtValues = [
  "중구",
  "동구",
  "서구",
  "남구",
  "북구",
  "수성구",
  "달서구",
  "달성군",
  "군위군",
] as const;

export const courseStatusValues = ["upcoming", "open", "closed", "full", "cancelled"] as const;
export const eventStatusValues = ["upcoming", "ongoing", "ended", "cancelled"] as const;
export const favoriteTargetValues = ["course", "event"] as const;

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const coursesListQuery = paginationQuery.extend({
  q: z.string().trim().max(200).optional(),
  category: z.enum(courseCategoryValues).optional(),
  district: z.enum(districtValues).optional(),
  institutionId: z.string().uuid().optional(),
  status: z.enum(courseStatusValues).optional(),
  free: z.coerce.boolean().optional(),
  applyOpen: z.coerce.boolean().optional(),
  sort: z.enum(["recent", "applyEndSoon", "startDate"]).default("recent"),
});
export type CoursesListQuery = z.infer<typeof coursesListQuery>;

export const eventsListQuery = paginationQuery.extend({
  q: z.string().trim().max(200).optional(),
  category: z.enum(courseCategoryValues).optional(),
  district: z.enum(districtValues).optional(),
  institutionId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sort: z.enum(["startSoon", "recent"]).default("startSoon"),
});
export type EventsListQuery = z.infer<typeof eventsListQuery>;

export const institutionsListQuery = z.object({
  district: z.enum(districtValues).optional(),
  type: z
    .enum(["culture_center", "library", "community", "museum", "school", "private", "etc"])
    .optional(),
});

export const favoriteCreate = z.object({
  targetType: z.enum(favoriteTargetValues),
  targetId: z.string().uuid(),
});

export const userIdHeader = z.string().uuid();

export type ListResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};
