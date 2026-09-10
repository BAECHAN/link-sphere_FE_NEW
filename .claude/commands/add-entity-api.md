Add the full 3-layer API for a new entity in an existing domain.

## Argument format

"$ARGUMENTS" — format: `<domain-name> <entity-name>`

Examples: `post tag`, `member address`, `notification setting`

Parse:

- Domain: first word (kebab-case)
- Entity: remaining words (kebab-case → derive PascalCase for type names)

## Before creating files

1. Check if `src/entities/<entity>/model/<entity>.schema.ts` already exists — if not, create the schema file first
2. Read `src/shared/config/api.ts` to understand current API_ENDPOINTS structure
3. Read `src/shared/config/texts.ts` to understand current TEXTS structure

## Files to create

### 1. `src/entities/<entity>/api/<entity>.api.ts`

```typescript
import { apiClient } from '@/shared/api/client';
import { API_ENDPOINTS } from '@/shared/config/api';
import { Create<Entity>, Update<Entity>, <Entity> } from '../model/<entity>.schema';

export const <entity>Api = {
  create<Entity>: async (payload: Create<Entity>): Promise<<Entity>> =>
    apiClient.post<<Entity>>(API_ENDPOINTS.<domain>.<entity>, payload),

  fetch<Entity>List: async (): Promise<<Entity>[]> =>
    apiClient.get<<Entity>[]>(API_ENDPOINTS.<domain>.<entity>),

  fetch<Entity>: async (id: string): Promise<<Entity>> =>
    apiClient.get<<Entity>>(`${API_ENDPOINTS.<domain>.<entity>}/${id}`),

  update<Entity>: async (id: string, payload: Update<Entity>): Promise<<Entity>> =>
    apiClient.patch<<Entity>>(`${API_ENDPOINTS.<domain>.<entity>}/${id}`, payload),

  delete<Entity>: async (id: string): Promise<void> =>
    apiClient.delete<void>(`${API_ENDPOINTS.<domain>.<entity>}/${id}`),
};
```

### 2. `src/entities/<entity>/api/<entity>.keys.ts`

```typescript
import type { QueryClient } from '@tanstack/react-query';
import { <Entity> } from '../model/<entity>.schema';

const rootKey = ['<entity>'] as const;

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
import { <entity>Api } from './<entity>.api';
import {
  <entity>Keys,
  handle<Entity>CreateSuccess,
  handle<Entity>UpdateSuccess,
  handle<Entity>DeleteSuccess,
} from './<entity>.keys';
import { TEXTS } from '@/shared/config/texts';
import { Create<Entity>, Update<Entity> } from '../model/<entity>.schema';

export const useCreate<Entity>Mutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
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
    mutationFn: (id: string) => <entity>Api.delete<Entity>(id),
    meta: {
      successMessage: TEXTS.messages.success.<entity>Deleted,
      errorMessage: TEXTS.messages.error.<entity>DeleteFailed,
    },
    onSuccess: () => handle<Entity>DeleteSuccess(queryClient),
  });
};
```

## Files to update

### `src/shared/config/api.ts`

Add the new endpoint under the domain section:

```typescript
<domain>: {
  ...existing,
  <entity>: `${API_BASES.<domain>}/<entity-path>`,
},
```

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

## Notes

- If the schema file doesn't exist, create it first following the pattern in `src/entities/post/model/post.schema.ts`
- If only some CRUD operations are needed, omit the unused functions from api.ts and their corresponding hooks from queries.ts
- For cross-domain invalidation (e.g. creating a comment also invalidates the post), import and call the other domain's `InvalidateQueries` in the success handler in `<entity>.keys.ts`
