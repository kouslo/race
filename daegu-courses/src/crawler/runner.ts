import { eq } from "drizzle-orm";
import type { DB } from "../db/client";
import { crawlLogs, crawlSources } from "../db/schema/crawl-sources";
import { createFetcher } from "./fetcher";
import { createLogger } from "./logger";
import { getAdapter } from "./registry";
import { upsertCourses, upsertEvents } from "./upsert";

export async function runSource(db: DB, sourceId: string) {
  const [source] = await db.select().from(crawlSources).where(eq(crawlSources.id, sourceId));
  if (!source) throw new Error(`crawl_source not found: ${sourceId}`);

  const adapter = getAdapter(source.adapterKey);
  const logger = createLogger(`[${adapter.key}]`);
  const fetcher = createFetcher();
  const startedAt = new Date();

  logger.info("crawl started", { sourceUrl: source.sourceUrl });

  try {
    const result = await adapter.run({ sourceUrl: source.sourceUrl, fetcher, logger });

    const now = new Date();
    const courseStats = result.courses
      ? await upsertCourses(db, source.institutionId, source.id, result.courses, now)
      : { found: 0, created: 0, updated: 0, deactivated: 0 };
    const eventStats = result.events
      ? await upsertEvents(db, source.institutionId, source.id, result.events, now)
      : { found: 0, created: 0, updated: 0, deactivated: 0 };

    const totals = {
      found: courseStats.found + eventStats.found,
      created: courseStats.created + eventStats.created,
      updated: courseStats.updated + eventStats.updated,
      deactivated: courseStats.deactivated + eventStats.deactivated,
    };

    await db
      .update(crawlSources)
      .set({
        lastCrawledAt: now,
        lastSuccessAt: now,
        lastErrorMessage: null,
        consecutiveFailures: 0,
      })
      .where(eq(crawlSources.id, source.id));

    await db.insert(crawlLogs).values({
      sourceId: source.id,
      startedAt,
      finishedAt: now,
      status: "success",
      itemsFound: totals.found,
      itemsCreated: totals.created,
      itemsUpdated: totals.updated,
      itemsDeactivated: totals.deactivated,
    });

    logger.info("crawl finished", totals);
    return totals;
  } catch (err) {
    const finishedAt = new Date();
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("crawl failed", { error: msg });

    await db
      .update(crawlSources)
      .set({
        lastCrawledAt: finishedAt,
        lastErrorMessage: msg,
        consecutiveFailures: source.consecutiveFailures + 1,
      })
      .where(eq(crawlSources.id, source.id));

    await db.insert(crawlLogs).values({
      sourceId: source.id,
      startedAt,
      finishedAt,
      status: "failed",
      errorMessage: msg,
    });
    throw err;
  }
}

export async function runDueSources(db: DB) {
  const sources = await db.select().from(crawlSources).where(eq(crawlSources.isActive, true));
  const now = Date.now();
  const due = sources.filter((s) => {
    if (!s.lastCrawledAt) return true;
    return now - s.lastCrawledAt.getTime() >= s.crawlIntervalMinutes * 60_000;
  });
  for (const s of due) {
    try {
      await runSource(db, s.id);
    } catch {
      // already logged; continue with next source
    }
  }
}
