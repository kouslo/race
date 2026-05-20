import { api } from "@/lib/api";
import { Card } from "@/components/ui";

export default async function AdminDashboard() {
  const stats = await api.admin.stats();
  const items: Array<{ label: string; value: number }> = [
    { label: "기관", value: stats.institutions },
    { label: "크롤 소스", value: stats.crawlSources },
    { label: "강좌", value: stats.courses },
    { label: "행사", value: stats.events },
  ];

  return (
    <main>
      <h1 className="text-[22px] font-bold mb-6">대시보드</h1>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
        {items.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="text-[12px] text-foreground-muted">{s.label}</div>
            <div className="text-[28px] font-bold mt-1">{s.value.toLocaleString()}</div>
          </Card>
        ))}
      </div>
    </main>
  );
}
