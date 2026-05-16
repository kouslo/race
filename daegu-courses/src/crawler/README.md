# Crawler

기관별 강좌·행사 페이지를 파싱해 DB에 upsert하는 모듈.

## 구조

```
crawler/
  types.ts          CourseAdapter 인터페이스, Parsed* 타입
  fetcher.ts        undici 기반 HTML/JSON fetcher
  logger.ts         경량 콘솔 로거
  normalize.ts      한국어 날짜/수강료/요일 파싱
  registry.ts       adapterKey → adapter 매핑
  adapters/         기관별 어댑터 (파일당 1개 권장)
    daegu-arts-center.ts
  upsert.ts         (institutionId, externalId) 기준 upsert + 미발견 soft-close
  runner.ts         한 source 실행 또는 due한 모든 source 실행
  cli.ts            `npm run crawl` 진입점
```

## 새 어댑터 추가

1. `adapters/<slug>.ts` 생성 — `CourseAdapter` 구현
2. `registry.ts`에서 import + register
3. DB의 `crawl_sources.adapter_key`를 동일한 키로 등록

```ts
// adapters/suseong-library.ts
export const suseongLibraryAdapter: CourseAdapter = {
  key: "suseong-library-v1",
  name: "수성구립도서관",
  contentType: "course",
  async run({ sourceUrl, fetcher, logger }) {
    const html = await fetcher.html(sourceUrl);
    const $ = cheerio.load(html);
    // ... parse ...
    return { courses: [...] };
  },
};
```

## upsert 동작

- `(institutionId, externalId)` 충돌 시 → 모든 필드 update + `lastSeenAt=now`
- 이번 run에 안 잡힌 같은 source의 강좌 → `status='closed'` (soft delete)
- 실패 시 `consecutive_failures` 증가, `crawl_logs`에 에러 메시지 저장

## 실행

```bash
# 단일 source
npm run crawl -- --source <crawl_sources.id>

# 활성화되고 인터벌 도래한 source 전부
npm run crawl:all
```

운영에서는 `crawl:all`을 cron(혹은 systemd timer, k8s CronJob)으로 매 시간 호출.

## 어댑터 작성 팁

- **`externalId`는 안정적인 값으로**: URL 쿼리의 `id`/`seq`/`no`가 보통 안전. 제목·인덱스 기반은 절대 금지(매번 바뀜).
- **`rawData`에 원문 텍스트 넣기**: 파싱 로직 개선 시 재처리 가능.
- **셀렉터는 좁고 명시적으로**: `table tbody tr` 같은 광범위 셀렉터는 다른 테이블에 매칭될 수 있음.
- **빈 응답 방어**: `if (!detailHref) return;` 식으로 광고 행·헤더 행 skip.
- **JS 렌더링 사이트**: cheerio로 파싱 안 되는 SPA는 Playwright 어댑터 별도 작성(향후 `fetcher.browser()` 추가 예정).
