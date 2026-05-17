"use client";

import { useSearchParams } from "next/navigation";

const ERRORS: Record<string, string> = {
  missing_code: "Kakao 응답에 인증 코드가 없습니다.",
  exchange_failed: "Kakao 인증에 실패했습니다. 다시 시도해주세요.",
  not_configured: "서버에 Kakao 클라이언트 ID가 설정돼 있지 않습니다.",
};

export default function LoginPage() {
  const params = useSearchParams();
  const errorKey = params.get("error");

  const handleKakao = () => {
    const clientId = process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID;
    if (!clientId) {
      alert("NEXT_PUBLIC_KAKAO_CLIENT_ID is not configured.");
      return;
    }
    const redirectUri = `${window.location.origin}/auth/kakao/callback`;
    const state = crypto.randomUUID();
    const nonce = crypto.randomUUID();
    sessionStorage.setItem("dc_oauth_state", state);

    const url = new URL("https://kauth.kakao.com/oauth/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid profile_nickname profile_image account_email");
    url.searchParams.set("state", state);
    url.searchParams.set("nonce", nonce);
    window.location.href = url.toString();
  };

  return (
    <main style={{ maxWidth: 420, margin: "0 auto", padding: "64px 24px", textAlign: "center" }}>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>로그인</h1>
      <p style={{ color: "#666", marginBottom: 32 }}>
        즐겨찾기·알림을 사용하려면 로그인이 필요합니다.
      </p>
      <button
        onClick={handleKakao}
        style={{
          width: "100%",
          background: "#fee500",
          color: "#191919",
          padding: "14px 18px",
          border: 0,
          borderRadius: 8,
          fontWeight: 700,
          fontSize: 15,
          cursor: "pointer",
        }}
      >
        카카오로 시작하기
      </button>
      {errorKey && (
        <p style={{ color: "#c33", marginTop: 24, fontSize: 13 }}>
          {ERRORS[errorKey] ?? errorKey}
        </p>
      )}
    </main>
  );
}
