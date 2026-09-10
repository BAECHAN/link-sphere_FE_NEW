Create a complete new domain called "$ARGUMENTS" in the Link-Sphere FE project.

## Project context

Architecture: FSD (Feature-Sliced Design). 레이어: app → pages → widgets → features → entities → shared

Parse "$ARGUMENTS":

- Domain name (kebab-case): **$ARGUMENTS**
- Entity name: derive the PascalCase singular noun from the domain name (e.g. "notifications" → "Notification", "member-settings" → "MemberSetting")

## Step 1: Check existing patterns

Before creating any files, read these reference files to match the exact style:

- `src/entities/post/api/post.keys.ts` — keys + success handler pattern
- `src/entities/post/api/post.queries.ts` — mutation/query hook pattern
- `src/entities/post/model/post.schema.ts` — Zod schema pattern

## Step 2: Create files in this exact order

### 1. `src/entities/<entity>/model/<entity>.schema.ts`

```typescript
import { z } from 'zod';
import { TEXTS } from '@/shared/config/texts';

// Domain model — mirrors the backend entity
export const <entity>Schema = z.object({
  id: z.string(),
  // TODO: add domain-specific fields
  createdAt: z.coerce.date(),
});

// Form input schemas (separate from domain model)
export const create<Entity>Schema = z.object({
  // TODO: fields the user inputs to create
});

export const update<Entity>Schema = z.object({
  // TODO: fields the user inputs to update
});

export type <Entity> = z.infer<typeof <entity>Schema>;
export type Create<Entity> = z.infer<typeof create<Entity>Schema>;
export type Update<Entity> = z.infer<typeof update<Entity>Schema>;
```

### 2. `src/entities/<entity>/api/<entity>.api.ts`

```typescript
import { apiClient } from '@/shared/api/client';
import { API_ENDPOINTS } from '@/shared/config/api';
import { Create<Entity>, Update<Entity>, <Entity> } from '../model/<entity>.schema';

export const <entity>Api = {
  create<Entity>: async (payload: Create<Entity>): Promise<<Entity>> =>
    apiClient.post<<Entity>>(API_ENDPOINTS.<domain>.base, payload),

  fetch<Entity>List: async (): Promise<<Entity>[]> =>
    apiClient.get<<Entity>[]>(API_ENDPOINTS.<domain>.base),

  fetch<Entity>: async (id: string): Promise<<Entity>> =>
    apiClient.get<<Entity>>(`${API_ENDPOINTS.<domain>.base}/${id}`),

  update<Entity>: async (id: string, payload: Update<Entity>): Promise<<Entity>> =>
    apiClient.patch<<Entity>>(`${API_ENDPOINTS.<domain>.base}/${id}`, payload),

  delete<Entity>: async (id: string): Promise<void> =>
    apiClient.delete<void>(`${API_ENDPOINTS.<domain>.base}/${id}`),
};
```

### 3. `src/entities/<entity>/api/<entity>.keys.ts`

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

### 4. `src/entities/<entity>/api/<entity>.queries.ts`

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

## Step 3: Update shared config files

### `src/shared/config/api.ts`

Add a new entry under `API_ENDPOINTS` and `API_BASES`:

```typescript
// In API_BASES — prefix 없는 상대 경로만. API_BASE_URL은 apiClient가 한 번만 붙인다
// (여기서 다시 붙이면 prefix가 중복된다):
<domain>: '/<domain-path>',

// In API_ENDPOINTS:
<domain>: {
  base: API_BASES.<domain>,
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
  <entity>DeleteConfirm: '정말 이 <entity>를 삭제할까요? 삭제된 데이터는 복구할 수 없어요.',
},
```

## Step 4: Remind the user

After creating these files, tell the user:

1. The TODO fields in the schema file need to be filled in with actual entity fields
2. Add a route constant to `src/shared/config/route-paths.ts`
3. Register the route in `src/app/routes/index.tsx`
4. Create the first feature with `/new-feature $ARGUMENTS <feature-name>`
