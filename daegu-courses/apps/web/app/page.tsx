import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px" }}>
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>대구 강좌·문화행사</h1>
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
