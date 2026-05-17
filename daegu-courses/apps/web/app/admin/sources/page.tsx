import { api } from "@/lib/api";
import {
  createSourceAction,
  deleteSourceAction,
  runSourceAction,
  toggleSourceAction,
} from "../actions";

export default async function SourcesPage() {
  const [{ items: sources }, { items: institutions }, { items: adapters }] = await Promise.all([
    api.admin.sources.list(),
    api.admin.institutions.list(),
    api.admin.adapters(),
  ]);

  return (
    <main>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>크롤 소스</h1>

      <section
        style={{
          border: "1px solid #e5e5e5",
          borderRadius: 10,
          padding: 16,
          marginBottom: 24,
          background: "var(--card, #fff)",
        }}
      >
        <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 12 }}>새 소스 추가</h2>
        <form
          action={createSourceAction}
          style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}
        >
          <select name="institutionId" required style={input}>
            <option value="">기관 선택…</option>
            {institutions.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} ({i.district})
              </option>
            ))}
          </select>
          <select name="adapterKey" required style={input}>
            <option value="">어댑터 선택…</option>
            {adapters.map((a) => (
              <option key={a.key} value={a.key}>
                {a.name} — {a.key}
              </option>
            ))}
          </select>
          <input
            name="sourceUrl"
            type="url"
            placeholder="강좌 목록 URL"
            required
            style={{ ...input, gridColumn: "1 / -1" }}
          />
          <select name="contentType" defaultValue="course" style={input}>
            <option value="course">course</option>
            <option value="event">event</option>
            <option value="both">both</option>
          </select>
          <input
            name="crawlIntervalMinutes"
            type="number"
            min={5}
            defaultValue={1440}
            placeholder="크롤 주기 (분)"
            style={input}
          />
          <button type="submit" style={{ ...button, gridColumn: "1 / -1" }}>
            추가
          </button>
        </form>
      </section>

      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={th}>기관</th>
            <th style={th}>어댑터</th>
            <th style={th}>URL</th>
            <th style={th}>활성</th>
            <th style={th}>최근 크롤</th>
            <th style={th}>액션</th>
          </tr>
        </thead>
        <tbody>
          {sources.map(({ source, institution }) => (
            <tr key={source.id} style={{ borderTop: "1px solid #eee" }}>
              <td style={td}>
                {institution.name}
                <div style={{ color: "#999", fontSize: 11 }}>{institution.district}</div>
              </td>
              <td style={td}>
                <code style={{ fontSize: 11 }}>{source.adapterKey}</code>
              </td>
              <td style={{ ...td, maxWidth: 320, wordBreak: "break-all" }}>
                <a href={source.sourceUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
                  {source.sourceUrl}
                </a>
              </td>
              <td style={td}>
                <form action={toggleSourceAction.bind(null, source.id, !source.isActive)}>
                  <button type="submit" style={source.isActive ? activeButton : inactiveButton}>
                    {source.isActive ? "활성" : "비활성"}
                  </button>
                </form>
              </td>
              <td style={td}>
                {source.lastSuccessAt
                  ? new Date(source.lastSuccessAt).toLocaleString("ko-KR")
                  : "—"}
                {source.consecutiveFailures > 0 && (
                  <div style={{ color: "#c33", fontSize: 11 }}>
                    실패 {source.consecutiveFailures}회
                  </div>
                )}
              </td>
              <td style={td}>
                <div style={{ display: "flex", gap: 6 }}>
                  <form action={runSourceAction.bind(null, source.id)}>
                    <button type="submit" style={smallButton}>
                      ▶ 지금
                    </button>
                  </form>
                  <form action={deleteSourceAction.bind(null, source.id)}>
                    <button type="submit" style={dangerButton}>
                      삭제
                    </button>
                  </form>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {sources.length === 0 && (
        <p style={{ color: "#999", padding: 24 }}>등록된 크롤 소스가 없습니다.</p>
      )}
    </main>
  );
}

const input = { padding: "8px 10px", border: "1px solid #ccc", borderRadius: 6, background: "transparent", color: "inherit" } as const;
const button = { padding: "10px", background: "#111", color: "#fff", border: 0, borderRadius: 6, cursor: "pointer" } as const;
const smallButton = { padding: "4px 10px", background: "#111", color: "#fff", border: 0, borderRadius: 4, fontSize: 12, cursor: "pointer" } as const;
const dangerButton = { padding: "4px 10px", background: "transparent", color: "#c33", border: "1px solid #ccc", borderRadius: 4, fontSize: 12, cursor: "pointer" } as const;
const activeButton = { padding: "4px 10px", background: "#0a7d0a", color: "#fff", border: 0, borderRadius: 999, fontSize: 11, cursor: "pointer" } as const;
const inactiveButton = { ...activeButton, background: "#999" } as const;
const tableStyle = { width: "100%", borderCollapse: "collapse" as const, fontSize: 14 };
const th = { textAlign: "left" as const, padding: "10px 8px", color: "#666", fontWeight: 500, borderBottom: "1px solid #ddd" };
const td = { padding: "10px 8px", verticalAlign: "top" as const };
