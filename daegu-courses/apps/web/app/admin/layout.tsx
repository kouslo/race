import Link from "next/link";
import type { ReactNode } from "react";
import { Container } from "@/components/ui";
import { requireAdmin } from "@/lib/require-admin";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdmin();
  return (
    <Container size="lg" className="py-6">
      <header className="flex items-center justify-between border-b border-border pb-3 mb-6">
        <div className="flex items-center gap-5">
          <Link href="/admin" className="font-bold text-[18px] no-underline">
            🛠 Admin
          </Link>
          <nav className="flex gap-3.5 text-[13px] text-foreground-muted">
            <Link href="/admin/institutions" className="hover:text-foreground">
              기관
            </Link>
            <Link href="/admin/sources" className="hover:text-foreground">
              크롤 소스
            </Link>
            <Link href="/admin/logs" className="hover:text-foreground">
              로그
            </Link>
          </nav>
        </div>
        <div className="text-[12px] text-foreground-muted">
          {user.nickname} ·{" "}
          <Link href="/" className="underline">
            사이트로 돌아가기
          </Link>
        </div>
      </header>
      {children}
    </Container>
  );
}
