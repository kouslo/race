import { pgEnum } from "drizzle-orm/pg-core";

export const institutionTypeEnum = pgEnum("institution_type", [
  "culture_center",
  "library",
  "community",
  "museum",
  "school",
  "private",
  "etc",
]);

export const daeguDistrictEnum = pgEnum("daegu_district", [
  "중구",
  "동구",
  "서구",
  "남구",
  "북구",
  "수성구",
  "달서구",
  "달성군",
  "군위군",
]);

export const contentTypeEnum = pgEnum("content_type", ["course", "event", "both"]);

export const courseCategoryEnum = pgEnum("course_category", [
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
]);

export const applyMethodEnum = pgEnum("apply_method", ["online", "visit", "phone", "mixed"]);

export const courseStatusEnum = pgEnum("course_status", [
  "upcoming",
  "open",
  "closed",
  "full",
  "cancelled",
]);

export const eventStatusEnum = pgEnum("event_status", [
  "upcoming",
  "ongoing",
  "ended",
  "cancelled",
]);

export const authProviderEnum = pgEnum("auth_provider", ["kakao", "naver", "apple", "google"]);

export const favoriteTargetEnum = pgEnum("favorite_target", ["course", "event"]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "apply_open",
  "apply_closing",
  "new_in_category",
]);

export const crawlStatusEnum = pgEnum("crawl_status", ["success", "partial", "failed"]);

export const pushPlatformEnum = pgEnum("push_platform", ["ios", "android", "web"]);

export const notificationChannelEnum = pgEnum("notification_channel", [
  "expo",
  "apns",
  "fcm",
  "webpush",
]);
