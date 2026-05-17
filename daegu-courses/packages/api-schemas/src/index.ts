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
  sort: z.enum(["recent", "applyEndSoon", "startDate", "relevance"]).default("recent"),
});
export type CoursesListQuery = z.infer<typeof coursesListQuery>;

export const eventsListQuery = paginationQuery.extend({
  q: z.string().trim().max(200).optional(),
  category: z.enum(courseCategoryValues).optional(),
  district: z.enum(districtValues).optional(),
  institutionId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sort: z.enum(["startSoon", "recent", "relevance"]).default("startSoon"),
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

/* ─────────── auth ─────────── */

export const authProviderValues = ["kakao", "naver", "apple", "google"] as const;

export const kakaoCallbackInput = z.object({
  code: z.string().min(1),
  redirectUri: z.string().url(),
  codeVerifier: z.string().min(1).optional(),
});
export type KakaoCallbackInput = z.infer<typeof kakaoCallbackInput>;

export const refreshInput = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshInput = z.infer<typeof refreshInput>;

export const authUser = z.object({
  id: z.string().uuid(),
  email: z.string().nullable(),
  nickname: z.string(),
  profileUrl: z.string().nullable(),
  provider: z.enum(authProviderValues),
});
export type AuthUser = z.infer<typeof authUser>;

export const authSession = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  accessTokenExpiresAt: z.string(),
  user: authUser,
});
export type AuthSession = z.infer<typeof authSession>;

export const refreshOutput = authSession.omit({ user: true });
export type RefreshOutput = z.infer<typeof refreshOutput>;

/* ─────────── push notifications ─────────── */

export const pushPlatformValues = ["ios", "android", "web"] as const;
export const notificationKindValues = [
  "apply_open",
  "apply_closing",
  "new_in_category",
] as const;

export const pushTokenRegister = z.object({
  token: z.string().min(1),
  platform: z.enum(pushPlatformValues),
  deviceId: z.string().max(200).optional(),
});
export type PushTokenRegister = z.infer<typeof pushTokenRegister>;

export const subscriptionCreate = z
  .object({
    type: z.enum(notificationKindValues),
    category: z.enum(courseCategoryValues).optional(),
    targetType: z.enum(favoriteTargetValues).optional(),
    targetId: z.string().uuid().optional(),
  })
  .refine(
    (v) =>
      v.type !== "new_in_category" || (v.category !== undefined && v.targetId === undefined),
    { message: "new_in_category requires `category` (and no targetId)" },
  )
  .refine(
    (v) =>
      v.type === "new_in_category" ||
      (v.targetType !== undefined && v.targetId !== undefined),
    { message: "apply_open/apply_closing requires targetType + targetId" },
  );
export type SubscriptionCreate = z.infer<typeof subscriptionCreate>;

/* ─────────── admin ─────────── */

export const institutionTypeValues = [
  "culture_center",
  "library",
  "community",
  "museum",
  "school",
  "private",
  "etc",
] as const;

export const contentTypeValues = ["course", "event", "both"] as const;

export const institutionCreate = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9-]+$/, "slug must be kebab-case [a-z0-9-]"),
  type: z.enum(institutionTypeValues),
  district: z.enum(districtValues),
  address: z.string().max(500).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  phone: z.string().max(30).optional(),
  homepageUrl: z.string().url(),
  logoUrl: z.string().url().optional(),
});
export type InstitutionCreate = z.infer<typeof institutionCreate>;
export const institutionUpdate = institutionCreate.partial();
export type InstitutionUpdate = z.infer<typeof institutionUpdate>;

export const crawlSourceCreate = z.object({
  institutionId: z.string().uuid(),
  sourceUrl: z.string().url(),
  adapterKey: z.string().min(1).max(100),
  contentType: z.enum(contentTypeValues).default("course"),
  crawlIntervalMinutes: z.coerce.number().int().min(5).max(60 * 24 * 7).default(1440),
  isActive: z.boolean().default(true),
});
export type CrawlSourceCreate = z.infer<typeof crawlSourceCreate>;
export const crawlSourceUpdate = crawlSourceCreate.partial().omit({ institutionId: true });
export type CrawlSourceUpdate = z.infer<typeof crawlSourceUpdate>;
