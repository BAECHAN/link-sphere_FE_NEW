# 프롬프트 템플릿: 기존 도메인에 새 Feature 추가

**사용법**: 대괄호 `[ ]` 안의 내용을 실제 값으로 채운 뒤 Claude Code에 붙여넣으세요.
**빠른 방법**: `/new-feature [도메인명] [feature명]` 슬래시 커맨드 사용

---

**[도메인명, 예: "post"]** 도메인에 **[feature명, 예: "pin-post"]** feature를 추가해주세요.

## Feature 동작 설명

[1-3문장으로 유저 관점에서 설명. 예: "유저가 포스트 고정 버튼을 누르면 해당 포스트가 목록 상단에 고정됩니다. 다시 누르면 고정이 해제됩니다. UI는 즉시 반응해야 합니다 (낙관적 업데이트)."]

## Feature 유형

- [ ] 폼 기반 (create/update) — useForm + zodResolver 사용
- [ ] 삭제 — confirm 다이얼로그 + delete mutation
- [ ] 토글/액션 — confirm 없이 즉시 실행
- [ ] 목록 조회 — useQuery/useInfiniteQuery 사용

## 관련 API 레이어 현황

아래 파일에서 이미 존재하는 mutation/query 훅 확인:
`src/domains/[도메인명]/_common/api/`

- [ ] 필요한 mutation/query 훅이 이미 존재함: `[훅 이름, 예: useUpdatePostMutation]`
- [ ] 새로 만들어야 함: API endpoint `[메서드 + 경로, 예: PATCH /post/:id/pin]`

## 폼 필드 (폼 기반일 때만 작성)

유저가 입력하는 필드:

```
[필드명]: [타입 + 유효성 규칙, 예: "title: string, 최소 1자"]
[필드명]: [타입]
```

## UI 컴포넌트 설명

만들어야 할 UI:

- 컴포넌트 유형: [예: "버튼", "폼 카드", "인라인 편집 폼"]
- 위치: `src/domains/[도메인]/features/[feature명]/ui/[컴포넌트명].tsx`
- 외관: [예: "채워진/비어있는 핀 아이콘 + 고정 수 표시", 또는 "Card 안에 입력폼"]

## 성공/에러 처리

- 성공 시: [예: "post detail, post list 쿼리 무효화", 또는 "목록 페이지로 이동"]
- 에러 시: [예: "낙관적 업데이트 롤백", 또는 "meta.errorMessage 토스트 표시"]

## Confirm 다이얼로그 필요 여부

- [ ] 필요 없음 (토글/즉시 실행)
- [ ] 필요함 — confirm 메시지: "[예: '정말 이 포스트의 고정을 해제하시겠습니까?']"

## 낙관적 업데이트 필요 여부

- [ ] 필요 없음
- [ ] 필요함 — 업데이트할 필드: [예: "isPinned, pinnedCount"]
  - 업데이트 대상 쿼리: [예: "postKeys.detail(postId) + postKeys.listRoot"]

## 완성된 UI를 연결할 위치

[예: "PostCard 컴포넌트 (`post/features/post-detail/ui/PostCard.tsx`) 하단 액션 버튼 영역에 추가"]
[예: "PostSubmitPage (`src/pages/post/PostSubmitPage.tsx`)에서 CreatePostForm 렌더링"]
