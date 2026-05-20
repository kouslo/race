import Link from "next/link";
import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { FavoriteButton } from "@/components/FavoriteButton";
import { Button, ButtonLink, Card, Container } from "@/components/ui";

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
    <Container size="md" className="py-8">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[24px] font-bold m-0">{me.nickname}</h1>
          <div className="text-[12.5px] text-foreground-muted mt-1">
            {me.email ?? me.provider}
          </div>
        </div>
        <div className="flex gap-2">
          <ButtonLink href="/me/notifications" variant="secondary" size="sm">
            🔔 알림 설정
          </ButtonLink>
          <form action="/logout" method="POST">
            <Button type="submit" variant="ghost" size="sm">
              로그아웃
            </Button>
          </form>
        </div>
      </header>

      <section className="mb-8">
        <h2 className="text-[16px] font-semibold mb-3">
          즐겨찾기한 강좌{" "}
          <span className="text-foreground-subtle font-normal">({favs.courses.length})</span>
        </h2>
        {favs.courses.length === 0 ? (
          <EmptyState>
            <Link href="/courses" className="underline">
              강좌 둘러보기
            </Link>
            로 가서 관심 있는 강좌의 ★을 눌러보세요.
          </EmptyState>
        ) : (
          <ul className="list-none p-0 grid gap-2">
            {favs.courses.map((f) => (
              <Card as="li" hover key={f.id} className="p-3.5">
                <div className="flex justify-between gap-3">
                  <Link
                    href={`/courses/${f.target.id}`}
                    className="font-semibold no-underline text-foreground"
                  >
                    {f.target.title}
                  </Link>
                  <FavoriteButton
                    targetType="course"
                    targetId={f.target.id}
                    isFavorited={true}
                    nextPath="/me"
                  />
                </div>
                <div className="mt-1.5 text-[12.5px] text-foreground-muted">
                  {f.target.institution.name}
                  {f.target.startDate && ` · ${f.target.startDate}~`}
                </div>
                {f.target.applyEndAt && (
                  <div className="mt-1 text-[11.5px] text-foreground-subtle">
                    접수마감 {new Date(f.target.applyEndAt).toLocaleString("ko-KR")}
                  </div>
                )}
              </Card>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-[16px] font-semibold mb-3">
          즐겨찾기한 행사{" "}
          <span className="text-foreground-subtle font-normal">({favs.events.length})</span>
        </h2>
        {favs.events.length === 0 ? (
          <EmptyState>관심 있는 문화행사가 생기면 여기에 모입니다.</EmptyState>
        ) : (
          <ul className="list-none p-0 grid gap-2">
            {favs.events.map((f) => (
              <Card as="li" hover key={f.id} className="p-3.5">
                <div className="flex justify-between gap-3">
                  <a
                    href={f.target.reserveUrl ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold no-underline text-foreground"
                  >
                    {f.target.title}
                  </a>
                  <FavoriteButton
                    targetType="event"
                    targetId={f.target.id}
                    isFavorited={true}
                    nextPath="/me"
                  />
                </div>
                <div className="mt-1.5 text-[12.5px] text-foreground-muted">
                  {f.target.institution.name} · {f.target.location}
                </div>
                <div className="mt-1 text-[11.5px] text-foreground-subtle">
                  {new Date(f.target.eventStartAt).toLocaleString("ko-KR")}
                </div>
              </Card>
            ))}
          </ul>
        )}
      </section>
    </Container>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-dashed border-border rounded-xl px-6 py-7 text-center text-foreground-subtle text-[13px]">
      {children}
    </div>
  );
}
