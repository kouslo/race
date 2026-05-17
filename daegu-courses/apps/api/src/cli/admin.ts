/**
 * Promote / demote an admin.
 *   pnpm admin:grant <email-or-userId>
 *   pnpm admin:revoke <email-or-userId>
 */
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { users } from "../db/schema/users";

async function findUser(idOrEmail: string) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrEmail);
  const where = isUuid ? eq(users.id, idOrEmail) : eq(users.email, idOrEmail);
  const [user] = await db.select().from(users).where(where);
  return user;
}

async function main() {
  const [action, target] = process.argv.slice(2);
  if (!action || !target || (action !== "grant" && action !== "revoke")) {
    console.error("usage: admin grant|revoke <email-or-userId>");
    process.exit(1);
  }
  const user = await findUser(target);
  if (!user) {
    console.error(`user not found: ${target}`);
    process.exit(1);
  }
  const isAdmin = action === "grant";
  await db.update(users).set({ isAdmin }).where(eq(users.id, user.id));
  console.log(`${user.nickname} <${user.email ?? user.id}>  isAdmin=${isAdmin}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

