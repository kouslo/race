import { api } from "@/lib/api";
import type { CoursesListQuery } from "@daegu-courses/api-schemas";

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
  const district = typeof sp.district === "string" ? (sp.district as CoursesListQuery["district"]) : undefined;
  const status = typeof sp.status === "string" ? (sp.status as CoursesListQuery["status"]) : "open";

  const res = await api.courses.list({ q, district, status, pageSize: 20, sort: "applyEndSoon" });

  return (
    <main style={{ maxWidth: 1024, margin: "0 auto", padding: "32px 24px" }}>
      <h1 style={{ fontSize: 28, marginBottom: 16 }}>강좌</h1>

      <form style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="검색"
          style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #ccc", flex: 1, minWidth: 200 }}
        />
        <select name="district" defaultValue={district ?? ""} style={selectStyle}>
          <option value="">전체 지역</option>
          {DISTRICTS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={status} style={selectStyle}>
          <option value="open">접수중</option>
          <option value="upcoming">접수예정</option>
          <option value="closed">마감</option>
          <option value="full">정원마감</option>
        </select>
        <button type="submit" style={{ ...selectStyle, background: "#111", color: "#fff", border: 0 }}>
          검색
        </button>
      </form>

      <p style={{ color: "#666", marginBottom: 16 }}>총 {res.total}개</p>

      <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12 }}>
        {res.items.map((c) => (
          <li
            key={c.id}
            style={{
              border: "1px solid #e5e5e5",
              borderRadius: 10,
              padding: 16,
              background: "var(--card, #fff)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <a href={c.applyUrl} target="_blank" rel="noreferrer" style={{ fontWeight: 600, fontSize: 16 }}>
                {c.title}
              </a>
              <StatusBadge status={c.status} />
            </div>
            <div style={{ color: "#666", fontSize: 13, marginTop: 6 }}>
              {c.institution.name} · {c.institution.district}
              {c.startDate && ` · ${c.startDate}~${c.endDate ?? ""}`}
              {c.fee === 0 ? " · 무료" : ` · ${c.fee.toLocaleString()}원`}
            </div>
            {c.applyEndAt && (
              <div style={{ color: "#888", fontSize: 12, marginTop: 4 }}>
                접수마감 {new Date(c.applyEndAt).toLocaleString("ko-KR")}
              </div>
            )}
          </li>
        ))}
      </ul>

      {res.items.length === 0 && (
        <p style={{ color: "#999", textAlign: "center", padding: 40 }}>강좌가 없습니다.</p>
      )}
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    open: "#0a7d0a",
    upcoming: "#666",
    closed: "#999",
    full: "#c33",
    cancelled: "#999",
  };
  const label: Record<string, string> = {
    open: "접수중",
    upcoming: "예정",
    closed: "마감",
    full: "정원마감",
    cancelled: "취소",
  };
  return (
    <span
      style={{
        background: colors[status] ?? "#999",
        color: "#fff",
        fontSize: 11,
        padding: "2px 8px",
        borderRadius: 999,
        flexShrink: 0,
        alignSelf: "flex-start",
      }}
    >
      {label[status] ?? status}
    </span>
  );
}

const selectStyle = {
  padding: "8px 12px",
  borderRadius: 6,
  border: "1px solid #ccc",
  background: "transparent",
  color: "inherit",
} as const;
