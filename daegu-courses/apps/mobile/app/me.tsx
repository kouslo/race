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
import { Link, router } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import type { FavoriteCourseEntry, FavoriteEventEntry } from "@daegu-courses/api-client";

type FavData = { courses: FavoriteCourseEntry[]; events: FavoriteEventEntry[] };

export default function Me() {
  const { state, api, signOut } = useAuth();
  const [data, setData] = useState<FavData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (state.status === "anonymous") router.replace("/login");
  }, [state.status]);

  useEffect(() => {
    if (state.status !== "authenticated") return;
    api.favorites
      .list()
      .then(setData)
      .catch((e) => setErr(String(e)));
  }, [state.status, api]);

  if (state.status !== "authenticated") {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View>
          <Text style={styles.nickname}>{state.user.nickname}</Text>
          <Text style={styles.email}>{state.user.email ?? state.user.provider}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Link href="/notifications" asChild>
            <Pressable style={styles.signOutBtn}>
              <Text style={styles.signOutText}>🔔 알림</Text>
            </Pressable>
          </Link>
          <Pressable
            onPress={async () => {
              await signOut();
              router.replace("/");
            }}
            style={styles.signOutBtn}
          >
            <Text style={styles.signOutText}>로그아웃</Text>
          </Pressable>
        </View>
      </View>

      {err && <Text style={styles.error}>{err}</Text>}

      <FlatList
        contentContainerStyle={{ padding: 16, gap: 14 }}
        ListHeaderComponent={
          <Text style={styles.sectionTitle}>
            즐겨찾기한 강좌 ({data?.courses.length ?? 0})
          </Text>
        }
        data={data?.courses ?? []}
        keyExtractor={(f) => f.id}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              관심 있는 강좌의 ★을 눌러보세요.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => Linking.openURL(item.target.applyUrl)} style={styles.card}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.target.title}
            </Text>
            <Text style={styles.cardMeta}>
              {item.target.institution.name}
              {item.target.startDate ? ` · ${item.target.startDate}~` : ""}
            </Text>
            {item.target.applyEndAt && (
              <Text style={styles.deadline}>
                접수마감 {new Date(item.target.applyEndAt).toLocaleString("ko-KR")}
              </Text>
            )}
          </Pressable>
        )}
        ListFooterComponent={
          <View style={{ marginTop: 20 }}>
            <Text style={styles.sectionTitle}>
              즐겨찾기한 행사 ({data?.events.length ?? 0})
            </Text>
            {(!data || data.events.length === 0) && (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>관심 있는 문화행사가 생기면 여기에 모입니다.</Text>
              </View>
            )}
            {data?.events.map((e) => (
              <Pressable
                key={e.id}
                onPress={() => e.target.reserveUrl && Linking.openURL(e.target.reserveUrl)}
                style={[styles.card, { marginTop: 10 }]}
              >
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {e.target.title}
                </Text>
                <Text style={styles.cardMeta}>
                  {e.target.institution.name} · {e.target.location}
                </Text>
                <Text style={styles.deadline}>
                  {new Date(e.target.eventStartAt).toLocaleString("ko-KR")}
                </Text>
              </Pressable>
            ))}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fafafa" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5e5",
  },
  nickname: { fontSize: 18, fontWeight: "700" },
  email: { fontSize: 12, color: "#666", marginTop: 2 },
  signOutBtn: { paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: "#ccc", borderRadius: 6 },
  signOutText: { fontSize: 12 },
  sectionTitle: { fontSize: 15, fontWeight: "600", marginBottom: 10 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e5e5",
  },
  cardTitle: { fontSize: 15, fontWeight: "600" },
  cardMeta: { fontSize: 12, color: "#666", marginTop: 6 },
  deadline: { fontSize: 11, color: "#888", marginTop: 4 },
  empty: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderStyle: "dashed",
    borderRadius: 10,
    padding: 20,
    alignItems: "center",
  },
  emptyText: { fontSize: 12, color: "#888" },
  error: { color: "#c33", padding: 16 },
});
