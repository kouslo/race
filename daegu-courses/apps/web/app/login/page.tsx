import { Suspense } from "react";
import { Container } from "@/components/ui";
import LoginButton from "./LoginButton";

export default function LoginPage() {
  return (
    <Container size="sm" className="py-16 text-center">
      <h1 className="text-[24px] font-bold mb-3">로그인</h1>
      <p className="text-foreground-muted text-[14px] mb-8">
        즐겨찾기·알림을 사용하려면 로그인이 필요합니다.
      </p>
      <Suspense fallback={null}>
        <LoginButton />
      </Suspense>
    </Container>
  );
}
