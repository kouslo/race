import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/lib/auth-context";

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

type Sub = { id: string; type: string; category: string | null; targetId: string | null };
type Delivery = { id: string; kind: string; targetId: string; sentAt: string };

export default function Notifications() {
  const { state, api } = useAuth();
  const [subs, setSubs] = useState<Sub[] | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);

  useEffect(() => {
    if (state.status === "anonymous") router.replace("/login");
  }, [state.status]);

  const load = useCallback(async () => {
    if (state.status !== "authenticated") return;
    const [s, d] = await Promise.all([
      api.notifications.listSubscriptions(),
      api.notifications.deliveries().catch(() => ({ items: [] as Delivery[] })),
    ]);
    setSubs(s.items);
    setDeliveries(d.items);
  }, [state.status, api]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(category: string) {
    if (state.status !== "authenticated" || !subs) return;
    const existing = subs.find((s) => s.type === "new_in_category" && s.category === category);
    if (existing) {
      await api.notifications.unsubscribe(existing.id);
    } else {
      await api.notifications.subscribe({
        type: "new_in_category",
        category: category as never,
      });
    }
    load();
  }

  if (state.status !== "authenticated" || !subs) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const subscribed = new Set(
    subs.filter((s) => s.type === "new_in_category").map((s) => s.category),
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#fafafa" }} contentContainerStyle={{ padding: 16 }}>
      <Section title="🔔 자동 알림 (즐겨찾기 기반)">
        <Text style={styles.bodyText}>
          즐겨찾기한 강좌는 <Text style={{ fontWeight: "700" }}>접수 시작</Text>과{" "}
          <Text style={{ fontWeight: "700" }}>접수 마감 임박</Text> 시점에 자동으로 푸시를 받습니다.
          별도 설정 없이 ★ 토글만으로 켜고 끄세요.
        </Text>
      </Section>

      <Section title="✨ 카테고리 새 강좌 알림">
        <Text style={[styles.bodyText, { marginBottom: 12 }]}>
          관심 카테고리를 선택해두면 새 강좌가 등록될 때 알려드립니다.
        </Text>
        <View style={styles.grid}>
          {CATEGORIES.map((c) => {
            const on = subscribed.has(c.value);
            return (
              <Pressable
                key={c.value}
                onPress={() => toggle(c.value)}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text style={{ fontSize: 18 }}>{c.emoji}</Text>
                <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>{c.label}</Text>
                <Text style={[styles.chipState, on && styles.chipStateOn]}>
                  {on ? "구독중" : "구독"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Section title="📜 최근 알림 (50건)">
        {deliveries.length === 0 ? (
          <Text style={[styles.bodyText, { color: "#aaa" }]}>받은 알림이 아직 없습니다.</Text>
        ) : (
          deliveries.map((d) => (
            <View key={d.id} style={styles.deliveryRow}>
              <View style={styles.kindPill}>
                <Text style={styles.kindPillText}>{KIND_LABEL[d.kind] ?? d.kind}</Text>
              </View>
              <Text style={styles.deliveryId}>{d.targetId.slice(0, 8)}…</Text>
              <Text style={styles.deliveryTime}>
                {new Date(d.sentAt).toLocaleString("ko-KR")}
              </Text>
            </View>
          ))
        )}
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  section: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e5e5",
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: "600", marginBottom: 8 },
  bodyText: { fontSize: 13, color: "#666", lineHeight: 20 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    width: "30%",
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: "#d4d4d4",
    borderRadius: 8,
    alignItems: "center",
    gap: 2,
  },
  chipOn: { borderColor: "#111", backgroundColor: "#111" },
  chipLabel: { fontSize: 13, color: "#222" },
  chipLabelOn: { color: "#fff" },
  chipState: { fontSize: 10, color: "#888" },
  chipStateOn: { color: "#fff", opacity: 0.8 },
  deliveryRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0f0f0",
  },
  kindPill: { backgroundColor: "#eef", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  kindPillText: { fontSize: 11, color: "#446" },
  deliveryId: { flex: 1, fontSize: 11, color: "#888" },
  deliveryTime: { fontSize: 11, color: "#999" },
});
