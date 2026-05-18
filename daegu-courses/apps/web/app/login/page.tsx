import { Suspense } from "react";
import LoginButton from "./LoginButton";

export default function LoginPage() {
  return (
    <main style={{ maxWidth: 420, margin: "0 auto", padding: "64px 24px", textAlign: "center" }}>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>로그인</h1>
      <p style={{ color: "#666", marginBottom: 32 }}>
        즐겨찾기·알림을 사용하려면 로그인이 필요합니다.
      </p>
      <Suspense fallback={null}>
        <LoginButton />
      </Suspense>
    </main>
  );
}
