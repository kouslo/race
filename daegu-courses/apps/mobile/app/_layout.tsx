import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#111" },
          headerTintColor: "#fff",
        }}
      >
        <Stack.Screen name="index" options={{ title: "대구 강좌" }} />
        <Stack.Screen name="courses" options={{ title: "강좌" }} />
      </Stack>
    </>
  );
}
