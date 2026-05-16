import { request } from "undici";
import type { Fetcher } from "./types";

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; DaeguCoursesBot/0.1; +https://example.com/bot)",
  "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
};

export function createFetcher(opts: { timeoutMs?: number } = {}): Fetcher {
  const timeout = opts.timeoutMs ?? 15_000;

  async function fetchText(url: string, init?: { headers?: Record<string, string> }) {
    const ctl = AbortSignal.timeout(timeout);
    const res = await request(url, {
      method: "GET",
      headers: { ...DEFAULT_HEADERS, ...init?.headers },
      signal: ctl,
      maxRedirections: 5,
    });
    if (res.statusCode >= 400) {
      throw new Error(`HTTP ${res.statusCode} for ${url}`);
    }
    return res.body.text();
  }

  return {
    html: fetchText,
    async json<T>(url: string, init?: { headers?: Record<string, string> }): Promise<T> {
      const text = await fetchText(url, init);
      return JSON.parse(text) as T;
    },
  };
}
