# @daegu-courses/mobile

Expo SDK 52 + Expo Router. 비즈니스 로직은 `packages/api-client` 공유.

## 인증 흐름

```
LoginScreen
  └─ expo-auth-session.useAuthRequest({ Kakao authorize })
       └─ promptAsync()  → Kakao 인증 → daegucourses://auth/kakao/callback?code=…
LoginScreen handleCode(code)
  └─ POST /api/v1/auth/kakao/callback { code, redirectUri, codeVerifier }
       → { accessToken, refreshToken, user }
  └─ saveSession() → expo-secure-store (web fallback: localStorage)
  └─ AuthContext.signIn(session) → 전역 상태 인증됨
  └─ registerPushToken(api)  (베스트-에포트, 권한 거절 무시)
  └─ router.replace("/")

토큰 만료 1분 전부터 api 호출 시 자동 refresh (auth-context.tsx).
refresh 실패 → 세션 폐기 → router가 login으로 유도.
```

## Kakao 콘솔 설정

1. https://developers.kakao.com/console/app 에서 앱 생성
2. **앱 키 → REST API 키** 복사
3. `app.json`의 `expo.extra.kakaoClientId` 에 붙여넣기 (또는 EAS Secret)
4. **카카오 로그인 → 활성화 ON**
5. **OpenID Connect 활성화 ON** (id_token 발급에 필수)
6. **Redirect URI 등록**:
   - 개발: `daegucourses://auth/kakao/callback`
   - 또는 Expo Go 사용 시 `AuthSession.makeRedirectUri()` 가 반환하는
     `exp://<lan-ip>:8081/--/auth/kakao/callback`도 등록
7. 동의항목: 닉네임, 프로필 사진, 카카오계정(이메일)

## 환경 변수 (app.json `expo.extra`)

```json
"extra": {
  "apiBaseUrl": "https://api.example.com",
  "kakaoClientId": "여기에_REST_API_키"
}
```

운영에서는 `eas.json`에서 환경별로 분리하고 EAS Secret으로 관리 권장.

## 푸시

- 로그인 직후 `registerPushToken(api)` 자동 호출 → 권한 요청 → Expo Push 토큰 등록
- 서버는 `notify/dispatcher.ts`가 cron에서 발송 (백엔드 K 작업 참조)
- 즐겨찾기한 강좌는 자동으로 접수 시작/마감 알림 대상

## 실행

```bash
pnpm install                    # 모노레포 루트에서
pnpm mobile:dev                 # 또는 cd apps/mobile && pnpm start
# iOS 시뮬레이터 / Android 에뮬레이터 / Expo Go 앱에서 QR 스캔
```

> 실기기 테스트 시 `app.json`의 `apiBaseUrl`을 PC의 LAN IP로 바꿔야 합니다
> (`http://192.168.0.x:3000` 같은). `localhost`는 모바일 기기에서 자기 자신.
