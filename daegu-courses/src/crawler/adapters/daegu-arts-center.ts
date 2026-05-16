import * as cheerio from "cheerio";
import type { AdapterContext, AdapterResult, CourseAdapter, ParsedCourse } from "../types";
import {
  parseFee,
  parseKoreanDate,
  parseKoreanDateTime,
  parseSchedule,
  resolveUrl,
} from "../normalize";

/**
 * Sample adapter for a typical Korean institution course-listing page.
 *
 * Selectors below are placeholders mirroring a common table-based layout
 * (제목 / 강사 / 기간 / 신청기간 / 수강료). Tune them per real markup.
 */
export const daeguArtsCenterAdapter: CourseAdapter = {
  key: "daegu-arts-center-v1",
  name: "대구문화예술회관 (sample)",
  contentType: "course",

  async run(ctx: AdapterContext): Promise<AdapterResult> {
    const { sourceUrl, fetcher, logger } = ctx;
    const html = await fetcher.html(sourceUrl);
    const $ = cheerio.load(html);
    const courses: ParsedCourse[] = [];

    $("table.course-list tbody tr").each((_, el) => {
      const $row = $(el);
      const detailHref = $row.find("a.title").attr("href");
      if (!detailHref) return;

      const externalIdMatch = detailHref.match(/[?&](?:id|seq|no)=(\d+)/i);
      const externalId = externalIdMatch?.[1] ?? detailHref;

      const title = $row.find("a.title").text().trim();
      const instructor = $row.find("td.instructor").text().trim() || undefined;

      const periodText = $row.find("td.period").text().trim();
      const [startRaw, endRaw] = periodText.split(/[~-]/).map((s) => s.trim());
      const startDate = startRaw ? parseKoreanDate(startRaw) : undefined;
      const endDate = endRaw ? parseKoreanDate(endRaw) : undefined;

      const applyText = $row.find("td.apply-period").text().trim();
      const [applyStartRaw, applyEndRaw] = applyText.split(/[~-]/).map((s) => s.trim());
      const applyStartAt = applyStartRaw ? parseKoreanDateTime(applyStartRaw) : undefined;
      const applyEndAt = applyEndRaw ? parseKoreanDateTime(applyEndRaw) : undefined;

      const feeText = $row.find("td.fee").text().trim();
      const fee = parseFee(feeText);

      const scheduleText = $row.find("td.schedule").text().trim();
      const schedule = scheduleText ? parseSchedule(scheduleText) : undefined;

      const capacityText = $row.find("td.capacity").text().trim();
      const capacity = capacityText ? Number(capacityText.replace(/\D/g, "")) || undefined : undefined;

      const statusText = $row.find("td.status").text().trim();
      const status: ParsedCourse["status"] =
        /마감|종료/.test(statusText) ? "closed"
        : /정원|만석/.test(statusText) ? "full"
        : /접수중|신청/.test(statusText) ? "open"
        : "upcoming";

      courses.push({
        externalId,
        title,
        instructor,
        startDate,
        endDate,
        applyStartAt,
        applyEndAt,
        schedule,
        fee,
        feeNote: feeText || undefined,
        capacity,
        applyUrl: resolveUrl(detailHref, sourceUrl),
        applyMethod: "online",
        status,
        rawData: {
          periodText,
          applyText,
          feeText,
          scheduleText,
          capacityText,
          statusText,
        },
      });
    });

    logger.info(`parsed ${courses.length} courses`, { sourceUrl });
    return { courses };
  },
};
