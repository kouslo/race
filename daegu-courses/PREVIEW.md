# 로컬 미리보기 가이드 (5분)

내 PC에서 직접 띄워 모든 기능을 테스트하는 방법.

## 필요한 것

- **Node 20+** (https://nodejs.org)
- **pnpm**: `npm i -g pnpm`
- **Docker Desktop** (Postgres 컨테이너용) — https://docs.docker.com/get-docker/

Docker가 싫다면 시스템 Postgres 16 + pg_trgm으로도 가능합니다 (아래 "Docker 없이").

## 한 줄 시작

```bash
git clone <레포 URL>
cd daegu-courses
pnpm preview
```

스크립트가 자동으로:
1. Docker로 Postgres 16 시작
2. `apps/api/.env`, `apps/web/.env` 생성 (없을 때만)
3. 의존성 설치 → 스키마 적용 → 데모 데이터 19개 강좌 시드
4. API 서버 (:3000) + Next.js (:3001) 동시 실행

브라우저에서:
- **http://localhost:3001** — 웹 앱
- http://localhost:3000/healthz — API 헬스체크

## 테스트 시나리오

로그인 없이 가능:
- 강좌 목록 검색 (자동완성 시도해보세요: "어린이", "영어")
- 카테고리/지역 필터, 상태 필터
- 강좌 상세 페이지 → "비슷한 강좌" 추천
- 공유 버튼 (모바일 브라우저면 OS 시트, 데스크탑이면 URL 복사)
- OS 다크모드 토글로 다크 테마 확인

로그인이 필요한 기능:
- 즐겨찾기 ★ 토글
- 마이페이지 `/me`
- 알림 설정 `/me/notifications` (카테고리 구독 토글)
- 어드민 페이지 `/admin/*`

→ Kakao 로그인을 켜려면 아래 "Kakao 로그인 활성화" 참고.

## Kakao 로그인 활성화 (선택)

1. https://developers.kakao.com/console/app → 앱 생성
2. **앱 키 → REST API 키** 복사
3. **카카오 로그인 → 활성화 ON**
4. **OpenID Connect → 활성화 ON** (id_token 발급 필수)
5. **Redirect URI 등록**: `http://localhost:3001/auth/kakao/callback`
6. 동의항목: 닉네임 / 프로필 사진 / 이메일

키를 두 파일에 추가:

```
# apps/api/.env
KAKAO_REST_API_KEY=여기에_REST_API_키

# apps/web/.env
NEXT_PUBLIC_KAKAO_CLIENT_ID=여기에_REST_API_키
```

서버 재시작 후 `/login`에서 카카오 버튼이 동작합니다.

## 어드민 권한 부여

`/admin` 페이지를 보려면 Kakao 로그인 후 사용자가 admin이어야 합니다.

```bash
# 한 번 로그인해서 users 테이블에 행을 만든 뒤
pnpm admin:grant your-email@kakao.com
# 또는 user UUID로
pnpm admin:grant <uuid>
```

## 실제 크롤 시험

데모 데이터 말고 실제 도서관 강좌를 가져오려면:

```bash
pnpm db:seed       # 동구/동부/범어 도서관 + crawl_sources 등록
pnpm crawl:all     # JWT 발급 → API 호출 → upsert
```

`apps/api/src/db/seed.ts`에 들어있는 3개 도서관 URL을 자동 크롤합니다.

## Docker 없이

시스템에 Postgres 16과 pg_trgm 확장이 있다면 `docker-compose.yml` 대신:

```bash
# Postgres 16에서 데이터베이스 + 유저 만들기
createdb daegu_courses
psql -d daegu_courses -c "CREATE USER daegu WITH PASSWORD 'daegu' SUPERUSER"

# 이후는 동일
pnpm install
pnpm --filter @daegu-courses/api db:setup
pnpm --filter @daegu-courses/api exec tsx src/db/seed-mock.ts
pnpm dev
```

## 종료

```bash
# 서버: 터미널에서 Ctrl-C
# Postgres만 중지:  docker compose stop
# 컨테이너 삭제:    docker compose down  (데이터 볼륨은 보존됨)
# 데이터까지 초기화: docker compose down -v
```

## 자주 발생하는 문제

**포트 충돌**: 3000 또는 3001을 이미 다른 앱이 점유 중
→ apps/api/.env에 `PORT=4000`, apps/web/package.json scripts의 `--port` 변경

**`gin_trgm_ops does not exist`**: pg_trgm 확장 없음
→ `pnpm db:init`을 먼저 실행 (preview 스크립트는 이미 함)

**`@types/react 18 vs 19` 오류**: pnpm 설치 캐시 깨짐
→ `rm -rf node_modules apps/*/node_modules packages/*/node_modules && pnpm install`

**카카오 인증 실패 (KOE006 등)**: Redirect URI 등록 누락
→ Kakao 콘솔 Redirect URI에 `http://localhost:3001/auth/kakao/callback` 정확히 일치하게 등록
