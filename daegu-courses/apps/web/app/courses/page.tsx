import Link from "next/link";
import { api } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { FavoriteButton } from "@/components/FavoriteButton";
import { SearchInput } from "@/components/SearchInput";
import {
  Button,
  Card,
  Container,
  SelectInput,
  StatusPill,
} from "@/components/ui";
import type { CoursesListQuery } from "@daegu-courses/api-schemas";

const PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const DISTRICTS: CoursesListQuery["district"][] = [
  "중구",
  "동구",
  "서구",
  "남구",
  "북구",
  "수성구",
  "달서구",
  "달성군",
  "군위군",
];

export default async function CoursesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const district =
    typeof sp.district === "string" ? (sp.district as CoursesListQuery["district"]) : undefined;
  const status =
    typeof sp.status === "string" ? (sp.status as CoursesListQuery["status"]) : "open";

  const sort: CoursesListQuery["sort"] = q ? "relevance" : "applyEndSoon";
  const [res, favoritedIds] = await Promise.all([
    api.courses.list({ q, district, status, pageSize: 20, sort }),
    loadFavoritedCourseIds(),
  ]);

  const nextPath = `/courses?${new URLSearchParams(
    Object.fromEntries(
      Object.entries({ q, district, status }).filter(([, v]) => v),
    ) as Record<string, string>,
  ).toString()}`;

  return (
    <Container size="lg" className="py-8">
      <header className="mb-6 flex items-baseline justify-between gap-4">
        <h1 className="text-[24px] font-bold">강좌</h1>
        <Link
          href="/"
          className="text-[12px] text-foreground-muted hover:underline"
        >
          홈으로
        </Link>
      </header>

      <form className="grid grid-cols-[1fr_auto_auto_auto] gap-2 mb-6 max-sm:grid-cols-2">
        <div className="max-sm:col-span-2">
          <SearchInput apiBaseUrl={PUBLIC_API_BASE_URL} defaultValue={q ?? ""} />
        </div>
        <SelectInput name="district" defaultValue={district ?? ""}>
          <option value="">전체 지역</option>
          {DISTRICTS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </SelectInput>
        <SelectInput name="status" defaultValue={status}>
          <option value="open">접수중</option>
          <option value="upcoming">접수예정</option>
          <option value="closed">마감</option>
          <option value="full">정원마감</option>
        </SelectInput>
        <Button type="submit">검색</Button>
      </form>

      <p className="text-[12px] text-foreground-muted mb-3">총 {res.total}개</p>

      <ul className="list-none p-0 grid gap-2">
        {res.items.map((c) => (
          <Card as="li" key={c.id} hover className="p-4">
            <div className="flex items-start justify-between gap-3">
              <Link
                href={`/courses/${c.id}`}
                className="font-semibold text-[15px] no-underline text-foreground flex-1"
              >
                {c.title}
              </Link>
              <div className="flex items-center gap-3 shrink-0">
                <FavoriteButton
                  targetType="course"
                  targetId={c.id}
                  isFavorited={favoritedIds.has(c.id)}
                  nextPath={nextPath}
                />
                <StatusPill status={c.status} />
              </div>
            </div>
            <div className="mt-1.5 text-[12.5px] text-foreground-muted">
              {c.institution.name} · {c.institution.district}
              {c.startDate && ` · ${c.startDate}~${c.endDate ?? ""}`}
              {c.fee === 0 ? " · 무료" : ` · ${c.fee.toLocaleString()}원`}
            </div>
            {c.applyEndAt && (
              <div className="mt-1 text-[11.5px] text-foreground-subtle">
                접수마감 {new Date(c.applyEndAt).toLocaleString("ko-KR")}
              </div>
            )}
          </Card>
        ))}
      </ul>

      {res.items.length === 0 && (
        <p className="text-foreground-subtle text-center py-10">강좌가 없습니다.</p>
      )}
    </Container>
  );
}

async function loadFavoritedCourseIds(): Promise<Set<string>> {
  const token = await getAccessToken();
  if (!token) return new Set();
  try {
    const favs = await api.favorites.list();
    return new Set(favs.courses.map((f) => f.target.id));
  } catch {
    return new Set();
  }
}
