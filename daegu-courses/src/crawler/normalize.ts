/**
 * Helpers to convert messy Korean-language strings from various sites
 * into the normalized fields our schema expects.
 */

/** "2025.03.01" / "2025-03-01" / "2025/03/01" → "2025-03-01" (ISO date) */
export function parseKoreanDate(input: string): string | undefined {
  const m = input.match(/(\d{4})\D(\d{1,2})\D(\d{1,2})/);
  if (!m) return undefined;
  const [, y, mo, d] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/** "2025.03.01 14:00" → Date in Asia/Seoul */
export function parseKoreanDateTime(input: string): Date | undefined {
  const dm = input.match(/(\d{4})\D(\d{1,2})\D(\d{1,2})(?:\D+(\d{1,2}):(\d{2}))?/);
  if (!dm) return undefined;
  const [, y, mo, d, h = "0", mi = "0"] = dm;
  // KST is UTC+9, no DST.
  const utcMs = Date.UTC(+y, +mo - 1, +d, +h - 9, +mi);
  return new Date(utcMs);
}

/** "30,000원" / "무료" / "5천원" → number (won) */
export function parseFee(input: string): number {
  const cleaned = input.replace(/\s+/g, "");
  if (/무료|free|0원/i.test(cleaned)) return 0;
  const won = cleaned.match(/([\d,]+)원/);
  if (won) return Number(won[1].replace(/,/g, ""));
  const cheon = cleaned.match(/([\d,]+)천원/);
  if (cheon) return Number(cheon[1].replace(/,/g, "")) * 1000;
  const man = cleaned.match(/([\d,]+)만원/);
  if (man) return Number(man[1].replace(/,/g, "")) * 10_000;
  return 0;
}

const DOW_MAP: Record<string, "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN"> = {
  월: "MON",
  화: "TUE",
  수: "WED",
  목: "THU",
  금: "FRI",
  토: "SAT",
  일: "SUN",
};

/** "매주 월,수 14:00~16:00" → schedule slots */
export function parseSchedule(input: string) {
  const time = input.match(/(\d{1,2}):(\d{2})\s*[~-]\s*(\d{1,2}):(\d{2})/);
  if (!time) return undefined;
  const [, sh, sm, eh, em] = time;
  const startTime = `${sh.padStart(2, "0")}:${sm}`;
  const endTime = `${eh.padStart(2, "0")}:${em}`;
  const days = Array.from(input.matchAll(/[월화수목금토일]/g))
    .map((m) => DOW_MAP[m[0]])
    .filter((d, i, a) => a.indexOf(d) === i);
  if (days.length === 0) return undefined;
  return days.map((dayOfWeek) => ({ dayOfWeek, startTime, endTime }));
}

/** Resolve a possibly-relative URL against the source page URL. */
export function resolveUrl(href: string, base: string): string {
  return new URL(href, base).toString();
}
