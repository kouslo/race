import { notFound } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { FavoriteButton } from "@/components/FavoriteButton";
import { ShareButton } from "@/components/ShareButton";
import { ButtonLink, Card, Container, Pill, Section, StatusPill } from "@/components/ui";

type Params = Promise<{ id: string }>;

const DAY_LABEL: Record<string, string> = {
  MON: "월",
  TUE: "화",
  WED: "수",
  THU: "목",
  FRI: "금",
  SAT: "토",
  SUN: "일",
};

const CATEGORY_LABEL: Record<string, string> = {
  art: "예술",
  music: "음악",
  sports: "운동",
  language: "외국어",
  cooking: "요리",
  tech: "기술",
  humanities: "인문",
  kids: "어린이",
  senior: "시니어",
  etc: "기타",
};

export default async function CourseDetailPage({ params }: { params: Params }) {
  const { id } = await params;

  let res;
  try {
    res = await api.courses.byId(id);
  } catch {
    notFound();
  }
  const { course, institution } = res;

  const token = await getAccessToken();
  const [favs, similar] = await Promise.all([
    token ? api.favorites.list().catch(() => null) : Promise.resolve(null),
    api.courses
      .similar(course.id)
      .catch(() => ({ items: [] as Awaited<ReturnType<typeof api.courses.similar>>["items"] })),
  ]);
  const isFavorited = favs?.courses.some((f) => f.target.id === course.id) ?? false;

  const schedule =
    (course.schedule as { dayOfWeek: string; startTime: string; endTime: string }[] | null) ?? [];
  const description = (course as unknown as { description?: string | null }).description;
  const instructor = (course as unknown as { instructor?: string | null }).instructor;
  const targetAudience = (course as unknown as { targetAudience?: string | null }).targetAudience;
  const feeNote = (course as unknown as { feeNote?: string | null }).feeNote;
  const location = (course as unknown as { location?: string | null }).location;

  return (
    <Container size="sm" className="py-6">
      <nav className="text-[12px] text-foreground-muted mb-4">
        <Link href="/courses" className="hover:underline">
          ← 강좌 목록
        </Link>
      </nav>

      <header className="mb-5">
        <div className="flex gap-1.5 mb-2">
          <StatusPill status={course.status} />
          <Pill variant="subtle">{CATEGORY_LABEL[course.category] ?? course.category}</Pill>
        </div>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-[24px] font-bold leading-snug flex-1">{course.title}</h1>
          <div className="flex items-center gap-3.5">
            <ShareButton title={course.title} />
            <FavoriteButton
              targetType="course"
              targetId={course.id}
              isFavorited={isFavorited}
              nextPath={`/courses/${course.id}`}
            />
          </div>
        </div>
        <div className="mt-2 text-[14px] text-foreground-muted">
          <Link
            href={institution.homepageUrl ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="hover:underline"
          >
            {institution.name}
          </Link>{" "}
          · {institution.district}
        </div>
      </header>

      <ButtonLink
        href={course.applyUrl}
        external
        size="lg"
        className="w-full mb-6"
      >
        {course.status === "open" ? "신청 페이지로 이동 →" : "원본 페이지로 이동 →"}
      </ButtonLink>

      <div className="grid gap-3">
        <Section title="개요">
          <Dl rows={[
            { label: "강사", value: instructor || "—" },
            { label: "대상", value: targetAudience || "—" },
            {
              label: "수강료",
              value:
                course.fee === 0
                  ? "무료"
                  : `${course.fee.toLocaleString()}원${feeNote ? ` (${feeNote})` : ""}`,
            },
            { label: "장소", value: location || institution.address || institution.name },
            {
              label: "정원",
              value: course.capacity != null ? `${course.enrolled ?? 0} / ${course.capacity}` : "—",
            },
          ]} />
        </Section>

        <Section title="일정">
          <Dl rows={[
            {
              label: "강좌 기간",
              value: course.startDate ? `${course.startDate} ~ ${course.endDate ?? ""}` : "—",
            },
            {
              label: "요일·시간",
              value:
                schedule.length === 0
                  ? "—"
                  : schedule
                      .map((s) => `${DAY_LABEL[s.dayOfWeek] ?? s.dayOfWeek} ${s.startTime}~${s.endTime}`)
                      .join(", "),
            },
            {
              label: "접수 기간",
              value:
                course.applyStartAt && course.applyEndAt
                  ? `${formatDt(course.applyStartAt)} ~ ${formatDt(course.applyEndAt)}`
                  : "—",
            },
          ]} />
        </Section>

        {description && (
          <Section title="안내">
            <p className="whitespace-pre-wrap text-[14px] text-foreground leading-relaxed m-0">
              {description}
            </p>
          </Section>
        )}
      </div>

      {similar.items.length > 0 && (
        <section className="mt-7">
          <h2 className="text-[15px] font-semibold mb-3">비슷한 강좌</h2>
          <ul className="list-none p-0 grid gap-2">
            {similar.items.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/courses/${s.id}`}
                  className="block no-underline text-foreground"
                >
                  <Card hover className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[13.5px] font-semibold">{s.title}</span>
                      <StatusPill status={s.status} />
                    </div>
                    <div className="mt-1 text-[11.5px] text-foreground-muted">
                      {s.institution.name} · {s.institution.district}
                      {s.fee === 0 ? " · 무료" : ` · ${s.fee.toLocaleString()}원`}
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-foreground-subtle text-[11px] mt-8 text-center">
        이 정보는 기관 페이지에서 자동 수집되었습니다. 최신 정보는 원본을 확인하세요.
      </p>
    </Container>
  );
}

function Dl({ rows }: { rows: Array<{ label: string; value: React.ReactNode }> }) {
  return (
    <dl className="m-0 grid gap-2">
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[80px_1fr] gap-3 text-[13.5px]">
          <dt className="text-foreground-subtle">{r.label}</dt>
          <dd className="m-0 text-foreground">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function formatDt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
}
