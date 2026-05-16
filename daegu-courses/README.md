# daegu-courses (DB layer)

대구 강좌·문화행사 통합 플랫폼의 데이터베이스 스키마. Drizzle ORM + PostgreSQL.

## 구조

```
src/db/
  schema/
    enums.ts             pgEnum 정의 (지역, 카테고리, 상태 등)
    institutions.ts      기관 마스터
    crawl-sources.ts     크롤링 URL 등록 + 실행 로그
    courses.ts           강좌
    events.ts            문화행사
    users.ts             사용자, 즐겨찾기, 알림 구독, 검색 기록
    index.ts             통합 export
  client.ts              Drizzle 클라이언트
  migrations/            (생성됨) db:generate 결과
drizzle.config.ts
```

## 사용법

```bash
# 1. 의존성 설치
npm install

# 2. PostgreSQL 준비 후 .env 작성
cp .env.example .env

# 3. 마이그레이션 SQL 생성
npm run db:generate

# 4-a. 마이그레이션 적용 (운영)
npm run db:migrate

# 4-b. 또는 스키마 직접 푸시 (개발 초기)
npm run db:push
```

## 핵심 설계

- `crawl_sources`: 사용자가 기관별 강좌 페이지 URL을 등록하는 테이블. `adapterKey`로 파서 매핑.
- `courses` / `events`: `(institutionId, externalId)` 유니크 → 중복 없이 upsert.
- `lastSeenAt`: 크롤링 시 갱신, 일정 기간 미갱신 시 `status='closed'` 처리.
- `rawData`: 파싱 원본 보존 → 어댑터 개선 시 재처리 가능.
