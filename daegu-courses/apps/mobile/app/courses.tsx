import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { publicApi } from "@/lib/api";
import type { CourseListItem } from "@daegu-courses/api-client";

export default function Courses() {
  const { state, api } = useAuth();
  const [items, setItems] = useState<CourseListItem[] | null>(null);
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const loadFavorites = useCallback(async () => {
    if (state.status !== "authenticated") {
      setFavIds(new Set());
      return;
    }
    try {
      const favs = await api.favorites.list();
      setFavIds(new Set(favs.courses.map((f) => f.target.id)));
    } catch {
      setFavIds(new Set());
    }
  }, [state.status, api]);

  useEffect(() => {
    publicApi.courses
      .list({ status: "open", sort: "applyEndSoon", pageSize: 50 })
      .then((res) => setItems(res.items))
      .catch((e) => setError(String(e)));
    loadFavorites();
  }, [loadFavorites]);

  async function toggleFavorite(courseId: string) {
    if (state.status !== "authenticated") {
      router.push("/login");
      return;
    }
    const wasFav = favIds.has(courseId);
    // Optimistic
    const next = new Set(favIds);
    if (wasFav) next.delete(courseId);
    else next.add(courseId);
    setFavIds(next);
    try {
      if (wasFav) {
        const favs = await api.favorites.list();
        const found = favs.courses.find((f) => f.target.id === courseId);
        if (found) await api.favorites.remove(found.id);
      } else {
        await api.favorites.add({ targetType: "course", targetId: courseId });
      }
    } catch (e) {
      // Roll back on failure
      setFavIds(favIds);
      console.warn("favorite toggle failed", e);
    }
  }

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

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }}
      data={items}
      keyExtractor={(c) => c.id}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.row}>
            <Pressable
              style={{ flex: 1 }}
              onPress={() => Linking.openURL(item.applyUrl)}
            >
              <Text style={styles.title} numberOfLines={2}>
                {item.title}
              </Text>
            </Pressable>
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              <Pressable
                onPress={() => toggleFavorite(item.id)}
                hitSlop={8}
                accessibilityLabel={favIds.has(item.id) ? "즐겨찾기 해제" : "즐겨찾기 추가"}
              >
                <Text style={{ fontSize: 22, color: favIds.has(item.id) ? "#f5a623" : "#bbb" }}>
                  {favIds.has(item.id) ? "★" : "☆"}
                </Text>
              </Pressable>
              <StatusBadge status={item.status} />
            </View>
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
        </View>
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
  error: { color: "#c33" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e5e5",
  },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  title: { fontSize: 15, fontWeight: "600" },
  meta: { color: "#666", fontSize: 12, marginTop: 6 },
  deadline: { color: "#888", fontSize: 11, marginTop: 4 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "600" },
});
