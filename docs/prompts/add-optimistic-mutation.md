# 프롬프트 템플릿: 낙관적 업데이트 Mutation 추가

**참조 코드**: `src/domains/post/_common/api/interaction.queries.ts` (`useLikePostMutation`, `useBookmarkPostMutation`)

**사용법**: 대괄호 `[ ]` 안의 내용을 채운 뒤 Claude Code에 붙여넣으세요.

---

**[도메인명]** 도메인에서 **[동작 설명, 예: "포스트 고정 상태 토글"]** 에 대한 낙관적 업데이트 mutation을 추가해주세요.

## 엔티티 및 쿼리 컨텍스트

- 엔티티 타입: **[엔티티명, 예: "Post"]**
  - import 경로: `@/domains/[도메인]/_common/model/[엔티티].schema`
- 토글/업데이트할 필드: `[필드명]: [타입, 예: "isPinned: boolean"]`
- 연관 카운트 필드 (있다면): `[필드명]: [타입, 예: "pinnedCount: number"]`

## 낙관적으로 업데이트할 쿼리

```typescript
// 업데이트할 쿼리 키들 (해당하는 것 모두 체크)
[엔티티]Keys.detail([id])     // ✅ or ❌
[엔티티]Keys.listRoot         // ✅ or ❌ (목록에도 해당 필드가 표시될 때)
```

## API 호출 정보

- mutation 함수: `[엔티티]Api.[메서드명]([파라미터])`
- API 엔드포인트: `[메서드] [경로, 예: "PATCH /post/:id/pin"]`
- 반환값: [예: "없음 (void)", 또는 "업데이트된 엔티티 (Post)"]

## 낙관적 업데이트 로직

**onMutate 시 적용할 변경:**

```
[필드명]: [변경 로직, 예: "현재 값의 반대로 (isLiked → !isLiked)"]
[카운트 필드]: [변경 로직, 예: "isLiked가 true면 -1, false면 +1"]
```

**목록 업데이트 방식** (목록에도 적용할 때):

- [ ] `pages` → `content` 배열을 map으로 순회하며 id 일치 항목 업데이트
- [ ] `InfiniteData<[엔티티]ListResponse>` 타입 사용

## 훅 이름

```typescript
export const use[Action][Entity]Mutation = ([entityId]: string) => { ... }
// 예: export const usePinPostMutation = (postId: string) => { ... }
```

## 수정할 파일

`src/domains/[도메인]/_common/api/[엔티티].queries.ts` — 기존 mutation 훅들 아래에 추가

## 구현 시 반드시 포함할 것

```typescript
onMutate: async () => {
  // 1. 진행 중인 쿼리 취소
  await queryClient.cancelQueries({ queryKey: [엔티티]Keys.detail([id]) });
  // (목록도 포함할 때) await queryClient.cancelQueries({ queryKey: [엔티티]Keys.listRoot });

  // 2. 현재 캐시 데이터 저장 (롤백용)
  const previous[Entity] = queryClient.getQueryData<[Entity]>([엔티티]Keys.detail([id]));

  // 3. 낙관적으로 캐시 업데이트
  queryClient.setQueryData<[Entity]>([엔티티]Keys.detail([id]), (old) => {
    if (!old) return old;
    return { ...old, [필드]: !old.[필드] };
  });

  // 4. 목록도 업데이트 (필요시)
  // queryClient.setQueriesData<InfiniteData<[Entity]ListResponse>>(...)

  return { previous[Entity] };
},
onSuccess: () => {},
onError: (_err, _vars, context) => {
  // 5. 에러 시 롤백
  if (context?.previous[Entity]) {
    queryClient.setQueryData([엔티티]Keys.detail([id]), context.previous[Entity]);
  }
},
```

## 참고사항

- `InfiniteData`는 `@tanstack/react-query`에서 import
- 목록의 모든 페이지 업데이트: `oldData.pages.map(page => ({ ...page, content: page.content.map(...) }))`
- 댓글 내 중첩 데이터 업데이트 시 재귀 함수 필요할 수 있음 (interaction.queries.ts 참조)
