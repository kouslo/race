# auth

Kakao OIDC → 우리 access JWT(HS256, 15분) + opaque refresh token(30일,
DB에 SHA-256 해시로 저장).

```
kakao.ts        OIDC code 교환 + id_token 검증(JWKS)
jwt.ts          access JWT 서명/검증, refresh 토큰 생성/해시
users.ts        Kakao 클레임 → users 테이블 upsert
middleware.ts   requireAuth — Authorization: Bearer <jwt> 검사 후 c.var.userId 주입
```

## 흐름 (web)

```
/login → Kakao authorize URL → /auth/kakao/callback?code=...
   ↓ (Next.js Route Handler)
POST /api/v1/auth/kakao/callback { code, redirectUri }
   ├─ Kakao /oauth/token 교환
   ├─ id_token JWKS 검증 (iss=kauth.kakao.com, aud=KAKAO_REST_API_KEY)
   ├─ users upsert (provider="kakao", providerUserId=sub)
   ├─ access JWT 서명
   └─ refresh 발급 + refresh_tokens에 해시 저장
```

## 흐름 (mobile)

`expo-auth-session`으로 같은 인증 코드를 받아 동일한 POST 호출.
토큰은 `expo-secure-store`에 저장.

## 토큰 회전

`POST /auth/refresh`는 항상 새 refresh를 발급하고 기존 것은
`revokedAt`을 채워 폐기 — 도난 시 짧은 윈도우만 노출.

## 환경 변수

```
JWT_SECRET           필수, 32자 이상
KAKAO_REST_API_KEY   필수 (Kakao 콘솔의 REST API 키)
KAKAO_CLIENT_SECRET  선택 (Kakao 콘솔에서 활성화한 경우)
ACCESS_TOKEN_TTL_SEC   기본 900
REFRESH_TOKEN_TTL_SEC  기본 2592000 (30일)
```

## 새 provider 추가

1. `auth/<provider>.ts` — code 교환 + id_token 검증 함수
2. `routes/auth.ts`에 새 콜백 핸들러 추가
3. `users.ts`의 `upsertUserFromProvider`는 그대로 재사용 (provider 필드만 다름)
