import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import Constants from "expo-constants";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "@/lib/auth-context";
import { publicApi } from "@/lib/api";
import { registerPushToken } from "@/lib/push";

WebBrowser.maybeCompleteAuthSession();

const KAKAO_CLIENT_ID =
  (Constants.expoConfig?.extra as { kakaoClientId?: string } | undefined)?.kakaoClientId ?? "";

const discovery = {
  authorizationEndpoint: "https://kauth.kakao.com/oauth/authorize",
  tokenEndpoint: "https://kauth.kakao.com/oauth/token",
};

export default function Login() {
  const { signIn, api, state } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const redirectUri = AuthSession.makeRedirectUri({
    scheme: "daegucourses",
    path: "auth/kakao/callback",
  });

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: KAKAO_CLIENT_ID,
      scopes: ["openid", "profile_nickname", "profile_image", "account_email"],
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
    },
    discovery,
  );

  useEffect(() => {
    if (response?.type === "success" && response.params.code) {
      handleCode(response.params.code, request?.codeVerifier);
    }
    if (response?.type === "error") {
      setError(response.error?.message ?? "Kakao 인증 실패");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  // Already signed in — bounce to home.
  useEffect(() => {
    if (state.status === "authenticated") {
      router.replace("/");
    }
  }, [state.status]);

  async function handleCode(code: string, codeVerifier?: string) {
    setBusy(true);
    setError(null);
    try {
      const session = await publicApi.auth.kakaoCallback({
        code,
        redirectUri,
        codeVerifier,
      });
      await signIn(session);
      // Best-effort push registration; failure shouldn't block login.
      registerPushToken(api).catch(() => undefined);
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const disabled = !request || busy || !KAKAO_CLIENT_ID;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>로그인</Text>
      <Text style={styles.subtitle}>
        즐겨찾기·알림을 사용하려면 로그인이 필요합니다.
      </Text>

      <Pressable
        style={[styles.button, disabled && styles.buttonDisabled]}
        disabled={disabled}
        onPress={() => promptAsync()}
      >
        {busy ? <ActivityIndicator color="#191919" /> : <Text style={styles.buttonText}>카카오로 시작하기</Text>}
      </Pressable>

      {!KAKAO_CLIENT_ID && (
        <Text style={styles.warn}>
          app.json의 expo.extra.kakaoClientId가 비어 있습니다. Kakao 콘솔의 REST API 키를 채워주세요.
        </Text>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center", backgroundColor: "#fafafa" },
  title: { fontSize: 28, fontWeight: "700", marginBottom: 6 },
  subtitle: { fontSize: 14, color: "#666", marginBottom: 32 },
  button: {
    backgroundColor: "#fee500",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#191919", fontWeight: "700", fontSize: 15 },
  warn: { color: "#c80", fontSize: 12, marginTop: 16, lineHeight: 18 },
  error: { color: "#c33", fontSize: 13, marginTop: 16 },
});
