/**
 * Idempotent seed for the Daegu public library sources the user provided.
 *
 *   npx tsx src/db/seed.ts
 */
import { eq } from "drizzle-orm";
import { db } from "./client";
import { institutions } from "./schema/institutions";
import { crawlSources } from "./schema/crawl-sources";

type SeedInstitution = {
  slug: string;
  name: string;
  district: "중구" | "동구" | "서구" | "남구" | "북구" | "수성구" | "달서구" | "달성군" | "군위군";
  homepageUrl: string;
  sourceUrl: string;
};

const SEEDS: SeedInstitution[] = [
  {
    slug: "daegu-donggu-library",
    name: "대구 동구도서관",
    district: "동구",
    homepageUrl: "https://library.daegu.go.kr/donggu/",
    sourceUrl:
      "https://library.daegu.go.kr/donggu/module/teach/index.do?menu_idx=28&searchCate1=&homepage_id=h73",
  },
  {
    slug: "daegu-dongbu-library",
    name: "대구 동부도서관",
    district: "동구",
    homepageUrl: "https://library.daegu.go.kr/dongbu/",
    sourceUrl: "https://library.daegu.go.kr/dongbu/module/teach/index.do?menu_idx=30",
  },
  {
    slug: "daegu-beomeo-library",
    name: "대구 범어도서관",
    district: "수성구",
    homepageUrl: "https://library.daegu.go.kr/beomeo/",
    sourceUrl:
      "https://library.daegu.go.kr/beomeo/module/teach/index.do?menu_idx=98&searchCate1=16",
  },
];

async function main() {
  for (const seed of SEEDS) {
    const inst = await firstRow(
      db
        .insert(institutions)
        .values({
          slug: seed.slug,
          name: seed.name,
          type: "library",
          district: seed.district,
          homepageUrl: seed.homepageUrl,
        })
        .onConflictDoUpdate({
          target: institutions.slug,
          set: { name: seed.name, district: seed.district, homepageUrl: seed.homepageUrl },
        })
        .returning({ id: institutions.id }),
      `failed to upsert institution ${seed.slug}`,
    );

    const existing = await db
      .select({ id: crawlSources.id })
      .from(crawlSources)
      .where(eq(crawlSources.sourceUrl, seed.sourceUrl));

    if (existing.length === 0) {
      await db.insert(crawlSources).values({
        institutionId: inst.id,
        sourceUrl: seed.sourceUrl,
        adapterKey: "daegu-library-v1",
        contentType: "course",
      });
      console.log(`+ source registered: ${seed.name}`);
    } else {
      console.log(`= source already present: ${seed.name}`);
    }
  }
}

async function firstRow<T>(p: Promise<T[]>, errMsg: string): Promise<T> {
  const rows = await p;
  const row = rows[0];
  if (!row) throw new Error(errMsg);
  return row;
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
