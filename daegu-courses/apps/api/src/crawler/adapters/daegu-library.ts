import type { AdapterContext, AdapterResult, CourseAdapter, Fetcher, ParsedCourse } from "../types";
import type { CourseScheduleSlot } from "../../db/schema/courses";

/**
 * Adapter for the Daegu public library shared CMS.
 *
 * The course listing page is a SPA; this adapter bypasses HTML scraping
 * and calls the underlying JSON API discovered in CNDAjax.js:
 *
 *   token:    GET https://library.daegu.go.kr/token.do
 *             → { jwt, expiresAt }
 *   listing:  GET https://library-ssl.daegu.go.kr/apply/api/v1/cul/apply/<hmpgUid>/courses
 *             Authorization: Bearer <jwt>
 *
 * One adapter handles every branch (donggu / dongbu / beomeo / …);
 * branch and category filter come from the sourceUrl.
 *
 * Hosts can be overridden by env for staging or schema changes upstream:
 *   DAEGU_LIBRARY_TOKEN_URL
 *   DAEGU_LIBRARY_API_BASE
 */
const TOKEN_URL =
  process.env.DAEGU_LIBRARY_TOKEN_URL ?? "https://library.daegu.go.kr/token.do";
const API_BASE =
  process.env.DAEGU_LIBRARY_API_BASE ??
  "https://library-ssl.daegu.go.kr/apply/api/v1/cul/apply";

/** Default homepage_id when not present in the URL. */
const BRANCH_DEFAULT_HMPG: Record<string, string> = {
  donggu: "h73",
  beomeo: "h50",
  yonghak: "h51",
  gosan: "h52",
};

type TokenResponse = { jwt: string; expiresAt: number };

let cachedToken: { jwt: string; expiresAt: number } | null = null;
let inflightToken: Promise<string> | null = null;

async function getJwt(fetcher: Fetcher): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 3000) {
    return cachedToken.jwt;
  }
  if (inflightToken) return inflightToken;
  inflightToken = fetcher
    .json<TokenResponse>(TOKEN_URL)
    .then((res) => {
      if (!res?.jwt || !res?.expiresAt) {
        throw new Error("token.do returned an invalid payload");
      }
      cachedToken = { jwt: res.jwt, expiresAt: res.expiresAt };
      return res.jwt;
    })
    .finally(() => {
      inflightToken = null;
    });
  return inflightToken;
}

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
    const u = new URL(sourceUrl);
    const branch = u.pathname.split("/").filter(Boolean)[0] ?? "";
    const homepageId =
      u.searchParams.get("homepage_id") ?? (branch ? BRANCH_DEFAULT_HMPG[branch] ?? "" : "");
    const menuIdx = u.searchParams.get("menu_idx") ?? "";
    const searchCate1 = u.searchParams.get("searchCate1") ?? "";

    if (!homepageId) {
      throw new Error(
        `Cannot determine homepage_id for ${sourceUrl}. Add a default in BRANCH_DEFAULT_HMPG or include homepage_id in the URL.`,
      );
    }

    const apiUrl = new URL(`${API_BASE}/${homepageId}/courses`);
    if (menuIdx) apiUrl.searchParams.set("menu_idx", menuIdx);
    if (searchCate1) apiUrl.searchParams.set("lclsfUid", searchCate1);
    apiUrl.searchParams.set("prntCd", "15");

    const jwt = await getJwt(fetcher);
    const res = await fetcher.json<ApiResponse>(apiUrl.toString(), {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${jwt}`,
        Referer: sourceUrl,
      },
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

function parseYmd(s?: string): string | undefined {
  if (!s) return undefined;
  const compact = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) return `${compact[1]!}-${compact[2]!}-${compact[3]!}`;
  const sep = s.match(/(\d{4})\D(\d{1,2})\D(\d{1,2})/);
  if (sep) return `${sep[1]!}-${sep[2]!.padStart(2, "0")}-${sep[3]!.padStart(2, "0")}`;
  return undefined;
}

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
  return new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), hh - 9, mm));
}

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
  return `${m[1]!.padStart(2, "0")}:${m[2]!}`;
}

/**
 * crsStatus codes (from renderCrsList):
 *   0/1/2/3/10/11 → open (수강신청·대기·접수중·신청완료 상태들)
 *   4              → closed (접수마감)
 *   5              → full   (정원마감)
 *   6              → upcoming (접수예정)
 *   9/12           → closed (수강종료·수업중 — catalog-wise no more applications)
 */
function mapStatus(code: ApiCourse["crsStatus"]): ParsedCourse["status"] {
  const c = String(code);
  if (c === "4" || c === "9" || c === "12") return "closed";
  if (c === "5") return "full";
  if (c === "6") return "upcoming";
  return "open";
}
