# Link-Sphere FE — Claude Code Guide

## Project Structure

```
src/
├── app/                        # 앱 초기화, providers, routing, layouts
├── domains/<domain>/
│   ├── _common/
│   │   ├── api/
│   │   │   ├── <entity>.api.ts      # 순수 async fetch 호출만 (React 의존 없음)
│   │   │   ├── <entity>.keys.ts     # 쿼리 키 + invalidation helpers + success handlers
│   │   │   └── <entity>.queries.ts  # 얇은 React Query 훅 래퍼
│   │   ├── model/
│   │   │   └── <entity>.schema.ts   # Zod 스키마 + TypeScript 타입
│   │   ├── hooks/                   # 도메인 공통 훅 (feature 비특화)
│   │   ├── config/                  # 도메인 설정
│   │   └── ui/                      # 도메인 공통 UI
│   └── features/<feature-name>/
│       ├── hooks/
│       │   └── use<FeatureName>.ts  # 비즈니스 로직 (form, mutations, state, navigation)
│       └── ui/
│           └── <FeatureName>.tsx    # 얇은 UI — 훅 호출 + JSX 렌더링만
├── shared/
│   ├── api/          # client.ts, common.schema.ts, common.queries.ts
│   ├── config/       # texts.ts (TEXTS), api.ts (API_ENDPOINTS), route-paths.ts
│   ├── hooks/        # 재사용 가능한 제네릭 훅
│   ├── lib/          # react-query/config/queryClient.ts
│   ├── store/        # Zustand 스토어
│   ├── types/        # common.type.ts, auth.type.ts
│   ├── ui/
│   │   ├── atoms/    # CVA 기반 Shadcn 기본 컴포넌트 (Button, Input, Card 등)
│   │   └── elements/ # 조합 컴포넌트 (FormInput, ActionButton, modal/alert)
│   └── utils/
└── pages/            # 페이지 컴포넌트, 얇은 래퍼
```

## 현재 도메인

| 도메인   | 엔티티                     | 위치                  |
| -------- | -------------------------- | --------------------- |
| `post`   | post, comment, interaction | `src/domains/post/`   |
| `auth`   | auth (login, sign-up)      | `src/domains/auth/`   |
| `member` | member (profile)           | `src/domains/member/` |

---

## 3-Layer API 패턴

**절대로 레이어를 건너뛰거나 합치지 않는다.**

### Layer 1 — `<entity>.api.ts` (순수 async, React 없음)

```typescript
import { apiClient } from '@/shared/api/client';
import { API_ENDPOINTS } from '@/shared/config/api';

export const entityApi = {
  createEntity: async (payload: CreateEntity): Promise<Entity> =>
    apiClient.post<Entity>(API_ENDPOINTS.domain.base, payload),

  fetchEntityList: async (): Promise<Entity[]> =>
    apiClient.get<Entity[]>(API_ENDPOINTS.domain.base),

  fetchEntity: async (id: string): Promise<Entity> =>
    apiClient.get<Entity>(`${API_ENDPOINTS.domain.base}/${id}`),

  updateEntity: async (id: string, payload: UpdateEntity): Promise<Entity> =>
    apiClient.patch<Entity>(`${API_ENDPOINTS.domain.base}/${id}`, payload),

  deleteEntity: async (id: string): Promise<void> =>
    apiClient.delete<void>(`${API_ENDPOINTS.domain.base}/${id}`),
};
```

### Layer 2 — `<entity>.keys.ts` (쿼리 키 + success handlers)

```typescript
import { queryClient } from '@/shared/lib/react-query/config/queryClient';

const rootKey = ['entity'] as const;

export const entityKeys = {
  root: rootKey,
  listRoot: [...rootKey, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...rootKey, 'list', filters] as const,
  detail: (id: Entity['id']) => [...rootKey, 'detail', id] as const,
};

export const entityInvalidateQueries = {
  all: () => queryClient.invalidateQueries({ queryKey: rootKey }),
  list: () => queryClient.invalidateQueries({ queryKey: entityKeys.listRoot }),
  detail: (id: Entity['id']) => queryClient.invalidateQueries({ queryKey: entityKeys.detail(id) }),
};

export const handleEntityCreateSuccess = () => {
  entityInvalidateQueries.list();
};
export const handleEntityUpdateSuccess = (id: Entity['id']) => {
  entityInvalidateQueries.detail(id);
  entityInvalidateQueries.list();
};
export const handleEntityDeleteSuccess = () => {
  entityInvalidateQueries.list();
};
```

### Layer 3 — `<entity>.queries.ts` (얇은 React Query 래퍼)

```typescript
import { useMutation, useQuery } from '@tanstack/react-query';
import { entityApi } from './entity.api';
import { entityKeys, handleEntityCreateSuccess } from './entity.keys';
import { TEXTS } from '@/shared/config/texts';

export const useCreateEntityMutation = () =>
  useMutation({
    mutationFn: (payload: CreateEntity) => entityApi.createEntity(payload),
    meta: {
      successMessage: TEXTS.messages.success.entityCreated,
      errorMessage: TEXTS.messages.error.entityCreateFailed,
    },
    onSuccess: () => handleEntityCreateSuccess(),
  });

export const useFetchEntityQuery = (id: string) =>
  useQuery({
    queryKey: entityKeys.detail(id),
    queryFn: () => entityApi.fetchEntity(id),
    enabled: !!id,
  });
```

---

## Feature Hook 패턴

feature hook = 모든 비즈니스 로직. UI 파일은 훅을 호출하고 JSX만 렌더링.

```typescript
// domains/<domain>/features/<feature-name>/hooks/use<FeatureName>.ts
export function useCreateEntity() {
  const navigate = useNavigate();
  const { mutateAsync: createEntity, isPending: isCreating } = useCreateEntityMutation();

  const form = useForm<CreateEntity>({
    resolver: zodResolver(createEntitySchema),
    defaultValues: { name: '' },
    mode: 'onChange',
  });

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      await createEntity(data, {
        onSuccess: () => {
          form.reset();
          navigate(ROUTES_PATHS.ENTITY.ROOT);
        },
      });
    } catch (error) {
      console.error(error);
    }
  });

  return { form, onSubmit, isCreating };
}
```

---

## UI Component 패턴 (얇은 레이어)

```typescript
// domains/<domain>/features/<feature-name>/ui/<FeatureName>Form.tsx
export function CreateEntityForm() {
  const { form, onSubmit, isCreating } = useCreateEntity();
  const { isDirty, isValid } = form.formState;
  const canSubmit = isDirty && isValid && !isCreating;

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate>
        <FormInput name="name" label="이름" required disabled={isCreating} />
        <Button type="submit" disabled={!canSubmit}>
          {isCreating ? '처리 중...' : '제출'}
        </Button>
      </form>
    </FormProvider>
  );
}
```

---

## Zod Schema 패턴

```typescript
// _common/model/<entity>.schema.ts
// 도메인 모델 (서버 응답 전체)
export const entitySchema = z.object({
  id: z.string(),
  name: z.string().min(1, TEXTS.validation.nameRequired),
  createdAt: z.coerce.date(),
});

// Form 입력 스키마 (도메인 모델과 별도)
export const createEntitySchema = z.object({ name: z.string().min(1) });
export const updateEntitySchema = z.object({ name: z.string().min(1) });

export type Entity = z.infer<typeof entitySchema>;
export type CreateEntity = z.infer<typeof createEntitySchema>;
export type UpdateEntity = z.infer<typeof updateEntitySchema>;
```

---

## Delete with Confirm 패턴

**절대로** native `confirm()` 사용 금지. 항상 `useAlert` + `openConfirm` 사용.

```typescript
import { useAlert } from '@/shared/ui/elements/modal/alert/alert.store';

const { openConfirm } = useAlert();
const onDelete = (id: string) => {
  openConfirm({
    message: TEXTS.messages.warning.entityDeleteConfirm,
    confirmText: TEXTS.buttons.delete,
    onConfirm: async () => {
      await deleteEntity(id);
    },
  });
};
```

---

## Optimistic Update 패턴

참조: `src/domains/post/_common/api/interaction.queries.ts` (`useLikePostMutation`)

```typescript
onMutate: async () => {
  await queryClient.cancelQueries({ queryKey: entityKeys.detail(id) });
  const previous = queryClient.getQueryData<Entity>(entityKeys.detail(id));
  queryClient.setQueryData<Entity>(entityKeys.detail(id), (old) =>
    old ? { ...old, isLiked: !old.isLiked } : old
  );
  return { previous };
},
onError: (_err, _vars, context) => {
  queryClient.setQueryData(entityKeys.detail(id), context?.previous);
},
```

---

## 핵심 설정 파일 위치

| 목적               | 파일                                                | export          |
| ------------------ | --------------------------------------------------- | --------------- |
| 모든 UI 문자열     | `src/shared/config/texts.ts`                        | `TEXTS`         |
| API 엔드포인트     | `src/shared/config/api.ts`                          | `API_ENDPOINTS` |
| 라우트 경로        | `src/shared/config/route-paths.ts`                  | `ROUTES_PATHS`  |
| HTTP 클라이언트    | `src/shared/api/client.ts`                          | `apiClient`     |
| QueryClient        | `src/shared/lib/react-query/config/queryClient.ts`  | `queryClient`   |
| Alert/Confirm 모달 | `src/shared/ui/elements/modal/alert/alert.store.ts` | `useAlert`      |
| Auth 스토어        | `src/shared/store/auth.store.ts`                    | `useAuthStore`  |

---

## 네이밍 컨벤션

| 항목             | 규칙                                     | 예시                             |
| ---------------- | ---------------------------------------- | -------------------------------- |
| Feature 디렉토리 | kebab-case                               | `create-post/`                   |
| Shared 디렉토리  | camelCase                                | `hooks/`, `utils/`               |
| 컴포넌트 파일    | PascalCase.tsx                           | `CreatePostForm.tsx`             |
| Feature 훅       | `use<FeatureName>.ts`                    | `useCreatePost.ts`               |
| Mutation 훅      | `use<Action><Entity>Mutation`            | `useCreatePostMutation`          |
| Query 훅         | `useFetch<Entity>Query`                  | `useFetchPostDetailQuery`        |
| 쿼리 키 객체     | `<entity>Keys`                           | `postKeys`                       |
| Invalidate 헬퍼  | `<entity>InvalidateQueries`              | `postInvalidateQueries`          |
| Success 핸들러   | `handle<Entity><Action>Success`          | `handlePostCreateSuccess`        |
| API 객체         | `<entity>Api`                            | `postApi`                        |
| Zod 스키마       | `<entity>Schema`, `create<Entity>Schema` | `postSchema`, `createPostSchema` |
| TS 타입          | 스키마와 동일 (PascalCase)               | `Post`, `CreatePost`             |

---

## 체크리스트: 기존 도메인에 새 기능 추가

- [ ] `_common/model/<entity>.schema.ts` — Zod 스키마 + 타입 추가
- [ ] `_common/api/<entity>.api.ts` — API 함수 추가
- [ ] `_common/api/<entity>.keys.ts` — 쿼리 키, invalidation, success handler 추가
- [ ] `_common/api/<entity>.queries.ts` — React Query 훅 추가
- [ ] `src/shared/config/texts.ts` — 새 TEXTS 키 추가 (success/error/warning 메시지)
- [ ] `src/shared/config/api.ts` — 새 API_ENDPOINTS 추가
- [ ] `domains/<domain>/features/<feature-name>/hooks/use<FeatureName>.ts` — 비즈니스 로직
- [ ] `domains/<domain>/features/<feature-name>/ui/<FeatureName>.tsx` — 얇은 UI
- [ ] `src/pages/<domain>/` 페이지에 연결

## 체크리스트: 새 도메인 추가

- [ ] 위 "새 기능 추가" 체크리스트 전부
- [ ] `src/domains/<domain>/_common/` 디렉토리 구조 생성
- [ ] `src/shared/config/route-paths.ts` — 라우트 상수 추가
- [ ] `src/app/routes/index.tsx` — 라우트 등록
- [ ] `src/pages/<domain>/` — 페이지 파일 생성

---

## Mutation/Query Meta 옵션

| 키                    | 타입      | 효과                                                    |
| --------------------- | --------- | ------------------------------------------------------- |
| `successMessage`      | `string`  | 자동으로 Sonner 성공 토스트 표시                        |
| `errorMessage`        | `string`  | 기본 대신 커스텀 Sonner 에러 토스트 표시                |
| `manualErrorHandling` | `boolean` | 전역 에러 토스트 억제 (form 필드에 에러 매핑할 때 사용) |

---

## 개발 커맨드

```bash
pnpm dev            # 개발 서버 (port 31119, localhost 모드)
pnpm build          # TypeScript 컴파일 + Vite 빌드
pnpm lint           # ESLint 검사
pnpm lint:fix       # ESLint 자동 수정
pnpm format         # Prettier 포맷
pnpm type-check     # tsc --noEmit
pnpm storybook      # Storybook (port 6006)
```

---

## 슬래시 커맨드 (`.claude/commands/`)

| 커맨드            | 사용법                            | 역할                   |
| ----------------- | --------------------------------- | ---------------------- |
| `/new-domain`     | `/new-domain notification`        | 도메인 전체 구조 생성  |
| `/new-feature`    | `/new-feature post pin-post`      | feature hook + UI 생성 |
| `/add-entity-api` | `/add-entity-api post tag`        | 3-layer API 파일 생성  |
| `/add-schema`     | `/add-schema member address`      | Zod 스키마 파일 생성   |
| `/fix-bug`        | `/fix-bug 삭제 후 목록 갱신 안됨` | 버그 분석 + 수정       |
| `/code-review`    | `/code-review`                    | 아키텍처 준수 리뷰     |
