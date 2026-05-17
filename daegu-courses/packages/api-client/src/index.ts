import type {
  CoursesListQuery,
  EventsListQuery,
  ListResponse,
} from "@daegu-courses/api-schemas";

export type ClientOptions = {
  baseUrl: string;
  /** Bearer token or user id forwarded as X-User-Id (favorites). */
  userId?: string;
  fetch?: typeof fetch;
};

export type CourseListItem = {
  id: string;
  title: string;
  category: string;
  status: string;
  fee: number;
  startDate: string | null;
  endDate: string | null;
  applyStartAt: string | null;
  applyEndAt: string | null;
  schedule: { dayOfWeek: string; startTime: string; endTime: string }[] | null;
  capacity: number | null;
  enrolled: number | null;
  thumbnailUrl: string | null;
  applyUrl: string;
  institution: { id: string; name: string; district: string };
};

export type EventListItem = {
  id: string;
  title: string;
  category: string;
  status: string;
  eventStartAt: string;
  eventEndAt: string | null;
  location: string;
  isFree: boolean;
  fee: number | null;
  needsReservation: boolean;
  reserveUrl: string | null;
  thumbnailUrl: string | null;
  institution: { id: string; name: string; district: string };
};

export type Institution = {
  id: string;
  name: string;
  slug: string;
  type: string;
  district: string;
  address: string | null;
  homepageUrl: string;
};

export function createClient(opts: ClientOptions) {
  const f = opts.fetch ?? fetch;
  const base = opts.baseUrl.replace(/\/$/, "");

  async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(init.headers as Record<string, string> | undefined),
    };
    if (init.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }
    if (opts.userId) headers["X-User-Id"] = opts.userId;

    const res = await f(`${base}${path}`, { ...init, headers });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new ApiError(res.status, text || res.statusText);
    }
    return (await res.json()) as T;
  }

  function toQuery(q: Record<string, unknown>): string {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) {
      if (v === undefined || v === null || v === "") continue;
      sp.set(k, v instanceof Date ? v.toISOString() : String(v));
    }
    const s = sp.toString();
    return s ? `?${s}` : "";
  }

  return {
    courses: {
      list: (q: Partial<CoursesListQuery> = {}) =>
        call<ListResponse<CourseListItem>>(`/api/v1/courses${toQuery(q)}`),
      byId: (id: string) =>
        call<{ course: CourseListItem & Record<string, unknown>; institution: Institution }>(
          `/api/v1/courses/${id}`,
        ),
    },
    events: {
      list: (q: Partial<EventsListQuery> = {}) =>
        call<ListResponse<EventListItem>>(`/api/v1/events${toQuery(q)}`),
      byId: (id: string) =>
        call<{ event: EventListItem & Record<string, unknown>; institution: Institution }>(
          `/api/v1/events/${id}`,
        ),
    },
    institutions: {
      list: (q: { district?: string; type?: string } = {}) =>
        call<{ items: Institution[] }>(`/api/v1/institutions${toQuery(q)}`),
    },
    favorites: {
      list: () => call<{ courses: unknown[]; events: unknown[] }>(`/api/v1/favorites`),
      add: (body: { targetType: "course" | "event"; targetId: string }) =>
        call(`/api/v1/favorites`, { method: "POST", body: JSON.stringify(body) }),
      remove: (id: string) =>
        call(`/api/v1/favorites/${id}`, { method: "DELETE" }),
    },
  };
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(`API ${status}: ${message}`);
  }
}

export type ApiClient = ReturnType<typeof createClient>;
