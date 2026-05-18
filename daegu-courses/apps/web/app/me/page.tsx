import Link from "next/link";
import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { FavoriteButton } from "@/components/FavoriteButton";

export default async function MePage() {
  const token = await getAccessToken();
  if (!token) redirect("/login?next=/me");

  let me;
  try {
    me = await api.auth.me();
  } catch {
    redirect("/login?next=/me");
  }
  const favs = await api.favorites.list();

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, margin: 0 }}>{me.nickname}</h1>
          <div style={{ color: "#666", fontSize: 13, marginTop: 4 }}>{me.email ?? me.provider}</div>
        </div>
        <form action="/logout" method="POST">
          <button
            type="submit"
            style={{ padding: "6px 12px", border: "1px solid #ccc", borderRadius: 6, background: "transparent", cursor: "pointer" }}
          >
            로그아웃
          </button>
        </form>
      </header>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>즐겨찾기한 강좌 ({favs.courses.length})</h2>
        {favs.courses.length === 0 ? (
          <EmptyState>
            <Link href="/courses">강좌 둘러보기</Link>로 가서 관심 있는 강좌의 ★을 눌러보세요.
          </EmptyState>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 10 }}>
            {favs.courses.map((f) => (
              <li
                key={f.id}
                style={{
                  border: "1px solid #e5e5e5",
                  borderRadius: 10,
                  padding: 14,
                  background: "var(--card, #fff)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <a href={f.target.applyUrl} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>
                    {f.target.title}
                  </a>
                  <FavoriteButton
                    targetType="course"
                    targetId={f.target.id}
                    isFavorited={true}
                    nextPath="/me"
                  />
                </div>
                <div style={{ color: "#666", fontSize: 13, marginTop: 6 }}>
                  {f.target.institution.name}
                  {f.target.startDate && ` · ${f.target.startDate}~`}
                </div>
                {f.target.applyEndAt && (
                  <div style={{ color: "#888", fontSize: 12, marginTop: 4 }}>
                    접수마감 {new Date(f.target.applyEndAt).toLocaleString("ko-KR")}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>즐겨찾기한 행사 ({favs.events.length})</h2>
        {favs.events.length === 0 ? (
          <EmptyState>관심 있는 문화행사가 생기면 여기에 모입니다.</EmptyState>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 10 }}>
            {favs.events.map((f) => (
              <li
                key={f.id}
                style={{
                  border: "1px solid #e5e5e5",
                  borderRadius: 10,
                  padding: 14,
                  background: "var(--card, #fff)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <a href={f.target.reserveUrl ?? "#"} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>
                    {f.target.title}
                  </a>
                  <FavoriteButton
                    targetType="event"
                    targetId={f.target.id}
                    isFavorited={true}
                    nextPath="/me"
                  />
                </div>
                <div style={{ color: "#666", fontSize: 13, marginTop: 6 }}>
                  {f.target.institution.name} · {f.target.location}
                </div>
                <div style={{ color: "#888", fontSize: 12, marginTop: 4 }}>
                  {new Date(f.target.eventStartAt).toLocaleString("ko-KR")}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        border: "1px dashed #ddd",
        borderRadius: 10,
        padding: 24,
        textAlign: "center",
        color: "#888",
        fontSize: 13,
      }}
    >
      {children}
    </div>
  );
}
