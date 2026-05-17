import { api } from "@/lib/api";

export default async function AdminDashboard() {
  const stats = await api.admin.stats();
  const items: Array<{ label: string; value: number }> = [
    { label: "기관", value: stats.institutions },
    { label: "크롤 소스", value: stats.crawlSources },
    { label: "강좌", value: stats.courses },
    { label: "행사", value: stats.events },
  ];

  return (
    <main>
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>대시보드</h1>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        {items.map((s) => (
          <div
            key={s.label}
            style={{
              border: "1px solid #e5e5e5",
              borderRadius: 10,
              padding: 16,
              background: "var(--card, #fff)",
            }}
          >
            <div style={{ fontSize: 13, color: "#666" }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>
              {s.value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
