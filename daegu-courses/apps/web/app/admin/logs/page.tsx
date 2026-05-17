import { api } from "@/lib/api";

export default async function LogsPage() {
  const { items } = await api.admin.crawlLogs({ limit: 100 });

  return (
    <main>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>크롤 로그 (최근 100건)</h1>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={th}>시작</th>
            <th style={th}>상태</th>
            <th style={th}>발견 / 신규 / 업데이트 / 폐기</th>
            <th style={th}>에러</th>
          </tr>
        </thead>
        <tbody>
          {items.map((l) => (
            <tr key={l.id} style={{ borderTop: "1px solid #eee" }}>
              <td style={td}>{new Date(l.startedAt).toLocaleString("ko-KR")}</td>
              <td style={td}>
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: 999,
                    fontSize: 11,
                    background:
                      l.status === "success" ? "#0a7d0a" : l.status === "partial" ? "#c80" : "#c33",
                    color: "#fff",
                  }}
                >
                  {l.status}
                </span>
              </td>
              <td style={{ ...td, fontVariantNumeric: "tabular-nums" }}>
                {l.itemsFound} / {l.itemsCreated} / {l.itemsUpdated} / {l.itemsDeactivated}
              </td>
              <td style={{ ...td, color: "#c33", fontSize: 12, maxWidth: 400, wordBreak: "break-word" }}>
                {l.errorMessage}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length === 0 && <p style={{ color: "#999", padding: 24 }}>로그가 없습니다.</p>}
    </main>
  );
}

const tableStyle = { width: "100%", borderCollapse: "collapse" as const, fontSize: 14 };
const th = { textAlign: "left" as const, padding: "10px 8px", color: "#666", fontWeight: 500, borderBottom: "1px solid #ddd" };
const td = { padding: "10px 8px", verticalAlign: "top" as const };
