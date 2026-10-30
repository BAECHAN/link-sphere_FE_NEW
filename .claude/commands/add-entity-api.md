Add the full 3-layer API for a new entity in an existing domain.

## Argument format

"$ARGUMENTS" — format: `<domain-name> <entity-name>`

Examples: `post tag`, `member address`, `notification setting`

Parse:

- Domain: first word (kebab-case)
- Entity: remaining words (kebab-case → derive PascalCase for type names)

## Before creating files

1. Check if `src/entities/<entity>/model/<entity>.dto.ts` already exists — if not, run
   `/add-schema <domain> <entity>` first (creates the response DTO alias and, if needed,
   a request/form Zod schema — see that command for the current convention)
2. Find the BE paths in `src/shared/api/generated/openapi.gen.ts` (`paths`) — `specClient` only
   accepts paths that exist there. If they are missing, refresh the spec with
   `pnpm codegen:fetch && pnpm codegen` (`docs/OPENAPI-CODEGEN.md` §5-1)
3. Read `src/shared/config/texts.ts` to understand current TEXTS structure

## Files to create

### 1. `src/entities/<entity>/api/<entity>.api.ts`

Call the BE only through `specClient` with the spec path template — the path decides the
`path`/`query`/`body` and response types (`docs/OPENAPI-CODEGEN.md` §5-2). Replace
`/<entity-path>` and `{id}` with the exact path and variable names from `paths`.

```typescript
import { specClient } from '@/shared/api/spec-client';
import type { <Entity> } from '@/entities/<entity>/model/<entity>.dto';
import { Create<Entity>, Update<Entity> } from '@/entities/<entity>/model/<entity>.schema';

export const <entity>Api = {
  create<Entity>: async (payload: Create<Entity>): Promise<<Entity>> =>
    specClient.post('/<entity-path>', { body: payload }),

  fetch<Entity>List: async (): Promise<<Entity>[]> => specClient.get('/<entity-path>'),

  fetch<Entity>: async (id: string): Promise<<Entity>> =>
    specClient.get('/<entity-path>/{id}', { path: { id } }),

  update<Entity>: async (id: string, payload: Update<Entity>): Promise<<Entity>> =>
    specClient.patch('/<entity-path>/{id}', { path: { id }, body: payload }),

  delete<Entity>: async (id: string): Promise<void> =>
    specClient.delete('/<entity-path>/{id}', { path: { id } }),
};
```

### 2. `src/entities/<entity>/api/<entity>.keys.ts`

```typescript
import type { QueryClient } from '@tanstack/react-query';
import type { <Entity> } from '@/entities/<entity>/model/<entity>.dto';

const rootKey = ['<entity>'] as const;

export const <entity>MutationKeys = {
  create: [...rootKey, 'create'] as const,
  update: (id: <Entity>['id']) => [...rootKey, 'update', id] as const,
  delete: [...rootKey, 'delete'] as const,
};

export const <entity>Keys = {
  root: rootKey,
  listRoot: [...rootKey, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...rootKey, 'list', filters] as const,
  detail: (id: <Entity>['id']) => [...rootKey, 'detail', id] as const,
};

// queryClient는 싱글턴을 직접 import하지 않고 항상 인자로 받는다
// (custom-query-rules/no-query-client-singleton-import가 강제 — 호출부는 useQueryClient()로 주입).
export const <entity>InvalidateQueries = {
  all: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: rootKey });
  },
  list: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: <entity>Keys.listRoot });
  },
  detail: (queryClient: QueryClient, id: <Entity>['id']) => {
    queryClient.invalidateQueries({ queryKey: <entity>Keys.detail(id) });
  },
};

export const handle<Entity>CreateSuccess = (queryClient: QueryClient) => {
  <entity>InvalidateQueries.list(queryClient);
};
export const handle<Entity>UpdateSuccess = (queryClient: QueryClient, id: <Entity>['id']) => {
  <entity>InvalidateQueries.detail(queryClient, id);
  <entity>InvalidateQueries.list(queryClient);
};
export const handle<Entity>DeleteSuccess = (queryClient: QueryClient) => {
  <entity>InvalidateQueries.list(queryClient);
};
```

### 3. `src/entities/<entity>/api/<entity>.queries.ts`

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { <entity>Api } from '@/entities/<entity>/api/<entity>.api';
import {
  <entity>Keys,
  <entity>MutationKeys,
  handle<Entity>CreateSuccess,
  handle<Entity>UpdateSuccess,
  handle<Entity>DeleteSuccess,
} from '@/entities/<entity>/api/<entity>.keys';
import { TEXTS } from '@/shared/config/texts';
import { Create<Entity>, Update<Entity> } from '@/entities/<entity>/model/<entity>.schema';

export const useCreate<Entity>Mutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: <entity>MutationKeys.create,
    mutationFn: (payload: Create<Entity>) => <entity>Api.create<Entity>(payload),
    meta: {
      successMessage: TEXTS.messages.success.<entity>Created,
      errorMessage: TEXTS.messages.error.<entity>CreateFailed,
    },
    onSuccess: () => handle<Entity>CreateSuccess(queryClient),
  });
};

export const useFetch<Entity>ListQuery = () =>
  useQuery({
    queryKey: <entity>Keys.listRoot,
    queryFn: () => <entity>Api.fetch<Entity>List(),
  });

export const useFetch<Entity>Query = (id: string) =>
  useQuery({
    queryKey: <entity>Keys.detail(id),
    queryFn: () => <entity>Api.fetch<Entity>(id),
    enabled: !!id,
  });

export const useUpdate<Entity>Mutation = (id: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: <entity>MutationKeys.update(id),
    mutationFn: (payload: Update<Entity>) => <entity>Api.update<Entity>(id, payload),
    meta: {
      successMessage: TEXTS.messages.success.<entity>Updated,
      errorMessage: TEXTS.messages.error.<entity>UpdateFailed,
    },
    onSuccess: () => handle<Entity>UpdateSuccess(queryClient, id),
  });
};

export const useDelete<Entity>Mutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: <entity>MutationKeys.delete,
    mutationFn: (id: string) => <entity>Api.delete<Entity>(id),
    meta: {
      // 확인창(openConfirm)을 거친 영구 삭제는 결과가 화면에 보여도 성공 토스트를 띄운다
      // (texts-conventions skill "성공 토스트 표시 기준" 축 4 — useDeletePostMutation의
      // postDeleted와 같다). 확인창 없이 그 자리에서 바뀌는 가벼운 제거면 successMessage를 뺀다.
      successMessage: TEXTS.messages.success.<entity>Deleted,
      errorMessage: TEXTS.messages.error.<entity>DeleteFailed,
    },
    onSuccess: () => handle<Entity>DeleteSuccess(queryClient),
  });
};
```

## Files to update

No `API_ENDPOINTS` entry is needed — `specClient` takes the spec path directly.

### `src/shared/config/texts.ts`

Add under `messages`:

```typescript
// 해요체로 통일한다(texts.test.ts가 '~습니다'/'~습니까' 어미를 금지 정규식으로 검사한다).
success: {
  <entity>Created: '<Entity>를 생성했어요.',
  <entity>Updated: '<Entity>를 수정했어요.',
  <entity>Deleted: '<Entity>를 삭제했어요.',
},
error: {
  <entity>CreateFailed: '<Entity> 생성에 실패했어요.',
  <entity>UpdateFailed: '<Entity> 수정에 실패했어요.',
  <entity>DeleteFailed: '<Entity> 삭제에 실패했어요.',
},
warning: {
  <entity>DeleteConfirm: '정말 이 <entity>를 삭제할까요?',
},
```

삭제 성공 토스트(`<entity>Deleted`)는 확인창(`openConfirm`)을 거치는 영구 삭제일 때 넣는다 —
목록에서 사라져도 그 순간이 확인창 닫힘과 겹쳐 결과가 눈에 잘 안 들어온다(`texts-conventions`
skill "성공 토스트 표시 기준" 축 4, 선례 `postDeleted`·`commentDeleted`·`folderDeleted`). 확인창
없이 그 자리에서 바뀌고 다시 누르면 돌아가는 가벼운 제거(좋아요 취소·최근 검색어 삭제 등)는
토스트를 뺀다.

## Notes

- If `<entity>.dto.ts` doesn't exist, run `/add-schema <domain> <entity>` first — see
  `src/entities/post/model/post.dto.ts` for the current response-type pattern
- If only some CRUD operations are needed, omit the unused functions from api.ts and their corresponding hooks from queries.ts
- If `<Entity>` narrows the spec type (an `Omit<...> & {...}` override in `.dto.ts`, like
  `Account.role`), pass it as the second generic — `specClient.get<'/<entity-path>/{id}', <Entity>>(…)` —
  with a comment pointing to the `.dto.ts` reason (reference: `src/entities/account/api/account.api.ts`)
- For cross-domain invalidation (e.g. creating a comment also invalidates the post), don't
  import the other entity's `.keys.ts`/`.api.ts` directly — that exposes its entire public
  surface. Instead go through its `@x/<this-entity>.ts` cross-reference file (FSD `@x`
  notation, `docs/FE-ARCHITECTURE.md` §5) and call its `<entity>InvalidateQueries.xxx()`
  wrapper from the success handler in `<entity>.keys.ts`. If that `@x` file doesn't exist yet,
  create it in the other entity's folder, re-exporting only what this entity actually needs
  (reference: `src/entities/post/@x/comment.ts`, whose `postInvalidateQueries` is called from
  the success handlers in `src/entities/comment/api/comment.keys.ts`)
