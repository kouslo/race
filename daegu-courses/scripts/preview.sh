#!/usr/bin/env bash
#
# Local preview / demo runner.
#
#   bash scripts/preview.sh
#
# 1) Starts Postgres (Docker)
# 2) Writes apps/api/.env and apps/web/.env with sensible defaults
# 3) Runs db:setup (pg_trgm + schema) and seed-mock
# 4) Launches the API (:3000) and the Next.js web app (:3001) together
#
# Stop with Ctrl-C; the script tears down child processes cleanly.

set -euo pipefail

cd "$(dirname "$0")/.."

JWT_SECRET=${JWT_SECRET:-"preview_secret_for_local_demo_at_least_32_chars"}

# 1) Postgres
if ! command -v docker >/dev/null 2>&1; then
  echo "✗ docker가 설치돼 있어야 합니다 (https://docs.docker.com/get-docker/)"
  exit 1
fi
echo "▶ Postgres 시작 (docker compose up -d)"
docker compose up -d
echo "▶ Postgres health 대기"
for i in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U daegu -d daegu_courses >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

# 2) .env files (only created if missing — won't clobber a real one)
if [ ! -f apps/api/.env ]; then
  cat > apps/api/.env <<EOF
DATABASE_URL=postgres://daegu:daegu@localhost:5432/daegu_courses
JWT_SECRET=$JWT_SECRET
PORT=3000
CORS_ORIGINS=http://localhost:3001
# KAKAO_REST_API_KEY=  # set this to enable Kakao login
EOF
  echo "✓ apps/api/.env 생성"
fi
if [ ! -f apps/web/.env ]; then
  cat > apps/web/.env <<EOF
API_BASE_URL=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
# NEXT_PUBLIC_KAKAO_CLIENT_ID=  # same value as KAKAO_REST_API_KEY
EOF
  echo "✓ apps/web/.env 생성"
fi

# 3) DB setup + mock seed (idempotent)
if ! command -v pnpm >/dev/null 2>&1; then
  echo "✗ pnpm이 필요합니다: npm i -g pnpm"
  exit 1
fi

echo "▶ 의존성 설치"
pnpm install --prefer-offline --silent

echo "▶ DB 스키마 적용 (pg_trgm + drizzle push)"
pnpm --filter @daegu-courses/api db:init
pnpm --filter @daegu-courses/api exec drizzle-kit push --force >/dev/null

echo "▶ 데모 데이터 시드 (기관 4개 + 강좌 19개)"
pnpm --filter @daegu-courses/api exec tsx src/db/seed-mock.ts

# 4) Run web + api together
echo ""
echo "▶ API → http://localhost:3000"
echo "▶ Web → http://localhost:3001"
echo ""
echo "Ctrl-C 로 종료. 종료 후 Postgres만 백그라운드에 남기려면:"
echo "   docker compose stop   # 일시 중지"
echo "   docker compose down   # 컨테이너 삭제 (데이터는 보존)"
echo ""

# Use pnpm parallel mode via turbo so SIGINT propagates cleanly
exec pnpm turbo run dev --parallel --filter=@daegu-courses/api --filter=@daegu-courses/web
