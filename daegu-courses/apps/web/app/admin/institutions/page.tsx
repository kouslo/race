import { api } from "@/lib/api";
import { createInstitutionAction, deleteInstitutionAction } from "../actions";

const DISTRICTS = [
  "중구",
  "동구",
  "서구",
  "남구",
  "북구",
  "수성구",
  "달서구",
  "달성군",
  "군위군",
];
const TYPES = [
  "culture_center",
  "library",
  "community",
  "museum",
  "school",
  "private",
  "etc",
];

export default async function InstitutionsPage() {
  const { items } = await api.admin.institutions.list();

  return (
    <main>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>기관</h1>

      <section
        style={{
          border: "1px solid #e5e5e5",
          borderRadius: 10,
          padding: 16,
          marginBottom: 24,
          background: "var(--card, #fff)",
        }}
      >
        <h2 style={{ fontSize: 15, marginTop: 0, marginBottom: 12 }}>새 기관 추가</h2>
        <form action={createInstitutionAction} style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
          <input name="name" placeholder="기관명" required style={input} />
          <input name="slug" placeholder="slug (영문-소문자)" required style={input} />
          <select name="type" required style={input} defaultValue="library">
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select name="district" required style={input}>
            {DISTRICTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <input
            name="homepageUrl"
            type="url"
            placeholder="홈페이지 URL"
            required
            style={{ ...input, gridColumn: "1 / -1" }}
          />
          <input name="address" placeholder="주소 (선택)" style={input} />
          <input name="phone" placeholder="전화 (선택)" style={input} />
          <button type="submit" style={{ ...button, gridColumn: "1 / -1" }}>
            추가
          </button>
        </form>
      </section>

      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={th}>이름</th>
            <th style={th}>slug</th>
            <th style={th}>유형</th>
            <th style={th}>지역</th>
            <th style={th}>홈페이지</th>
            <th style={th}></th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id} style={{ borderTop: "1px solid #eee" }}>
              <td style={td}>{i.name}</td>
              <td style={td}>{i.slug}</td>
              <td style={td}>{i.type}</td>
              <td style={td}>{i.district}</td>
              <td style={td}>
                <a href={i.homepageUrl} target="_blank" rel="noreferrer">
                  link
                </a>
              </td>
              <td style={td}>
                <form action={deleteInstitutionAction.bind(null, i.id)}>
                  <button type="submit" style={dangerButton}>
                    삭제
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length === 0 && <p style={{ color: "#999", padding: 24 }}>등록된 기관이 없습니다.</p>}
    </main>
  );
}

const input = { padding: "8px 10px", border: "1px solid #ccc", borderRadius: 6, background: "transparent", color: "inherit" } as const;
const button = { padding: "10px", background: "#111", color: "#fff", border: 0, borderRadius: 6, cursor: "pointer" } as const;
const dangerButton = { ...button, background: "transparent", color: "#c33", border: "1px solid #ccc" } as const;
const tableStyle = { width: "100%", borderCollapse: "collapse" as const, fontSize: 14 };
const th = { textAlign: "left" as const, padding: "10px 8px", color: "#666", fontWeight: 500, borderBottom: "1px solid #ddd" };
const td = { padding: "10px 8px", verticalAlign: "middle" as const };
