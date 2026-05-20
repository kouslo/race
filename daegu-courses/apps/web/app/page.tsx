import Link from "next/link";
import { api } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { Button, ButtonLink, Container } from "@/components/ui";
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
    <Container size="sm" className="py-10">
      <header className="flex items-center justify-between mb-8">
        <Link href="/" className="text-[20px] font-bold no-underline">
          대구 강좌
        </Link>
        {me ? (
          <div className="flex items-center gap-2">
            <ButtonLink href="/me" variant="secondary" size="sm">
              {me.nickname}님
            </ButtonLink>
            <form action="/logout" method="POST">
              <Button type="submit" variant="ghost" size="sm">
                로그아웃
              </Button>
            </form>
          </div>
        ) : (
          <ButtonLink href="/login" variant="secondary" size="sm">
            로그인
          </ButtonLink>
        )}
      </header>

      <section className="mt-10 mb-12">
        <h1 className="text-[32px] sm:text-[40px] font-bold leading-[1.2] tracking-tight">
          대구 전역의
          <br />
          강좌·문화행사를 한 곳에서.
        </h1>
        <p className="mt-4 text-[15px] text-foreground-muted leading-relaxed">
          기관별로 흩어진 강좌·행사 페이지를 통합 검색하고,
          관심 강좌의 접수 시작·마감 알림을 푸시로 받아보세요.
        </p>
        <div className="mt-7 flex gap-2">
          <ButtonLink href="/courses" size="lg">
            강좌 둘러보기
          </ButtonLink>
          {!me && (
            <ButtonLink href="/login" variant="secondary" size="lg">
              로그인
            </ButtonLink>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10">
        {[
          { t: "🔍 검색", d: "강좌명 자동완성으로 빠르게" },
          { t: "★ 즐겨찾기", d: "접수 시작·마감 자동 알림" },
          { t: "🔔 카테고리 구독", d: "새 강좌 등록 시 푸시" },
        ].map((f) => (
          <div
            key={f.t}
            className="bg-surface border border-border rounded-xl p-4"
          >
            <div className="font-semibold text-[14px]">{f.t}</div>
            <div className="mt-1 text-[12px] text-foreground-muted">{f.d}</div>
          </div>
        ))}
      </section>
    </Container>
  );
}
