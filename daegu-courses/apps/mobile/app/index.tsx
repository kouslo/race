import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Home() {
  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <View style={styles.body}>
        <Text style={styles.title}>대구 강좌·문화행사</Text>
        <Text style={styles.subtitle}>
          대구 전역의 강좌와 문화행사를 한 곳에서.
        </Text>

        <Link href="/courses" style={styles.button}>
          강좌 둘러보기
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafafa" },
  body: { flex: 1, padding: 24, justifyContent: "center" },
  title: { fontSize: 28, fontWeight: "700", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#666", marginBottom: 32 },
  button: {
    backgroundColor: "#111",
    color: "#fff",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 10,
    fontWeight: "600",
    textAlign: "center",
    overflow: "hidden",
  },
});
