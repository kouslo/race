import Link from "next/link";
import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/require-admin";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdmin();
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
          paddingBottom: 12,
          borderBottom: "1px solid #e5e5e5",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Link href="/admin" style={{ fontWeight: 700, fontSize: 18, textDecoration: "none" }}>
            🛠 Admin
          </Link>
          <nav style={{ display: "flex", gap: 14, fontSize: 14 }}>
            <Link href="/admin/institutions">기관</Link>
            <Link href="/admin/sources">크롤 소스</Link>
            <Link href="/admin/logs">로그</Link>
          </nav>
        </div>
        <div style={{ fontSize: 13, color: "#666" }}>
          {user.nickname} ·{" "}
          <Link href="/" style={{ textDecoration: "underline" }}>
            사이트로 돌아가기
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
