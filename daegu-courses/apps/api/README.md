# API

Hono + Zod REST API. Zod schemas in `schemas.ts` are the source of truth
for request/response shapes — import them in web/mobile clients to keep
types in sync.

## Run

```bash
npm run api:dev    # tsx watch
npm run api        # one-shot
# PORT=3000, CORS_ORIGINS=https://example.com,https://app.example.com
```

## Endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/healthz` | liveness |
| GET | `/api/v1/courses` | list courses |
| GET | `/api/v1/courses/:id` | course detail w/ institution |
| GET | `/api/v1/events` | list events |
| GET | `/api/v1/events/:id` | event detail |
| GET | `/api/v1/institutions` | list institutions |
| GET | `/api/v1/favorites` | requires `X-User-Id` |
| POST | `/api/v1/favorites` | requires `X-User-Id`; `{ targetType, targetId }` |
| DELETE | `/api/v1/favorites/:id` | requires `X-User-Id` |

### `GET /api/v1/courses` query

```
q             string  full-text on title/description
category      enum    art|music|sports|language|cooking|tech|humanities|kids|senior|etc
district      enum    중구|동구|서구|남구|북구|수성구|달서구|달성군|군위군
institutionId uuid
status        enum    upcoming|open|closed|full|cancelled
free          bool    fee = 0
applyOpen     bool    applyStartAt <= now < applyEndAt
sort          enum    recent (default) | applyEndSoon | startDate
page          int     default 1
pageSize      int     default 20, max 100
```

Response:

```ts
{
  items: Course[],
  page, pageSize, total, hasMore
}
```

## Auth

Kakao OIDC → 우리 access JWT (HS256, 15분) + opaque refresh token
(30일, DB에 SHA-256 해시로 저장). 자세한 흐름은 `src/auth/README.md`.

```
POST /api/v1/auth/kakao/callback   { code, redirectUri }
POST /api/v1/auth/refresh          { refreshToken }
POST /api/v1/auth/logout           { refreshToken }
GET  /api/v1/auth/me               Authorization: Bearer <jwt>
```

보호된 엔드포인트(`/favorites/*`)는 `Authorization: Bearer <jwt>` 필수.
미들웨어가 검증 후 `c.var.userId`를 주입합니다.
