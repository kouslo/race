"use client";

import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui";

const ERRORS: Record<string, string> = {
  missing_code: "Kakao 응답에 인증 코드가 없습니다.",
  exchange_failed: "Kakao 인증에 실패했습니다. 다시 시도해주세요.",
  not_configured: "서버에 Kakao 클라이언트 ID가 설정돼 있지 않습니다.",
};

export default function LoginButton() {
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
    <>
      <Button onClick={handleKakao} variant="kakao" size="lg" className="w-full">
        카카오로 시작하기
      </Button>
      {errorKey && (
        <p className="text-danger text-[13px] mt-6">{ERRORS[errorKey] ?? errorKey}</p>
      )}
    </>
  );
}
