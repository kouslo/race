import type { AdapterContext, AdapterResult, CourseAdapter, ParsedCourse } from "../types";
import type { CourseScheduleSlot } from "../../db/schema/courses";

/**
 * Adapter for the Daegu public library shared CMS.
 *
 * The course listing page is a SPA that fetches `/<hmpgUid>/courses` from
 * a JSON API (CA_API_HOST). We bypass the HTML entirely and hit the API
 * directly. One adapter handles every branch on this CMS — the branch
 * (donggu / dongbu / beomeo / …) and any category filter come from the
 * sourceUrl's path and query string.
 *
 * Set `DAEGU_LIBRARY_CMS_API_HOST` in the environment to the API origin
 * (e.g., https://example-cul-api.kr-region.gov-nhncloudservice.com).
 */
const CA_API_HOST = process.env.DAEGU_LIBRARY_CMS_API_HOST?.replace(/\/$/, "");

/** Map URL subdirectory → default homepage_id used by the API when not given. */
const BRANCH_DEFAULT_HMPG: Record<string, string> = {
  donggu: "h73",
  beomeo: "h50",
  yonghak: "h51",
  gosan: "h52",
};

type ApiCourse = {
  crsUid: number | string;
  hmpgUid: string;
  hmpgPath: string;
  groupUid: number | string;
  groupNm?: string;
  ctgryUid: number | string;
  lclsfUid: number | string;
  crsNm: string;
  crsTrgt?: string;
  crsBgngYmd: string;
  crsEndYmd: string;
  crsBgngTm: string;
  crsEndTm: string;
  crsDowArr?: string[];
  crsDowDsgnYn?: "Y" | "N";
  lctrDowDrctInpt?: string;
  rcptBgngYmd: string;
  rcptBgngTm: string;
  rcptEndYmd: string;
  rcptEndTm: string;
  crsRcrtNope?: number;
  crsRcrtCnt?: number;
  crsOflnNope?: number;
  crsOflnRcrtCnt?: number;
  crsRcrtRsrvNope?: number;
  crsRsrvCnt?: number;
  crsStatus: number | string;
};

type ApiResponse = {
  data?: {
    courseList?: ApiCourse[];
    srchMap?: Record<string, unknown>;
  };
};

export const daeguLibraryAdapter: CourseAdapter = {
  key: "daegu-library-v1",
  name: "대구 시립도서관 (통합 CMS API)",
  contentType: "course",

  async run(ctx: AdapterContext): Promise<AdapterResult> {
    const { sourceUrl, fetcher, logger } = ctx;
    if (!CA_API_HOST) {
      throw new Error(
        "DAEGU_LIBRARY_CMS_API_HOST is not set — required by daegu-library-v1.",
      );
    }

    const u = new URL(sourceUrl);
    const branch = u.pathname.split("/").filter(Boolean)[0];
    const homepageId =
      u.searchParams.get("homepage_id") ?? BRANCH_DEFAULT_HMPG[branch] ?? "";
    const menuIdx = u.searchParams.get("menu_idx") ?? "";
    const searchCate1 = u.searchParams.get("searchCate1") ?? "";

    if (!homepageId) {
      throw new Error(
        `Cannot determine homepage_id for ${sourceUrl}. Add a default in BRANCH_DEFAULT_HMPG or include homepage_id in the URL.`,
      );
    }

    const apiUrl = new URL(`${CA_API_HOST}/${homepageId}/courses`);
    if (menuIdx) apiUrl.searchParams.set("menu_idx", menuIdx);
    if (searchCate1) apiUrl.searchParams.set("lclsfUid", searchCate1);
    apiUrl.searchParams.set("prntCd", "15");

    const res = await fetcher.json<ApiResponse>(apiUrl.toString(), {
      headers: { Accept: "application/json", Referer: sourceUrl },
    });

    const list = res.data?.courseList ?? [];
    const courses = list.map((item) => toParsedCourse(item, branch, menuIdx));

    logger.info(`fetched ${courses.length} courses`, {
      branch,
      homepageId,
      menuIdx,
      searchCate1,
    });
    return { courses };
  },
};

function toParsedCourse(i: ApiCourse, branch: string, menuIdx: string): ParsedCourse {
  const detailUrl = new URL(`https://library.daegu.go.kr/${branch}/module/course/detail.do`);
  if (menuIdx) detailUrl.searchParams.set("menu_idx", menuIdx);
  detailUrl.searchParams.set("homepage_id", String(i.hmpgUid));
  detailUrl.searchParams.set("groupUid", String(i.groupUid));
  detailUrl.searchParams.set("ctgryUid", String(i.ctgryUid));
  detailUrl.searchParams.set("crsUid", String(i.crsUid));
  detailUrl.searchParams.set("lclsfUid", String(i.lclsfUid));

  const capacity =
    (toNum(i.crsRcrtNope) ?? 0) + (toNum(i.crsOflnNope) ?? 0) || undefined;
  const enrolled =
    (toNum(i.crsRcrtCnt) ?? 0) + (toNum(i.crsOflnRcrtCnt) ?? 0) || undefined;

  return {
    externalId: `crsUid=${i.crsUid}`,
    title: i.crsNm,
    description: undefined,
    tags: i.groupNm ? [i.groupNm] : [],
    targetAudience: i.crsTrgt || undefined,
    capacity,
    enrolled,
    startDate: parseYmd(i.crsBgngYmd),
    endDate: parseYmd(i.crsEndYmd),
    schedule: buildSchedule(i),
    applyStartAt: parseYmdHm(i.rcptBgngYmd, i.rcptBgngTm),
    applyEndAt: parseYmdHm(i.rcptEndYmd, i.rcptEndTm),
    applyUrl: detailUrl.toString(),
    applyMethod: "online",
    status: mapStatus(i.crsStatus),
    rawData: i,
  };
}

function toNum(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** "2025-03-01" / "2025.03.01" / "20250301" → "2025-03-01" */
function parseYmd(s?: string): string | undefined {
  if (!s) return undefined;
  const compact = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
  const sep = s.match(/(\d{4})\D(\d{1,2})\D(\d{1,2})/);
  if (sep) return `${sep[1]}-${sep[2].padStart(2, "0")}-${sep[3].padStart(2, "0")}`;
  return undefined;
}

/** Combine YMD + "HH:mm" / "HHmm" into a KST-anchored Date. */
function parseYmdHm(ymd?: string, hm?: string): Date | undefined {
  const date = parseYmd(ymd);
  if (!date) return undefined;
  const [, y, mo, d] = date.match(/(\d{4})-(\d{2})-(\d{2})/)!;
  let hh = 0;
  let mm = 0;
  if (hm) {
    const m = hm.match(/^(\d{1,2}):?(\d{2})$/);
    if (m) {
      hh = Number(m[1]);
      mm = Number(m[2]);
    }
  }
  // KST = UTC+9, no DST.
  return new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), hh - 9, mm));
}

/** crsDowArr uses "1"=일 … "7"=토. Our schema uses MON–SUN labels. */
const DOW_MAP: Record<string, CourseScheduleSlot["dayOfWeek"]> = {
  "1": "SUN",
  "2": "MON",
  "3": "TUE",
  "4": "WED",
  "5": "THU",
  "6": "FRI",
  "7": "SAT",
};

function buildSchedule(i: ApiCourse): CourseScheduleSlot[] | undefined {
  const days = (i.crsDowArr ?? [])
    .map((d) => DOW_MAP[d.trim()])
    .filter((d): d is CourseScheduleSlot["dayOfWeek"] => Boolean(d));
  if (days.length === 0) return undefined;
  const startTime = normalizeTime(i.crsBgngTm);
  const endTime = normalizeTime(i.crsEndTm);
  if (!startTime || !endTime) return undefined;
  return days.map((dayOfWeek) => ({ dayOfWeek, startTime, endTime }));
}

function normalizeTime(t?: string): string | undefined {
  if (!t) return undefined;
  const m = t.match(/^(\d{1,2}):?(\d{2})$/);
  if (!m) return undefined;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

/**
 * crsStatus codes observed in renderCrsList:
 *   0  수강신청       → open
 *   1  대기자신청     → open
 *   2  신청완료       → open  (personal state; treat as still open in catalog)
 *   3  대기자신청완료 → open
 *   4  접수마감       → closed
 *   5  정원마감       → full
 *   6  접수예정       → upcoming
 *   9  수강종료       → closed
 *  10  신청완료(alt)  → open
 *  11  접수중         → open
 *  12  수업중         → closed (catalog-wise: no more applications)
 */
function mapStatus(code: ApiCourse["crsStatus"]): ParsedCourse["status"] {
  const c = String(code);
  if (c === "4" || c === "9" || c === "12") return "closed";
  if (c === "5") return "full";
  if (c === "6") return "upcoming";
  return "open";
}
