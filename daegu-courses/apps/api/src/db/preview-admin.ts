/**
 * For preview screenshots only: ensure a mock admin user exists, mint a
 * short-lived access token, print both cookies on stdout for puppeteer
 * to consume.
 *
 *   pnpm tsx src/db/preview-admin.ts
 */
import { eq } from "drizzle-orm";
import { db } from "./client";
import { users } from "./schema/users";
import { signAccessToken } from "../auth/jwt";

async function main() {
  const provider = "kakao" as const;
  const providerUserId = "preview-admin";

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.providerUserId, providerUserId));

  let user = existing;
  if (!user) {
    [user] = await db
      .insert(users)
      .values({
        provider,
        providerUserId,
        nickname: "관리자",
        email: "admin@preview.local",
        isAdmin: true,
      })
      .returning();
  } else if (!user.isAdmin) {
    [user] = await db
      .update(users)
      .set({ isAdmin: true })
      .where(eq(users.id, user.id))
      .returning();
  }

  if (!user) throw new Error("failed to ensure preview admin user");

  const token = await signAccessToken({ sub: user.id });
  process.stdout.write(`${token}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
