/**
 * One-off DB setup: enables Postgres extensions required by our schema.
 *
 *   pnpm db:init
 *
 * Run this BEFORE `pnpm db:push` on a fresh database — the trigram
 * indexes defined in schema/courses.ts and schema/events.ts depend on
 * pg_trgm being present.
 */
import { sql } from "drizzle-orm";
import { db } from "./client";

const EXTENSIONS = ["pg_trgm"] as const;

async function main() {
  for (const ext of EXTENSIONS) {
    await db.execute(sql.raw(`CREATE EXTENSION IF NOT EXISTS ${ext}`));
    console.log(`ok: ${ext}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
