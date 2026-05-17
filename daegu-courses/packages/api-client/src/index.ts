import type {
  AuthSession,
  AuthUser,
  CoursesListQuery,
  CrawlSourceCreate,
  CrawlSourceUpdate,
  EventsListQuery,
  InstitutionCreate,
  InstitutionUpdate,
  KakaoCallbackInput,
  ListResponse,
  PushTokenRegister,
  RefreshOutput,
  SubscriptionCreate,
} from "@daegu-courses/api-schemas";

export type ClientOptions = {
  baseUrl: string;
  /** Static bearer token, or a getter to read it lazily (e.g. cookies). */
  accessToken?: string | (() => string | undefined | Promise<string | undefined>);
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

  async function resolveToken(): Promise<string | undefined> {
    if (!opts.accessToken) return undefined;
    return typeof opts.accessToken === "function"
      ? await opts.accessToken()
      : opts.accessToken;
  }

  async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(init.headers as Record<string, string> | undefined),
    };
    if (init.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }
    const token = await resolveToken();
    if (token) headers.Authorization = `Bearer ${token}`;

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
    auth: {
      kakaoCallback: (body: KakaoCallbackInput) =>
        call<AuthSession>(`/api/v1/auth/kakao/callback`, {
          method: "POST",
          body: JSON.stringify(body),
        }),
      refresh: (refreshToken: string) =>
        call<RefreshOutput>(`/api/v1/auth/refresh`, {
          method: "POST",
          body: JSON.stringify({ refreshToken }),
        }),
      logout: (refreshToken: string) =>
        call<{ ok: true }>(`/api/v1/auth/logout`, {
          method: "POST",
          body: JSON.stringify({ refreshToken }),
        }),
      me: () => call<AuthUser>(`/api/v1/auth/me`),
    },
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
    push: {
      register: (body: PushTokenRegister) =>
        call<{ id: string }>(`/api/v1/push/tokens`, {
          method: "POST",
          body: JSON.stringify(body),
        }),
      unregister: (id: string) =>
        call<{ ok: true }>(`/api/v1/push/tokens/${id}`, { method: "DELETE" }),
    },
    notifications: {
      subscribe: (body: SubscriptionCreate) =>
        call<{ id: string }>(`/api/v1/notifications/subscriptions`, {
          method: "POST",
          body: JSON.stringify(body),
        }),
      unsubscribe: (id: string) =>
        call<{ ok: true }>(`/api/v1/notifications/subscriptions/${id}`, { method: "DELETE" }),
      listSubscriptions: () =>
        call<{ items: Array<{ id: string; type: string; category: string | null; targetId: string | null }> }>(
          `/api/v1/notifications/subscriptions`,
        ),
      deliveries: () =>
        call<{ items: Array<{ id: string; kind: string; targetId: string; sentAt: string }> }>(
          `/api/v1/notifications/deliveries`,
        ),
    },
    admin: {
      stats: () =>
        call<{
          institutions: number;
          crawlSources: number;
          courses: number;
          events: number;
        }>(`/api/v1/admin/stats`),
      institutions: {
        list: () => call<{ items: Institution[] }>(`/api/v1/admin/institutions`),
        create: (body: InstitutionCreate) =>
          call<Institution>(`/api/v1/admin/institutions`, {
            method: "POST",
            body: JSON.stringify(body),
          }),
        update: (id: string, body: InstitutionUpdate) =>
          call<Institution>(`/api/v1/admin/institutions/${id}`, {
            method: "PATCH",
            body: JSON.stringify(body),
          }),
        remove: (id: string) =>
          call<{ ok: true }>(`/api/v1/admin/institutions/${id}`, { method: "DELETE" }),
      },
      adapters: () =>
        call<{ items: Array<{ key: string; name: string; contentType: string }> }>(
          `/api/v1/admin/adapters`,
        ),
      sources: {
        list: (institutionId?: string) =>
          call<{ items: AdminCrawlSourceRow[] }>(
            `/api/v1/admin/crawl-sources${toQuery({ institutionId })}`,
          ),
        create: (body: CrawlSourceCreate) =>
          call<AdminCrawlSource>(`/api/v1/admin/crawl-sources`, {
            method: "POST",
            body: JSON.stringify(body),
          }),
        update: (id: string, body: CrawlSourceUpdate) =>
          call<AdminCrawlSource>(`/api/v1/admin/crawl-sources/${id}`, {
            method: "PATCH",
            body: JSON.stringify(body),
          }),
        remove: (id: string) =>
          call<{ ok: true }>(`/api/v1/admin/crawl-sources/${id}`, { method: "DELETE" }),
        runNow: (id: string) =>
          call<{ ok: true; stats: { found: number; created: number; updated: number; deactivated: number } }>(
            `/api/v1/admin/crawl-sources/${id}/crawl`,
            { method: "POST" },
          ),
      },
      crawlLogs: (params: { sourceId?: string; limit?: number } = {}) =>
        call<{ items: AdminCrawlLog[] }>(`/api/v1/admin/crawl-logs${toQuery(params)}`),
    },
  };
}

export type AdminCrawlSource = {
  id: string;
  institutionId: string;
  sourceUrl: string;
  adapterKey: string;
  contentType: string;
  isActive: boolean;
  crawlIntervalMinutes: number;
  lastCrawledAt: string | null;
  lastSuccessAt: string | null;
  lastErrorMessage: string | null;
  consecutiveFailures: number;
  createdAt: string;
  updatedAt: string;
};
export type AdminCrawlSourceRow = {
  source: AdminCrawlSource;
  institution: { id: string; name: string; district: string };
};
export type AdminCrawlLog = {
  id: string;
  sourceId: string;
  startedAt: string;
  finishedAt: string | null;
  status: "success" | "partial" | "failed";
  itemsFound: number;
  itemsCreated: number;
  itemsUpdated: number;
  itemsDeactivated: number;
  errorMessage: string | null;
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(`API ${status}: ${message}`);
  }
}

export type ApiClient = ReturnType<typeof createClient>;
