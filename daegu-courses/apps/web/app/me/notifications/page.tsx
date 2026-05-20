import { redirect } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { ButtonLink, Card, Container, Pill, Section } from "@/components/ui";
import { cn } from "@/components/ui/cn";
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
    api.notifications
      .deliveries()
      .catch(() => ({ items: [] as Array<{ id: string; kind: string; targetId: string; sentAt: string }> })),
  ]);

  const subscribedCats = new Set(
    subs.items.filter((s) => s.type === "new_in_category").map((s) => s.category),
  );

  return (
    <Container size="sm" className="py-8">
      <nav className="text-[12px] text-foreground-muted mb-3">
        <Link href="/me" className="hover:underline">
          ← 마이페이지
        </Link>
      </nav>
      <h1 className="text-[24px] font-bold mb-6">알림 설정</h1>

      <div className="grid gap-3">
        <Section title="🔔 자동 알림 (즐겨찾기 기반)">
          <p className="text-[13px] text-foreground-muted m-0 leading-relaxed">
            즐겨찾기한 강좌는 <b>접수 시작</b>과 <b>접수 마감 임박</b> 시점에
            자동으로 푸시를 받습니다. 별도 설정 없이 ★ 토글만으로 켜고 끄세요.
          </p>
          <div className="mt-3">
            <ButtonLink href="/me" variant="ghost" size="sm">
              즐겨찾기 관리 →
            </ButtonLink>
          </div>
        </Section>

        <Section title="✨ 카테고리 새 강좌 알림">
          <p className="text-[13px] text-foreground-muted mt-0 mb-4 leading-relaxed">
            관심 카테고리를 선택해두면 새 강좌가 등록될 때 알려드립니다.
          </p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2">
            {CATEGORIES.map((c) => {
              const on = subscribedCats.has(c.value);
              return (
                <form key={c.value} action={toggleCategorySubscriptionAction.bind(null, c.value)}>
                  <button
                    type="submit"
                    className={cn(
                      "w-full px-2 py-2.5 rounded-lg flex flex-col items-center gap-0.5 text-[13px] border transition-colors cursor-pointer",
                      on
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-transparent hover:bg-surface-muted",
                    )}
                  >
                    <span className="text-[18px]">{c.emoji}</span>
                    <span>{c.label}</span>
                    <span className={cn("text-[10px]", on ? "opacity-70" : "text-foreground-subtle")}>
                      {on ? "구독중" : "구독"}
                    </span>
                  </button>
                </form>
              );
            })}
          </div>
        </Section>

        <Section title="📜 최근 알림 (50건)">
          {deliveries.items.length === 0 ? (
            <p className="text-foreground-subtle text-[13px] m-0">받은 알림이 아직 없습니다.</p>
          ) : (
            <ul className="list-none p-0 m-0 grid gap-1">
              {deliveries.items.map((d) => (
                <li
                  key={d.id}
                  className="grid grid-cols-[auto_1fr_auto] gap-3 items-center text-[13px] py-1.5 border-b border-border last:border-b-0"
                >
                  <Pill variant="subtle">{KIND_LABEL[d.kind] ?? d.kind}</Pill>
                  <code className="text-[11px] text-foreground-subtle">
                    {d.targetId.slice(0, 8)}…
                  </code>
                  <span className="text-[11px] text-foreground-subtle">
                    {new Date(d.sentAt).toLocaleString("ko-KR")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </Container>
  );
}
