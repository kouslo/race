import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api } from "@/lib/api";
import type { CourseListItem } from "@daegu-courses/api-client";

export default function Courses() {
  const [items, setItems] = useState<CourseListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.courses
      .list({ status: "open", sort: "applyEndSoon", pageSize: 50 })
      .then((res) => setItems(res.items))
      .catch((e) => setError(String(e)));
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }
  if (!items) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }
  if (items.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>강좌가 없습니다.</Text>
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }}
      data={items}
      keyExtractor={(c) => c.id}
      renderItem={({ item }) => (
        <Pressable onPress={() => Linking.openURL(item.applyUrl)} style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.title} numberOfLines={2}>
              {item.title}
            </Text>
            <StatusBadge status={item.status} />
          </View>
          <Text style={styles.meta}>
            {item.institution.name} · {item.institution.district}
            {item.fee === 0 ? " · 무료" : ` · ${item.fee.toLocaleString()}원`}
          </Text>
          {item.applyEndAt && (
            <Text style={styles.deadline}>
              접수마감 {new Date(item.applyEndAt).toLocaleString("ko-KR")}
            </Text>
          )}
        </Pressable>
      )}
    />
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    open: "#0a7d0a",
    upcoming: "#666",
    closed: "#999",
    full: "#c33",
    cancelled: "#999",
  };
  const labels: Record<string, string> = {
    open: "접수중",
    upcoming: "예정",
    closed: "마감",
    full: "정원마감",
    cancelled: "취소",
  };
  return (
    <View style={[styles.badge, { backgroundColor: colors[status] ?? "#999" }]}>
      <Text style={styles.badgeText}>{labels[status] ?? status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  empty: { color: "#999" },
  error: { color: "#c33" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e5e5",
  },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  title: { fontSize: 15, fontWeight: "600", flex: 1 },
  meta: { color: "#666", fontSize: 12, marginTop: 6 },
  deadline: { color: "#888", fontSize: 11, marginTop: 4 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: "flex-start" },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "600" },
});
