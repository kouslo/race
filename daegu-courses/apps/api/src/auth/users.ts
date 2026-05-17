import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { users } from "../db/schema/users";

export type IdProviderClaims = {
  provider: "kakao" | "naver" | "apple" | "google";
  providerUserId: string;
  email?: string;
  nickname?: string;
  profileUrl?: string;
};

/**
 * Find-or-create a user keyed on (provider, providerUserId).
 * Profile fields (email/nickname/profileUrl) are updated on every login.
 */
export async function upsertUserFromProvider(claims: IdProviderClaims) {
  const fallbackNickname =
    claims.nickname?.trim() || `${claims.provider}_${claims.providerUserId.slice(-6)}`;

  const [user] = await db
    .insert(users)
    .values({
      provider: claims.provider,
      providerUserId: claims.providerUserId,
      email: claims.email ?? null,
      nickname: fallbackNickname,
      profileUrl: claims.profileUrl ?? null,
    })
    .onConflictDoUpdate({
      target: [users.provider, users.providerUserId],
      set: {
        email: claims.email ?? sql`users.email`,
        nickname: claims.nickname?.trim() || sql`users.nickname`,
        profileUrl: claims.profileUrl ?? sql`users.profile_url`,
      },
    })
    .returning();

  if (!user) {
    // Shouldn't happen — onConflictDoUpdate always returns the row.
    const [existing] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.provider, claims.provider),
          eq(users.providerUserId, claims.providerUserId),
        ),
      );
    if (!existing) throw new Error("Failed to upsert user");
    return existing;
  }
  return user;
}
