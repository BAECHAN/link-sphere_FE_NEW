# 프롬프트 템플릿: 새 도메인 생성

**사용법**: 대괄호 `[ ]` 안의 내용을 실제 값으로 채운 뒤 Claude Code에 붙여넣으세요.
**빠른 방법**: `/new-domain [도메인명]` 슬래시 커맨드 사용 (필드가 적을 때)

---

Link-Sphere FE 프로젝트에 **[도메인명, 예: "notification"]** 도메인을 새로 추가해주세요.

## 엔티티 정보

엔티티 이름 (PascalCase): **[엔티티명, 예: "Notification"]**

백엔드 API 필드:

```
id: string
[필드명]: [타입]   ← 예: "title: string", "isRead: boolean", "content: string | null"
[필드명]: [타입]
createdAt: ISO date string
updatedAt: ISO date string
```

## 백엔드 API 엔드포인트

Base URL: `/api/[경로, 예: "notifications"]`

| 메서드 | 경로              | 설명      |
| ------ | ----------------- | --------- |
| POST   | `/api/[경로]`     | 생성      |
| GET    | `/api/[경로]`     | 목록 조회 |
| GET    | `/api/[경로]/:id` | 단건 조회 |
| PATCH  | `/api/[경로]/:id` | 수정      |
| DELETE | `/api/[경로]/:id` | 삭제      |

## 생성 폼 필드 (create 스키마)

```
[필드명]: [타입]   ← 유저가 입력하는 필드만 기재
```

## 수정 폼 필드 (update 스키마)

```
[필드명]: [타입]   ← 유저가 수정 가능한 필드만 기재
```

## 목록 조회 방식

- [ ] 단순 배열 (`GET /api/[경로]` → `Entity[]`)
- [ ] 페이지네이션 (`page`, `size` 파라미터, `PaginationResponse<Entity>` 응답)
- [ ] 무한 스크롤 (`useInfiniteQuery` 사용, post 도메인 참조)

## 라우트

새 도메인의 페이지 경로: `/[경로, 예: "notification"]`

## 첫 번째 feature

도메인 생성 후 아래 feature도 함께 만들어주세요:

Feature 이름: **[feature명, 예: "create-notification", "notification-list"]**

동작 설명: [예: "유저가 알림 메시지를 입력하고 제출하면 알림이 생성되며, 성공 시 목록 페이지로 이동합니다."]

## 추가 컨텍스트 (선택사항)

- Cross-domain invalidation: [예: "알림 생성 시 post 목록도 갱신 필요", 또는 "없음"]
- Optimistic update: [예: "isRead 토글은 낙관적 업데이트 적용", 또는 "없음"]
- 특이사항: [예: "삭제 시 confirm 불필요", 또는 "없음"]
