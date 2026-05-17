import Link from "next/link";
import { api } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import type { AuthUser } from "@daegu-courses/api-schemas";

export default async function HomePage() {
  const token = await getAccessToken();
  let me: AuthUser | null = null;
  if (token) {
    try {
      me = await api.auth.me();
    } catch {
      me = null;
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>대구 강좌·문화행사</h1>
        {me ? (
          <form action="/logout" method="POST">
            <span style={{ color: "#666", marginRight: 12, fontSize: 13 }}>
              {me.nickname}님
            </span>
            <button
              type="submit"
              style={{ padding: "6px 12px", border: "1px solid #ccc", borderRadius: 6, background: "transparent", cursor: "pointer" }}
            >
              로그아웃
            </button>
          </form>
        ) : (
          <Link href="/login" style={{ padding: "6px 12px", border: "1px solid #ccc", borderRadius: 6, textDecoration: "none" }}>
            로그인
          </Link>
        )}
      </header>

      <p style={{ color: "#666", marginBottom: 32 }}>
        대구 전역의 강좌와 문화행사를 한 곳에서 확인하고 바로 신청하세요.
      </p>
      <nav style={{ display: "flex", gap: 12 }}>
        <Link
          href="/courses"
          style={{
            padding: "12px 18px",
            background: "#111",
            color: "#fff",
            borderRadius: 8,
            textDecoration: "none",
          }}
        >
          강좌 둘러보기
        </Link>
      </nav>
    </main>
  );
}
