import { notFound } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { FavoriteButton } from "@/components/FavoriteButton";
import { ShareButton } from "@/components/ShareButton";

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

const STATUS_LABEL: Record<string, string> = {
  open: "접수중",
  upcoming: "접수예정",
  closed: "마감",
  full: "정원마감",
  cancelled: "취소",
};
const STATUS_COLOR: Record<string, string> = {
  open: "#0a7d0a",
  upcoming: "#666",
  closed: "#999",
  full: "#c33",
  cancelled: "#999",
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
    api.courses.similar(course.id).catch(() => ({ items: [] as Awaited<ReturnType<typeof api.courses.similar>>["items"] })),
  ]);
  const isFavorited = favs?.courses.some((f) => f.target.id === course.id) ?? false;

  const schedule = (course.schedule as { dayOfWeek: string; startTime: string; endTime: string }[] | null) ?? [];
  const description = (course as unknown as { description?: string | null }).description;
  const instructor = (course as unknown as { instructor?: string | null }).instructor;
  const targetAudience = (course as unknown as { targetAudience?: string | null }).targetAudience;
  const feeNote = (course as unknown as { feeNote?: string | null }).feeNote;
  const location = (course as unknown as { location?: string | null }).location;

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "24px" }}>
      <nav style={{ fontSize: 12, color: "#888", marginBottom: 16 }}>
        <Link href="/courses">← 강좌 목록</Link>
      </nav>

      <header style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <Pill bg={STATUS_COLOR[course.status] ?? "#999"} fg="#fff">
            {STATUS_LABEL[course.status] ?? course.status}
          </Pill>
          <Pill bg="#eee" fg="#333">
            {CATEGORY_LABEL[course.category] ?? course.category}
          </Pill>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <h1 style={{ fontSize: 24, margin: 0, lineHeight: 1.35, flex: 1 }}>{course.title}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <ShareButton title={course.title} />
            <FavoriteButton
              targetType="course"
              targetId={course.id}
              isFavorited={isFavorited}
              nextPath={`/courses/${course.id}`}
            />
          </div>
        </div>
        <div style={{ color: "#666", fontSize: 14, marginTop: 8 }}>
          <Link href={institution.homepageUrl ?? "#"} target="_blank" rel="noreferrer">
            {institution.name}
          </Link>{" "}
          · {institution.district}
        </div>
      </header>

      <a
        href={course.applyUrl}
        target="_blank"
        rel="noreferrer"
        style={{
          display: "block",
          background: STATUS_COLOR[course.status] ?? "#111",
          color: "#fff",
          textAlign: "center",
          padding: "14px",
          borderRadius: 10,
          textDecoration: "none",
          fontWeight: 700,
          marginBottom: 24,
        }}
      >
        {course.status === "open" ? "신청 페이지로 이동 →" : "원본 페이지로 이동 →"}
      </a>

      <Section title="개요">
        <Row label="강사" value={instructor || "—"} />
        <Row label="대상" value={targetAudience || "—"} />
        <Row label="수강료" value={course.fee === 0 ? "무료" : `${course.fee.toLocaleString()}원${feeNote ? ` (${feeNote})` : ""}`} />
        <Row label="장소" value={location || institution.address || institution.name} />
        <Row label="정원" value={course.capacity != null ? `${course.enrolled ?? 0} / ${course.capacity}` : "—"} />
      </Section>

      <Section title="일정">
        <Row label="강좌 기간" value={course.startDate ? `${course.startDate} ~ ${course.endDate ?? ""}` : "—"} />
        <Row
          label="요일·시간"
          value={
            schedule.length === 0
              ? "—"
              : schedule
                  .map((s) => `${DAY_LABEL[s.dayOfWeek] ?? s.dayOfWeek} ${s.startTime}~${s.endTime}`)
                  .join(", ")
          }
        />
        <Row
          label="접수 기간"
          value={
            course.applyStartAt && course.applyEndAt
              ? `${formatDt(course.applyStartAt)} ~ ${formatDt(course.applyEndAt)}`
              : "—"
          }
        />
      </Section>

      {description && (
        <Section title="안내">
          <p style={{ whiteSpace: "pre-wrap", color: "#333", lineHeight: 1.6, margin: 0 }}>{description}</p>
        </Section>
      )}

      {similar.items.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>비슷한 강좌</h2>
          <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 10 }}>
            {similar.items.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/courses/${s.id}`}
                  style={{
                    display: "block",
                    border: "1px solid #e5e5e5",
                    borderRadius: 10,
                    padding: 12,
                    background: "var(--card, #fff)",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{s.title}</span>
                    <Pill bg={STATUS_COLOR[s.status] ?? "#999"} fg="#fff">
                      {STATUS_LABEL[s.status] ?? s.status}
                    </Pill>
                  </div>
                  <div style={{ color: "#666", fontSize: 12, marginTop: 4 }}>
                    {s.institution.name} · {s.institution.district}
                    {s.fee === 0 ? " · 무료" : ` · ${s.fee.toLocaleString()}원`}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p style={{ color: "#aaa", fontSize: 11, marginTop: 32, textAlign: "center" }}>
        이 정보는 기관 페이지에서 자동 수집되었습니다. 최신 정보는 원본을 확인하세요.
      </p>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        border: "1px solid #e5e5e5",
        borderRadius: 10,
        padding: 16,
        background: "var(--card, #fff)",
        marginBottom: 16,
      }}
    >
      <h2 style={{ fontSize: 14, margin: "0 0 12px", color: "#666" }}>{title}</h2>
      <dl style={{ margin: 0, display: "grid", gap: 8 }}>{children}</dl>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 12, fontSize: 14 }}>
      <dt style={{ color: "#888" }}>{label}</dt>
      <dd style={{ margin: 0, color: "#222" }}>{value}</dd>
    </div>
  );
}

function Pill({ children, bg, fg }: { children: React.ReactNode; bg: string; fg: string }) {
  return (
    <span
      style={{
        background: bg,
        color: fg,
        fontSize: 11,
        padding: "2px 8px",
        borderRadius: 999,
      }}
    >
      {children}
    </span>
  );
}

function formatDt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
}
