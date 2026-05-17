# Search: pg_trgm + GIN

한글 부분 문자열 검색을 Postgres `pg_trgm` 확장과 GIN 인덱스로 가속합니다.

## 작동 방식

- pg_trgm은 문자열을 **트라이그램**(3글자 윈도우)으로 분해해 인덱싱합니다.
- 한글도 문자 단위로 동작 — "어린이 코딩"은 ["어린이", "린이 ", "이 코", " 코딩"] 같은 식.
- `LIKE '%xxx%'` / `ILIKE` 가 인덱스 스캔이 됩니다 (시퀀스 스캔 X).
- `similarity(a, b)` 함수로 0~1 유사도 점수 → relevance 정렬 가능.

## 인덱스 정의

`schema/courses.ts`, `schema/events.ts`:

```ts
index("courses_title_trgm_idx").using("gin", sql`${t.title} gin_trgm_ops`),
index("courses_description_trgm_idx").using(
  "gin",
  sql`coalesce(${t.description}, '') gin_trgm_ops`,
),
```

`description`은 NULL 가능이라 `coalesce(..., '')`로 감싸 인덱싱.

## 사용

라우트에서 변경 없음 — 기존 `ilike` 쿼리가 자동으로 인덱스 이점을 봅니다.

추가로 `?sort=relevance`를 지원합니다:

```sql
ORDER BY greatest(similarity(title, $q), similarity(coalesce(description,''), $q)) DESC
```

- `q`가 있을 때만 의미가 있어, 빈 `q`면 자동으로 fallback 정렬로 폴백.
- 웹 `/courses` 페이지는 검색어 입력 시 `sort=relevance` 자동 적용.

## 셋업 순서

```bash
pnpm db:init        # CREATE EXTENSION IF NOT EXISTS pg_trgm
pnpm db:push        # 인덱스 포함 스키마 적용
# 또는 한 번에:
pnpm db:setup
```

> `db:push`만 먼저 돌리면 trgm 인덱스 생성 단계에서 `operator class "gin_trgm_ops" does not exist` 에러가 납니다.

## 튜닝 팁

- 인덱스 빌드는 데이터가 많을수록 시간이 걸립니다. 운영 중에는 `CREATE INDEX CONCURRENTLY` 권장 — drizzle은 직접 지원하지 않으므로 큰 테이블에서는 수동 SQL 사용.
- 한 글자 검색은 트라이그램이 도움이 안 됩니다 (`%` 매칭의 길이는 최소 3자 권장).
- 짧은 검색어는 표현식 인덱스 또는 `gin_trgm_ops_with_pattern` 같은 대안 고려.
- `pg_trgm.similarity_threshold` (기본 0.3) 를 낮추면 `%` 연산자 매칭 폭이 넓어집니다.
