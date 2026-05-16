import * as cheerio from "cheerio";
import type { AdapterContext, AdapterResult, CourseAdapter, ParsedCourse } from "../types";
import {
  parseFee,
  parseKoreanDate,
  parseKoreanDateTime,
  resolveUrl,
} from "../normalize";

/**
 * Adapter for the Daegu public library shared CMS.
 *   https://library.daegu.go.kr/<branch>/module/teach/index.do
 *
 * Same markup family across branches (donggu / dongbu / beomeo / ...),
 * so one adapter handles all of them — the branch slug and category
 * filter ride along in `sourceUrl`'s query string.
 *
 * Selectors are centralised in SEL below; tune them against real HTML
 * (DevTools → Copy → Copy selector) without touching parsing logic.
 */
const SEL = {
  /** Each course row on the listing page. */
  listItem: "ul.list li, table.board_list tbody tr",
  /** Anchor whose href leads to the detail page; also holds the title. */
  titleLink: "a",
  /** Status badge ("접수중", "마감", "대기" …). */
  status: ".status, .state, td.status",
  /** "신청기간 2025.03.01 ~ 2025.03.15" */
  applyPeriod: ".apply, .apply-period, td.apply",
  /** "교육기간 2025.04.01 ~ 2025.06.30" */
  coursePeriod: ".period, td.period",
  /** "강사 홍길동" */
  instructor: ".instructor, td.instructor",
  /** "수강료 30,000원" or "무료" */
  fee: ".fee, td.fee",
  /** "정원 20명" / "20/20" */
  capacity: ".capacity, td.capacity",
} as const;

/** Detail-URL query keys that uniquely identify a course at this CMS. */
const EXTERNAL_ID_KEYS = ["lct_seq", "seq", "idx", "id", "no"];

export const daeguLibraryAdapter: CourseAdapter = {
  key: "daegu-library-v1",
  name: "대구 시립도서관 (통합 CMS)",
  contentType: "course",

  async run(ctx: AdapterContext): Promise<AdapterResult> {
    const { sourceUrl, fetcher, logger } = ctx;
    const html = await fetcher.html(sourceUrl);
    const $ = cheerio.load(html);
    const courses: ParsedCourse[] = [];

    $(SEL.listItem).each((_, el) => {
      const $row = $(el);
      const $link = $row.find(SEL.titleLink).first();
      const href = $link.attr("href");
      if (!href || href === "#") return;

      const absoluteUrl = resolveUrl(href, sourceUrl);
      const externalId = pickExternalId(absoluteUrl) ?? absoluteUrl;

      const title = collapseWs($link.text());
      if (!title) return;

      const statusText = collapseWs($row.find(SEL.status).text());
      const applyText = collapseWs($row.find(SEL.applyPeriod).text());
      const periodText = collapseWs($row.find(SEL.coursePeriod).text());
      const instructorText = collapseWs($row.find(SEL.instructor).text());
      const feeText = collapseWs($row.find(SEL.fee).text());
      const capacityText = collapseWs($row.find(SEL.capacity).text());

      const [applyStartRaw, applyEndRaw] = splitRange(applyText);
      const [periodStartRaw, periodEndRaw] = splitRange(periodText);

      courses.push({
        externalId,
        title,
        instructor: stripLabel(instructorText, /강사[:：]?/) || undefined,
        startDate: periodStartRaw ? parseKoreanDate(periodStartRaw) : undefined,
        endDate: periodEndRaw ? parseKoreanDate(periodEndRaw) : undefined,
        applyStartAt: applyStartRaw ? parseKoreanDateTime(applyStartRaw) : undefined,
        applyEndAt: applyEndRaw ? parseKoreanDateTime(applyEndRaw) : undefined,
        fee: feeText ? parseFee(feeText) : 0,
        feeNote: feeText || undefined,
        capacity: parseCapacity(capacityText),
        applyUrl: absoluteUrl,
        applyMethod: "online",
        status: inferStatus(statusText),
        rawData: {
          statusText,
          applyText,
          periodText,
          instructorText,
          feeText,
          capacityText,
        },
      });
    });

    logger.info(`parsed ${courses.length} courses`, { sourceUrl });
    return { courses };
  },
};

function pickExternalId(url: string): string | undefined {
  const u = new URL(url);
  for (const key of EXTERNAL_ID_KEYS) {
    const v = u.searchParams.get(key);
    if (v) return `${key}=${v}`;
  }
  return undefined;
}

function collapseWs(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function splitRange(s: string): [string?, string?] {
  if (!s) return [];
  const parts = s.split(/[~∼〜-]/).map((p) => p.trim()).filter(Boolean);
  return [parts[0], parts[1]];
}

function stripLabel(s: string, label: RegExp): string {
  return s.replace(label, "").trim();
}

function parseCapacity(s: string): number | undefined {
  if (!s) return undefined;
  // "20/30" → 30, "정원 20명" → 20
  const ratio = s.match(/\d+\s*\/\s*(\d+)/);
  if (ratio) return Number(ratio[1]);
  const plain = s.match(/\d+/);
  return plain ? Number(plain[0]) : undefined;
}

function inferStatus(text: string): ParsedCourse["status"] {
  if (/마감|종료|완료/.test(text)) return "closed";
  if (/정원|만석|대기/.test(text)) return "full";
  if (/접수중|신청중|모집중|진행/.test(text)) return "open";
  if (/예정|준비/.test(text)) return "upcoming";
  return "upcoming";
}
