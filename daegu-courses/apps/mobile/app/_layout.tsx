import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "@/lib/auth-context";

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#111" },
          headerTintColor: "#fff",
        }}
      >
        <Stack.Screen name="index" options={{ title: "대구 강좌" }} />
        <Stack.Screen name="courses/index" options={{ title: "강좌" }} />
        <Stack.Screen name="courses/[id]" options={{ title: "강좌 상세" }} />
        <Stack.Screen name="login" options={{ title: "로그인" }} />
        <Stack.Screen name="me" options={{ title: "마이페이지" }} />
        <Stack.Screen name="notifications" options={{ title: "알림 설정" }} />
      </Stack>
    </AuthProvider>
  );
}
