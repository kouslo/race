# /admin

기관·크롤 소스 등록과 운영 모니터링용 페이지.

```
/admin              대시보드 (집계)
/admin/institutions 기관 추가/삭제
/admin/sources      크롤 소스 추가/토글/실행/삭제
/admin/logs         최근 크롤 로그
```

## 접근 권한

- 로그인 + `users.isAdmin = true`
- 권한 부여:
  ```bash
  pnpm admin:grant <email-or-userId>
  pnpm admin:revoke <email-or-userId>
  ```

## "지금 크롤" 버튼

`POST /api/v1/admin/crawl-sources/:id/crawl` → `runSource(db, id)`를 동기 실행.
크롤이 수십 초 이상 걸릴 수 있어 첫 등록 후 한 번만 누르고, 평소엔
`cron pnpm crawl:all`에 맡기는 운영을 권장.
