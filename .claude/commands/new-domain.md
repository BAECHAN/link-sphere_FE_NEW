Create a complete new domain called "$ARGUMENTS" in the Link-Sphere FE project.

## Project context

Architecture: FSD (Feature-Sliced Design). 레이어: app → pages → widgets → features → entities → shared

Parse "$ARGUMENTS":

- Domain name (kebab-case): **$ARGUMENTS**
- Entity name: derive the PascalCase singular noun from the domain name (e.g. "notifications" → "Notification", "member-settings" → "MemberSetting")

## Step 1: Check existing patterns

Before creating any files, read these reference files to match the exact style:

- `src/entities/post/model/post.dto.ts` — 응답 타입 alias 패턴(BE 생성 타입에서 alias, Zod 아님)
- `src/entities/account/model/account.dto.ts` — override가 필요한 경우의 패턴(근거 주석 포함)
- `src/entities/post/model/post.schema.ts` — Zod 요청/폼 검증 스키마 패턴(응답 타입이 아니라 사용자 입력만)
- `src/entities/post/api/post.keys.ts` — keys + mutation keys + success handler 패턴
- `src/entities/post/api/post.queries.ts` — mutation/query hook 패턴(`mutationKey:` 사용 포함)

이 레포는 응답 타입과 요청 검증을 분리한다(`/add-schema` 커맨드의 규약과 동일) — 응답은
**절대** Zod로 손으로 옮겨적지 않는다. 아래 Step 2는 이 규약을 따른다.

## Step 2: Create files in this exact order

### 1. `src/entities/<entity>/model/<entity>.dto.ts` (응답 타입, 항상 만든다)

```typescript
import type { components } from '@/shared/api/generated/openapi.gen';

// BE 스펙(src/shared/api/generated/openapi.json)에서 생성된 타입에 이 레포의 도메인
// 이름을 붙이는 얇은 alias 레이어다.
export type <Entity> = components['schemas']['<BE스키마이름>Response'];
```

BE의 nullable/enum이 스펙에 정확히 안 실리는 경우만 `Omit` + intersection으로 override하고,
반드시 BE 소스 파일:줄을 근거 주석으로 남긴다(`src/entities/account/model/account.dto.ts` 참고).
override가 필요 없으면 위 한 줄로 끝난다.

### 2. `src/entities/<entity>/model/<entity>.schema.ts` (요청·폼 검증, 필요할 때만)

생성/수정 폼처럼 **사용자 입력을 검증**해야 할 때만 만든다. 순수 조회 전용 엔티티라면
이 파일은 필요 없다 — `.dto.ts`의 타입을 그대로 쓴다. 이 경우 아래 api·keys·queries 템플릿에서
create/update 함수·훅과 `Create<Entity>`·`Update<Entity>` import를 빼고, `<Entity>`는
`@/entities/<entity>/model/<entity>.dto`에서 import한다.

```typescript
import { z } from 'zod';

export const create<Entity>Schema = z.object({
  // TODO: fields the user inputs to create
});

export const update<Entity>Schema = z.object({
  // TODO: fields the user inputs to update
});

export type Create<Entity> = z.infer<typeof create<Entity>Schema>;
export type Update<Entity> = z.infer<typeof update<Entity>Schema>;

// 응답 타입은 dto.ts(BE 스펙 생성)에서 가져간다 — Zod로 옮겨적지 않는다.
export type { <Entity> } from '@/entities/<entity>/model/<entity>.dto';
```

### 3. `src/entities/<entity>/api/<entity>.api.ts`

```typescript
import { apiClient } from '@/shared/api/client';
import { API_ENDPOINTS } from '@/shared/config/api';
import { Create<Entity>, Update<Entity>, <Entity> } from '@/entities/<entity>/model/<entity>.schema';

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

### 4. `src/entities/<entity>/api/<entity>.keys.ts`

```typescript
import type { QueryClient } from '@tanstack/react-query';
import { <Entity> } from '@/entities/<entity>/model/<entity>.schema';

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

### 5. `src/entities/<entity>/api/<entity>.queries.ts`

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
      // 삭제는 목록에서 바로 사라져 결과가 눈에 보이므로 성공 토스트를 따로 띄우지
      // 않는다(texts-conventions skill "성공 토스트 표시 기준" — postDeleted도 같은
      // 이유로 없음). 화면 밖에서 바뀌어 눈에 안 띄는 경우에만 successMessage를 추가한다.
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

삭제 성공 토스트(`<entity>Deleted`)는 넣지 않는다 — 삭제는 목록에서 바로 사라져 결과가
눈에 보인다(`texts-conventions` skill "성공 토스트 표시 기준" 참고, 실제로 `postDeleted`
키도 없다). 수정처럼 화면 밖에서 바뀌어 눈에 안 띄는 필드가 있을 때만 성공 토스트를 쓴다.

## Step 4: Remind the user

After creating these files, tell the user:

1. The TODO fields in the schema file need to be filled in with actual entity fields
2. Add a route constant to `src/shared/config/route-paths.ts`
3. Register the route in `src/app/routes/index.tsx`
   - Also add the path to `APP_ROUTES` (or `APP_ROUTE_PATTERNS` for dynamic segments) in
     `infra/cloudfront-functions/spa-fallback.js` and redeploy the Function by hand
     (`docs/DEPLOY.md` "CloudFront Function (수동 관리)") — otherwise
     `src/app/routes/cloudfront-functions.test.ts` fails and production answers the new route
     with a 404 status
4. Create the first feature with `/new-feature $ARGUMENTS <feature-name>`
