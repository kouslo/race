# daegu-courses

대구 전역의 강좌·문화행사를 한 곳에서 통합 조회·신청하도록 돕는 플랫폼.
Turborepo + pnpm 모노레포. 백엔드(크롤러·API)는 공유, UI는 웹과 앱을 각각 네이티브 수준으로.

## 워크스페이스

```
apps/
  api/            Hono REST API + Drizzle DB + 크롤러
  web/            Next.js 15 (App Router) — 강좌/행사 검색·상세
  mobile/         Expo SDK 52 + Expo Router — 모바일 앱
packages/
  api-schemas/    Zod 스키마 (요청/응답 계약, 서버·클라이언트 공유)
  api-client/     타입 안전 fetch 래퍼 (웹·모바일 공통)
  tsconfig/       공통 tsconfig 프리셋 (base/node/next/expo)
```

## 빠른 시작

```bash
# 사전: pnpm, Node 20+, PostgreSQL
npm install -g pnpm
pnpm install

# 1) DB 준비
cp apps/api/.env.example apps/api/.env   # DATABASE_URL 등 설정
pnpm db:push                              # 스키마 적용
pnpm db:seed                              # 도서관 3곳 + crawl_sources 등록
pnpm crawl:all                            # 첫 크롤링

# 2) 동시 실행 (turbo)
pnpm dev                                  # api + web + mobile 동시

# 또는 개별
pnpm api:dev                              # http://localhost:3000
pnpm web:dev                              # http://localhost:3001
pnpm mobile:dev                           # Expo dev server
```

## 데이터 흐름

```
사용자가 crawl_sources에 기관 URL 등록
      ↓
크롤러(어댑터별) JSON/HTML 파싱
      ↓
PostgreSQL (Drizzle) - courses / events upsert
      ↓
Hono API (Zod 검증)
      ↓
Next.js Web · Expo Mobile (api-client 공유)
```

## 핵심 설계 결정

- **UI 컴포넌트는 공유하지 않음** — 웹은 Next.js+CSS, 모바일은 React Native로 각각 최적. 비즈니스 로직과 API 계약만 공유 (`api-schemas`, `api-client`).
- **크롤러 어댑터 패턴** — 기관마다 어댑터 파일 하나. `crawl_sources.adapter_key`로 자동 라우팅.
- **idempotent upsert** — `(institutionId, externalId)` 유니크. 매번 크롤링해도 중복 없음. 안 보이는 강좌는 자동 soft-close.
- **API 계약은 Zod** — 서버 검증과 클라이언트 타입이 동일 소스.

## 자세한 문서

- 백엔드: `apps/api/README.md`, `apps/api/src/crawler/README.md`
- 웹: `apps/web/` (Next.js App Router)
- 모바일: `apps/mobile/` (Expo Router)
