/**
 * Mock seed for preview / screenshots.
 *
 *   pnpm tsx src/db/seed-mock.ts
 *
 * Avoids the network — outbound to library.daegu.go.kr is blocked in
 * this sandbox, so we can't actually crawl. Loads ~30 realistic Korean
 * courses across multiple institutions instead.
 */
import { eq } from "drizzle-orm";
import { db } from "./client";
import { institutions } from "./schema/institutions";
import { crawlSources } from "./schema/crawl-sources";
import { courses } from "./schema/courses";

type DistrictValue =
  | "중구"
  | "동구"
  | "서구"
  | "남구"
  | "북구"
  | "수성구"
  | "달서구"
  | "달성군"
  | "군위군";

type Inst = {
  slug: string;
  name: string;
  district: DistrictValue;
  type: "library" | "culture_center";
  homepageUrl: string;
};

const INSTITUTIONS: Inst[] = [
  {
    slug: "daegu-donggu-library",
    name: "대구 동구도서관",
    district: "동구",
    type: "library",
    homepageUrl: "https://library.daegu.go.kr/donggu/",
  },
  {
    slug: "daegu-beomeo-library",
    name: "대구 범어도서관",
    district: "수성구",
    type: "library",
    homepageUrl: "https://library.daegu.go.kr/beomeo/",
  },
  {
    slug: "daegu-suseong-culture-center",
    name: "수성구 문화예술회관",
    district: "수성구",
    type: "culture_center",
    homepageUrl: "https://www.suseong.kr/culture/",
  },
  {
    slug: "daegu-jung-culture-center",
    name: "중구 문화원",
    district: "중구",
    type: "culture_center",
    homepageUrl: "https://www.jung.daegu.kr/culture/",
  },
];

type CourseSeed = {
  instSlug: string;
  externalId: string;
  title: string;
  category: "art" | "music" | "language" | "tech" | "kids" | "cooking" | "humanities" | "senior" | "sports";
  instructor?: string;
  targetAudience?: string;
  fee: number;
  capacity: number;
  enrolled: number;
  status: "open" | "upcoming" | "closed" | "full";
  schedule: { dayOfWeek: "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN"; startTime: string; endTime: string }[];
  // Days offset from "now"
  startInDays: number;
  endInDays: number;
  applyStartOffsetDays: number;
  applyEndOffsetDays: number;
};

const COURSES: CourseSeed[] = [
  {
    instSlug: "daegu-donggu-library",
    externalId: "29325",
    title: "어린이를 위한 코딩 첫걸음",
    category: "kids",
    instructor: "박지영",
    targetAudience: "초등 3~6학년",
    fee: 0,
    capacity: 20,
    enrolled: 14,
    status: "open",
    schedule: [{ dayOfWeek: "SAT", startTime: "10:00", endTime: "12:00" }],
    startInDays: 14,
    endInDays: 70,
    applyStartOffsetDays: -3,
    applyEndOffsetDays: 5,
  },
  {
    instSlug: "daegu-donggu-library",
    externalId: "29326",
    title: "주말 영어 회화 (초급)",
    category: "language",
    instructor: "Sarah Johnson",
    targetAudience: "성인",
    fee: 30000,
    capacity: 15,
    enrolled: 15,
    status: "full",
    schedule: [{ dayOfWeek: "SUN", startTime: "14:00", endTime: "16:00" }],
    startInDays: 21,
    endInDays: 84,
    applyStartOffsetDays: -7,
    applyEndOffsetDays: 0,
  },
  {
    instSlug: "daegu-donggu-library",
    externalId: "29330",
    title: "시니어 스마트폰 활용교실",
    category: "senior",
    instructor: "김민호",
    targetAudience: "60대 이상",
    fee: 0,
    capacity: 25,
    enrolled: 8,
    status: "open",
    schedule: [
      { dayOfWeek: "MON", startTime: "14:00", endTime: "15:30" },
      { dayOfWeek: "WED", startTime: "14:00", endTime: "15:30" },
    ],
    startInDays: 10,
    endInDays: 45,
    applyStartOffsetDays: -1,
    applyEndOffsetDays: 7,
  },
  {
    instSlug: "daegu-donggu-library",
    externalId: "29331",
    title: "그림책으로 배우는 한자",
    category: "humanities",
    instructor: "이수정",
    targetAudience: "유아 (5~7세)",
    fee: 0,
    capacity: 12,
    enrolled: 9,
    status: "open",
    schedule: [{ dayOfWeek: "TUE", startTime: "10:30", endTime: "11:30" }],
    startInDays: 7,
    endInDays: 56,
    applyStartOffsetDays: -2,
    applyEndOffsetDays: 3,
  },
  {
    instSlug: "daegu-beomeo-library",
    externalId: "44521",
    title: "글로벌 영어독서 클럽",
    category: "language",
    instructor: "Michael Chen",
    targetAudience: "중·고등학생",
    fee: 0,
    capacity: 16,
    enrolled: 11,
    status: "open",
    schedule: [{ dayOfWeek: "SAT", startTime: "15:00", endTime: "17:00" }],
    startInDays: 14,
    endInDays: 90,
    applyStartOffsetDays: -5,
    applyEndOffsetDays: 2,
  },
  {
    instSlug: "daegu-beomeo-library",
    externalId: "44522",
    title: "어린이 전집 대출 신청 (3월)",
    category: "kids",
    targetAudience: "유아·초등 자녀 가구",
    fee: 0,
    capacity: 50,
    enrolled: 32,
    status: "open",
    schedule: [],
    startInDays: 5,
    endInDays: 35,
    applyStartOffsetDays: -10,
    applyEndOffsetDays: 1,
  },
  {
    instSlug: "daegu-beomeo-library",
    externalId: "44530",
    title: "고전문학 함께 읽기: 김유정 단편선",
    category: "humanities",
    instructor: "정은수",
    targetAudience: "성인",
    fee: 0,
    capacity: 18,
    enrolled: 7,
    status: "open",
    schedule: [{ dayOfWeek: "THU", startTime: "19:00", endTime: "20:30" }],
    startInDays: 12,
    endInDays: 75,
    applyStartOffsetDays: -1,
    applyEndOffsetDays: 8,
  },
  {
    instSlug: "daegu-beomeo-library",
    externalId: "44535",
    title: "캘리그라피 입문",
    category: "art",
    instructor: "한혜진",
    targetAudience: "성인",
    fee: 50000,
    capacity: 12,
    enrolled: 5,
    status: "open",
    schedule: [{ dayOfWeek: "FRI", startTime: "10:30", endTime: "12:30" }],
    startInDays: 18,
    endInDays: 60,
    applyStartOffsetDays: -2,
    applyEndOffsetDays: 6,
  },
  {
    instSlug: "daegu-suseong-culture-center",
    externalId: "SS-2025-101",
    title: "재즈 피아노 마스터 클래스",
    category: "music",
    instructor: "Daniel Park",
    targetAudience: "피아노 중급 이상",
    fee: 120000,
    capacity: 8,
    enrolled: 6,
    status: "open",
    schedule: [{ dayOfWeek: "WED", startTime: "19:00", endTime: "21:00" }],
    startInDays: 25,
    endInDays: 80,
    applyStartOffsetDays: -3,
    applyEndOffsetDays: 10,
  },
  {
    instSlug: "daegu-suseong-culture-center",
    externalId: "SS-2025-102",
    title: "성인 발레 입문반",
    category: "sports",
    instructor: "최서연",
    targetAudience: "성인 (초보 환영)",
    fee: 80000,
    capacity: 15,
    enrolled: 10,
    status: "open",
    schedule: [
      { dayOfWeek: "TUE", startTime: "20:00", endTime: "21:30" },
      { dayOfWeek: "THU", startTime: "20:00", endTime: "21:30" },
    ],
    startInDays: 8,
    endInDays: 50,
    applyStartOffsetDays: -4,
    applyEndOffsetDays: 1,
  },
  {
    instSlug: "daegu-suseong-culture-center",
    externalId: "SS-2025-105",
    title: "이탈리아 가정요리 클래스",
    category: "cooking",
    instructor: "Marco Rossi",
    fee: 95000,
    capacity: 10,
    enrolled: 10,
    status: "full",
    schedule: [{ dayOfWeek: "SAT", startTime: "11:00", endTime: "13:30" }],
    startInDays: 21,
    endInDays: 49,
    applyStartOffsetDays: -10,
    applyEndOffsetDays: -1,
  },
  {
    instSlug: "daegu-suseong-culture-center",
    externalId: "SS-2025-110",
    title: "수채화로 그리는 대구 풍경",
    category: "art",
    instructor: "박은영",
    fee: 70000,
    capacity: 14,
    enrolled: 3,
    status: "open",
    schedule: [{ dayOfWeek: "MON", startTime: "10:00", endTime: "12:00" }],
    startInDays: 30,
    endInDays: 100,
    applyStartOffsetDays: 5,
    applyEndOffsetDays: 20,
  },
  {
    instSlug: "daegu-jung-culture-center",
    externalId: "JG-25-051",
    title: "근현대사 강좌: 1960년대 대구",
    category: "humanities",
    instructor: "조경석 교수",
    targetAudience: "성인",
    fee: 0,
    capacity: 40,
    enrolled: 22,
    status: "open",
    schedule: [{ dayOfWeek: "SAT", startTime: "10:00", endTime: "12:00" }],
    startInDays: 14,
    endInDays: 42,
    applyStartOffsetDays: -2,
    applyEndOffsetDays: 7,
  },
  {
    instSlug: "daegu-jung-culture-center",
    externalId: "JG-25-052",
    title: "다도 입문: 한국 전통차 체험",
    category: "humanities",
    instructor: "송혜자",
    fee: 35000,
    capacity: 12,
    enrolled: 4,
    status: "open",
    schedule: [{ dayOfWeek: "WED", startTime: "14:00", endTime: "16:00" }],
    startInDays: 19,
    endInDays: 47,
    applyStartOffsetDays: -1,
    applyEndOffsetDays: 12,
  },
  {
    instSlug: "daegu-jung-culture-center",
    externalId: "JG-25-060",
    title: "오카리나 동아리 신규 단원 모집",
    category: "music",
    instructor: "윤성호",
    targetAudience: "성인",
    fee: 25000,
    capacity: 20,
    enrolled: 13,
    status: "open",
    schedule: [{ dayOfWeek: "FRI", startTime: "19:30", endTime: "21:00" }],
    startInDays: 11,
    endInDays: 11 + 90,
    applyStartOffsetDays: -3,
    applyEndOffsetDays: 4,
  },
  {
    instSlug: "daegu-donggu-library",
    externalId: "29400",
    title: "초보자를 위한 파이썬 데이터 분석",
    category: "tech",
    instructor: "김태현",
    targetAudience: "직장인",
    fee: 0,
    capacity: 20,
    enrolled: 18,
    status: "open",
    schedule: [{ dayOfWeek: "SAT", startTime: "13:00", endTime: "15:30" }],
    startInDays: 16,
    endInDays: 70,
    applyStartOffsetDays: -4,
    applyEndOffsetDays: 2,
  },
  {
    instSlug: "daegu-donggu-library",
    externalId: "29410",
    title: "(마감) 책으로 만나는 세계여행",
    category: "humanities",
    fee: 0,
    capacity: 30,
    enrolled: 30,
    status: "closed",
    schedule: [{ dayOfWeek: "SAT", startTime: "14:00", endTime: "15:30" }],
    startInDays: -30,
    endInDays: -3,
    applyStartOffsetDays: -45,
    applyEndOffsetDays: -32,
  },
  {
    instSlug: "daegu-beomeo-library",
    externalId: "44550",
    title: "[예정] 봄맞이 시낭송회 참여자 모집",
    category: "humanities",
    fee: 0,
    capacity: 20,
    enrolled: 0,
    status: "upcoming",
    schedule: [{ dayOfWeek: "FRI", startTime: "19:00", endTime: "21:00" }],
    startInDays: 45,
    endInDays: 45,
    applyStartOffsetDays: 7,
    applyEndOffsetDays: 30,
  },
];

const dayMs = 86400_000;
function offsetDate(now: Date, days: number, hour = 9): Date {
  const d = new Date(now.getTime() + days * dayMs);
  d.setHours(hour, 0, 0, 0);
  return d;
}
function offsetIso(now: Date, days: number): string {
  const d = new Date(now.getTime() + days * dayMs);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const now = new Date();

  const slugToId = new Map<string, string>();
  for (const inst of INSTITUTIONS) {
    let [existing] = await db.select({ id: institutions.id }).from(institutions).where(eq(institutions.slug, inst.slug));
    if (!existing) {
      [existing] = await db
        .insert(institutions)
        .values({
          slug: inst.slug,
          name: inst.name,
          type: inst.type,
          district: inst.district,
          homepageUrl: inst.homepageUrl,
        })
        .returning({ id: institutions.id });
    }
    slugToId.set(inst.slug, existing.id);
  }

  const sourceIdByInst = new Map<string, string>();
  for (const [slug, id] of slugToId) {
    let [src] = await db
      .select()
      .from(crawlSources)
      .where(eq(crawlSources.institutionId, id));
    if (!src) {
      [src] = await db
        .insert(crawlSources)
        .values({
          institutionId: id,
          sourceUrl: `https://example.invalid/${slug}/courses`,
          adapterKey: "daegu-library-v1",
        })
        .returning();
    }
    sourceIdByInst.set(slug, src.id);
  }

  for (const c of COURSES) {
    const institutionId = slugToId.get(c.instSlug);
    const sourceId = sourceIdByInst.get(c.instSlug);
    if (!institutionId || !sourceId) continue;
    try {
      await db
        .insert(courses)
        .values({
          institutionId,
          sourceId,
          externalId: c.externalId,
          title: c.title,
          category: c.category,
          tags: [],
          instructor: c.instructor,
          targetAudience: c.targetAudience,
          capacity: c.capacity,
          enrolled: c.enrolled,
          fee: c.fee,
          startDate: offsetIso(now, c.startInDays),
          endDate: offsetIso(now, c.endInDays),
          schedule: c.schedule,
          applyStartAt: offsetDate(now, c.applyStartOffsetDays),
          applyEndAt: offsetDate(now, c.applyEndOffsetDays, 18),
          applyMethod: "online",
          applyUrl: `${INSTITUTIONS.find((i) => i.slug === c.instSlug)!.homepageUrl}module/course/detail.do?crsUid=${c.externalId}`,
          status: c.status,
          firstSeenAt: now,
          lastSeenAt: now,
        })
        .onConflictDoNothing();
    } catch (e) {
      console.error(`FAIL on course ${c.externalId} "${c.title}"`, e);
      throw e;
    }
  }

  console.log(`seeded ${INSTITUTIONS.length} institutions and ${COURSES.length} courses`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
