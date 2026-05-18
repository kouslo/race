import { redirect } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { toggleCategorySubscriptionAction } from "./actions";

const CATEGORIES: { value: string; label: string; emoji: string }[] = [
  { value: "art", label: "예술", emoji: "🎨" },
  { value: "music", label: "음악", emoji: "🎵" },
  { value: "sports", label: "운동", emoji: "🏃" },
  { value: "language", label: "외국어", emoji: "🗣️" },
  { value: "cooking", label: "요리", emoji: "🍳" },
  { value: "tech", label: "기술", emoji: "💻" },
  { value: "humanities", label: "인문", emoji: "📚" },
  { value: "kids", label: "어린이", emoji: "👶" },
  { value: "senior", label: "시니어", emoji: "👴" },
  { value: "etc", label: "기타", emoji: "✨" },
];

const KIND_LABEL: Record<string, string> = {
  apply_open: "접수 시작",
  apply_closing: "접수 마감 임박",
  new_in_category: "카테고리 새 강좌",
};

export default async function NotificationsPage() {
  const token = await getAccessToken();
  if (!token) redirect("/login?next=/me/notifications");

  const [subs, deliveries] = await Promise.all([
    api.notifications.listSubscriptions(),
    api.notifications.deliveries().catch(() => ({ items: [] as Array<{ id: string; kind: string; targetId: string; sentAt: string }> })),
  ]);

  const subscribedCats = new Set(
    subs.items.filter((s) => s.type === "new_in_category").map((s) => s.category),
  );

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "32px 24px" }}>
      <nav style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>
        <Link href="/me">← 마이페이지</Link>
      </nav>
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>알림 설정</h1>

      <section style={panel}>
        <h2 style={panelTitle}>🔔 자동 알림 (즐겨찾기 기반)</h2>
        <p style={{ color: "#666", fontSize: 13, margin: 0, lineHeight: 1.6 }}>
          즐겨찾기한 강좌는 <b>접수 시작</b>과 <b>접수 마감 임박</b> 시점에 자동으로 푸시를 받습니다.
          별도 설정 없이 ★ 토글만으로 켜고 끄세요.
        </p>
        <div style={{ marginTop: 12 }}>
          <Link href="/me" style={smallLink}>
            즐겨찾기 관리 →
          </Link>
        </div>
      </section>

      <section style={panel}>
        <h2 style={panelTitle}>✨ 카테고리 새 강좌 알림</h2>
        <p style={{ color: "#666", fontSize: 13, margin: "0 0 16px", lineHeight: 1.6 }}>
          관심 카테고리를 선택해두면 새 강좌가 등록될 때 알려드립니다.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8 }}>
          {CATEGORIES.map((c) => {
            const on = subscribedCats.has(c.value);
            return (
              <form key={c.value} action={toggleCategorySubscriptionAction.bind(null, c.value)}>
                <button
                  type="submit"
                  style={{
                    width: "100%",
                    padding: "10px 8px",
                    border: `1px solid ${on ? "#111" : "#d4d4d4"}`,
                    background: on ? "#111" : "transparent",
                    color: on ? "#fff" : "inherit",
                    borderRadius: 8,
                    fontSize: 13,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <span style={{ fontSize: 18 }}>{c.emoji}</span>
                  <span>{c.label}</span>
                  <span style={{ fontSize: 10, opacity: 0.7 }}>{on ? "구독중" : "구독"}</span>
                </button>
              </form>
            );
          })}
        </div>
      </section>

      <section style={panel}>
        <h2 style={panelTitle}>📜 최근 알림 (50건)</h2>
        {deliveries.items.length === 0 ? (
          <p style={{ color: "#aaa", fontSize: 13, margin: 0 }}>받은 알림이 아직 없습니다.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
            {deliveries.items.map((d) => (
              <li
                key={d.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto",
                  gap: 10,
                  alignItems: "center",
                  fontSize: 13,
                  padding: "8px 0",
                  borderBottom: "1px solid #f0f0f0",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "#eef",
                    color: "#446",
                  }}
                >
                  {KIND_LABEL[d.kind] ?? d.kind}
                </span>
                <code style={{ fontSize: 11, color: "#888" }}>{d.targetId.slice(0, 8)}…</code>
                <span style={{ fontSize: 11, color: "#999" }}>
                  {new Date(d.sentAt).toLocaleString("ko-KR")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

const panel = {
  border: "1px solid #e5e5e5",
  borderRadius: 10,
  padding: 16,
  background: "var(--card, #fff)",
  marginBottom: 16,
} as const;
const panelTitle = { fontSize: 15, margin: "0 0 12px" } as const;
const smallLink = { fontSize: 13, color: "#0070f3", textDecoration: "none" } as const;
