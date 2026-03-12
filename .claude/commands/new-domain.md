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
import { queryClient } from '@/shared/lib/react-query/config/queryClient';
import { <Entity> } from '../model/<entity>.schema';

const rootKey = ['<entity>'] as const;

export const <entity>Keys = {
  root: rootKey,
  listRoot: [...rootKey, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...rootKey, 'list', filters] as const,
  detail: (id: <Entity>['id']) => [...rootKey, 'detail', id] as const,
};

export const <entity>InvalidateQueries = {
  all: () => queryClient.invalidateQueries({ queryKey: rootKey }),
  list: () => queryClient.invalidateQueries({ queryKey: <entity>Keys.listRoot }),
  detail: (id: <Entity>['id']) =>
    queryClient.invalidateQueries({ queryKey: <entity>Keys.detail(id) }),
};

export const handle<Entity>CreateSuccess = () => { <entity>InvalidateQueries.list(); };
export const handle<Entity>UpdateSuccess = (id: <Entity>['id']) => {
  <entity>InvalidateQueries.detail(id);
  <entity>InvalidateQueries.list();
};
export const handle<Entity>DeleteSuccess = () => { <entity>InvalidateQueries.list(); };
```

### 4. `src/entities/<entity>/api/<entity>.queries.ts`

```typescript
import { useMutation, useQuery } from '@tanstack/react-query';
import { <entity>Api } from './<entity>.api';
import {
  <entity>Keys,
  handle<Entity>CreateSuccess,
  handle<Entity>UpdateSuccess,
  handle<Entity>DeleteSuccess,
} from './<entity>.keys';
import { TEXTS } from '@/shared/config/texts';
import { Create<Entity>, Update<Entity> } from '../model/<entity>.schema';

export const useCreate<Entity>Mutation = () =>
  useMutation({
    mutationFn: (payload: Create<Entity>) => <entity>Api.create<Entity>(payload),
    meta: {
      successMessage: TEXTS.messages.success.<entity>Created,
      errorMessage: TEXTS.messages.error.<entity>CreateFailed,
    },
    onSuccess: () => handle<Entity>CreateSuccess(),
  });

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

export const useUpdate<Entity>Mutation = (id: string) =>
  useMutation({
    mutationFn: (payload: Update<Entity>) => <entity>Api.update<Entity>(id, payload),
    meta: {
      successMessage: TEXTS.messages.success.<entity>Updated,
      errorMessage: TEXTS.messages.error.<entity>UpdateFailed,
    },
    onSuccess: () => handle<Entity>UpdateSuccess(id),
  });

export const useDelete<Entity>Mutation = () =>
  useMutation({
    mutationFn: (id: string) => <entity>Api.delete<Entity>(id),
    meta: {
      successMessage: TEXTS.messages.success.<entity>Deleted,
      errorMessage: TEXTS.messages.error.<entity>DeleteFailed,
    },
    onSuccess: () => handle<Entity>DeleteSuccess(),
  });
```

## Step 3: Update shared config files

### `src/shared/config/api.ts`

Add a new entry under `API_ENDPOINTS` and `API_BASES`:

```typescript
// In API_BASES:
<domain>: `${API_BASE_URL}/<domain-path>`,

// In API_ENDPOINTS:
<domain>: {
  base: API_BASES.<domain>,
},
```

### `src/shared/config/texts.ts`

Add under `messages`:

```typescript
success: {
  <entity>Created: '<Entity>가 생성되었습니다.',
  <entity>Updated: '<Entity>가 수정되었습니다.',
  <entity>Deleted: '<Entity>가 삭제되었습니다.',
},
error: {
  <entity>CreateFailed: '<Entity> 생성에 실패했습니다.',
  <entity>UpdateFailed: '<Entity> 수정에 실패했습니다.',
  <entity>DeleteFailed: '<Entity> 삭제에 실패했습니다.',
},
warning: {
  <entity>DeleteConfirm: '정말 이 <entity>를 삭제하시겠습니까? 삭제된 데이터는 복구할 수 없습니다.',
},
```

## Step 4: Remind the user

After creating these files, tell the user:

1. The TODO fields in the schema file need to be filled in with actual entity fields
2. Add a route constant to `src/shared/config/route-paths.ts`
3. Register the route in `src/app/routes/index.tsx`
4. Create the first feature with `/new-feature $ARGUMENTS <feature-name>`
