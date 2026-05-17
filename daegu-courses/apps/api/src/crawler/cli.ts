/**
 * CLI for ad-hoc crawler runs.
 *
 *   npm run crawl -- --source <uuid>     # run one source
 *   npm run crawl:all                    # run all due active sources
 */
import { db } from "../db/client";
import { runDueSources, runSource } from "./runner";

async function main() {
  const args = process.argv.slice(2);
  const sourceIdx = args.indexOf("--source");
  if (sourceIdx >= 0) {
    const id = args[sourceIdx + 1];
    if (!id) throw new Error("--source requires a UUID");
    await runSource(db, id);
    return;
  }
  if (args.includes("--all")) {
    await runDueSources(db);
    return;
  }
  console.error("usage: crawl --source <uuid> | crawl --all");
  process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
