# notify

푸시 알림 디스패처. Expo Push HTTP API 직접 호출.

```
expo.ts         Expo /push/send 호출 + DeviceNotRegistered 자동 비활성화
dispatcher.ts   스캔 → 클레임(INSERT ON CONFLICT) → 발송 → ticket 기록
cli.ts          pnpm notify:dispatch 진입점
```

## 알림 종류

| kind | 트리거 | 데이터 소스 |
|---|---|---|
| `apply_open` | 즐겨찾기한 강좌의 `applyStartAt`이 최근 24h 내에 시작됨 | `favorites` |
| `apply_closing` | 즐겨찾기한 강좌의 `applyEndAt`이 향후 24h 이내 | `favorites` |
| `new_in_category` | 사용자의 `notification_subscriptions`의 category에서 새 강좌 등장 | `notification_subscriptions` |

즐겨찾기 추가 = 두 가지 신청-관련 알림에 자동 가입.
카테고리 알림은 별도 구독 필요 (`POST /api/v1/notifications/subscriptions`).

## 중복 방지

`notification_deliveries` 테이블에 `(userId, kind, targetType, targetId)` 유니크 인덱스.
디스패처는 `INSERT ... ON CONFLICT DO NOTHING RETURNING` 으로 행을 **원자적으로 클레임**하고,
실제 발송은 클레임된 행에 한해서만 진행. 동시 실행에도 안전.

## 실행

```bash
pnpm notify:dispatch       # 한 번 실행
# 운영: cron으로 매 15분~1시간 호출
*/15 * * * * cd /opt/app && pnpm notify:dispatch
```

## 환경 변수

```
# Expo Push (선택)
EXPO_ACCESS_TOKEN=     # Expo 콘솔에서 발급, 적용 시 push receipt 확인 가능
```

## 다음 단계 아이디어

- 알림 시각 사용자 선호 (조용시간 22~08시)
- 알림 그룹화 (같은 기관 N개 강좌 → 1개로 묶기)
- Expo push **receipt** 조회 → 실제 디바이스 도달 확인
- 웹 푸시(VAPID) 채널 추가
