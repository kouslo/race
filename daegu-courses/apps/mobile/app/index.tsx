import { Link } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth-context";

export default function Home() {
  const { state } = useAuth();

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <View style={styles.body}>
        <Text style={styles.title}>대구 강좌·문화행사</Text>
        <Text style={styles.subtitle}>
          대구 전역의 강좌와 문화행사를 한 곳에서.
        </Text>

        <Link href="/courses" style={styles.primaryButton}>
          강좌 둘러보기
        </Link>

        {state.status === "loading" && <ActivityIndicator style={{ marginTop: 16 }} />}
        {state.status === "anonymous" && (
          <Link href="/login" style={styles.secondaryButton}>
            로그인
          </Link>
        )}
        {state.status === "authenticated" && (
          <Link href="/me" style={styles.secondaryButton}>
            {state.user.nickname}님 · 마이페이지
          </Link>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafafa" },
  body: { flex: 1, padding: 24, justifyContent: "center" },
  title: { fontSize: 28, fontWeight: "700", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#666", marginBottom: 32 },
  primaryButton: {
    backgroundColor: "#111",
    color: "#fff",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 10,
    fontWeight: "600",
    textAlign: "center",
    overflow: "hidden",
  },
  secondaryButton: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ccc",
    textAlign: "center",
    overflow: "hidden",
    color: "#111",
  },
});
