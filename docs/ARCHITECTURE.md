# Link-Sphere FE — Architecture & Pattern Guide

## 1. Tech Stack

| 항목          | 버전/라이브러리                            |
| ------------- | ------------------------------------------ |
| Framework     | React 18 + TypeScript + Vite               |
| Server State  | TanStack Query 5 (`@tanstack/react-query`) |
| Form          | React Hook Form 7 + Zod 3                  |
| Client State  | Zustand 5                                  |
| UI Components | Shadcn/ui (Radix UI 기반)                  |
| Styling       | TailwindCSS + CVA                          |
| Toast         | Sonner                                     |
| Dev Port      | 31119                                      |

---

## 2. Directory Structure

```
src/
├── app/                          # 앱 초기화, providers, routing, layouts
│   ├── providers/                # RouterProvider, ThemeProvider, AuthProvider, QueryProvider
│   └── layouts/
│       └── navbar/               # Navbar, NavbarSearch, MobileNavbarSearch
├── domains/<domain>/
│   ├── _common/
│   │   ├── api/
│   │   │   ├── <entity>.api.ts      # 순수 async fetch 호출만 (React 의존 없음)
│   │   │   ├── <entity>.keys.ts     # 쿼리 키 + invalidation helpers + success handlers
│   │   │   └── <entity>.queries.ts  # 얇은 React Query 훅 래퍼
│   │   ├── model/
│   │   │   └── <entity>.schema.ts   # Zod 스키마 + TypeScript 타입
│   │   ├── hooks/                   # 도메인 공통 훅 (feature 비특화)
│   │   ├── config/                  # 도메인 설정 (const 등)
│   │   └── ui/                      # 도메인 공통 UI (UserAvatar, MarkdownContent 등)
│   └── features/<feature-name>/
│       ├── hooks/
│       │   └── use<FeatureName>.ts  # 비즈니스 로직 (form, mutations, state, navigation)
│       └── ui/
│           └── <FeatureName>.tsx    # 얇은 UI — 훅 호출 + JSX 렌더링만
├── shared/
│   ├── api/
│   │   ├── client.ts              # HTTP 클라이언트 (apiClient)
│   │   ├── common.schema.ts       # 공통 Zod 스키마 (PaginationResponse 등)
│   │   ├── common.keys.ts
│   │   └── common.queries.ts
│   ├── config/
│   │   ├── texts.ts               # 모든 UI 문자열 (TEXTS)
│   │   ├── api.ts                 # 모든 API 엔드포인트 (API_ENDPOINTS)
│   │   ├── route-paths.ts         # 라우트 경로 상수 (ROUTES_PATHS)
│   │   ├── const.ts               # 앱 전역 상수
│   │   └── error-code.ts          # 에러 코드 상수
│   ├── hooks/                     # 재사용 훅 (useToggle, useDebounce, useIntersectionObserver,
│   │                              #   useIsMobile, useImagePaste, useKeydown, useMinimumLoading 등)
│   ├── lib/
│   │   ├── react-query/config/queryClient.ts   # 중앙 QueryClient 인스턴스
│   │   ├── react-table/utils.ts
│   │   └── tailwind/utils.ts      # cn() helper
│   ├── store/
│   │   └── auth.store.ts          # Zustand 인증 스토어 (useAuthStore)
│   ├── types/
│   │   ├── common.type.ts
│   │   └── auth.type.ts
│   ├── ui/
│   │   ├── atoms/                 # CVA 기반 Shadcn 기본 컴포넌트
│   │   │                          # (Button, Input, Card, Badge, Select, Checkbox,
│   │   │                          #  Avatar, Dialog, DropdownMenu, Textarea, Tooltip, Kbd, Sonner 등)
│   │   ├── elements/              # 조합 컴포넌트
│   │   │   ├── form/              # FormInput, FormInputPassword, FormCheckbox, FormCheckboxGroup
│   │   │   │   └── _base/FormField.tsx
│   │   │   ├── modal/alert/       # Alert.tsx, alert.store.ts (useAlert)
│   │   │   ├── ActionButton.tsx
│   │   │   ├── AsyncBoundary.tsx
│   │   │   ├── SearchInput.tsx
│   │   │   ├── SpinnerOverlay.tsx
│   │   │   ├── TooltipWrapper.tsx
│   │   │   └── ScrollToTop.tsx
│   │   └── layouts/               # AuthLayout, ErrorLayout
│   └── utils/                     # auth.util, common.util, date.util, file.util, form.util, storage.util
└── pages/
    ├── post/                      # PostSubmitPage, PostDetailPage, PostEditPage
    ├── auth/                      # LoginPage, SignUpPage
    ├── 403/                       # ForbiddenPage
    └── 404/                       # NotFoundPage
```

---

## 3. 현재 도메인

| 도메인   | 엔티티                     | Features                                                                                                                                                            | 위치                  |
| -------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `post`   | post, comment, interaction | create-post, update-post, delete-post, post-list, post-detail, create-comment, update-comment, delete-comment, comment-list, like-post, like-comment, bookmark-post | `src/domains/post/`   |
| `auth`   | auth (login, sign-up)      | login, sign-up                                                                                                                                                      | `src/domains/auth/`   |
| `member` | member (profile)           | —                                                                                                                                                                   | `src/domains/member/` |

---

## 4. 3-Layer API 패턴

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

## 5. Feature Hook 패턴

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

## 6. UI Component 패턴 (얇은 레이어)

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

## 7. Zod Schema 패턴

```typescript
// _common/model/<entity>.schema.ts
// 도메인 모델 (서버 응답 전체)
export const entitySchema = z.object({
  id: z.string(),
  name: z.string().min(1, TEXTS.validation.nameRequired),
  content: z.string().nullable(), // nullable 필드는 .nullable() 사용
  createdAt: z.coerce.date(), // 날짜 필드는 z.coerce.date() 사용
  updatedAt: z.coerce.date(),
});

// Form 입력 스키마 (도메인 모델과 별도)
export const createEntitySchema = z.object({ name: z.string().min(1) });
export const updateEntitySchema = z.object({ name: z.string().min(1) });

export type Entity = z.infer<typeof entitySchema>;
export type CreateEntity = z.infer<typeof createEntitySchema>;
export type UpdateEntity = z.infer<typeof updateEntitySchema>;
```

---

## 8. Delete with Confirm 패턴

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

## 9. Optimistic Update 패턴

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
onSuccess: () => {},
onError: (_err, _vars, context) => {
  queryClient.setQueryData(entityKeys.detail(id), context?.previous);
},
```

목록까지 업데이트할 때:

```typescript
queryClient.setQueriesData<InfiniteData<EntityListResponse>>(
  { queryKey: entityKeys.listRoot },
  (oldData) => {
    if (!oldData) return oldData;
    return {
      ...oldData,
      pages: oldData.pages.map((page) => ({
        ...page,
        content: page.content.map((item) =>
          item.id === id ? { ...item, isLiked: !item.isLiked } : item
        ),
      })),
    };
  }
);
```

---

## 10. React Query 설정

`src/shared/lib/react-query/config/queryClient.ts`

| 설정       | 값                         |
| ---------- | -------------------------- |
| Stale Time | 3분 (`3 * 60 * 1000`)      |
| GC Time    | 5분 (`5 * 60 * 1000`)      |
| Retry      | 실패 시 1회 재시도         |
| Refetch    | 윈도우 포커스 및 마운트 시 |

전역 에러 핸들러는 `mutationCache`와 `queryCache`에 정의되어 있으며, 모든 mutation/query 에러를 자동으로 처리한다.

---

## 11. 에러 핸들링 전략

### 전역 에러 핸들링

전역 에러 핸들러는 `queryClient.ts` 내의 `mutationCache`와 `queryCache`에 정의:

- **API 에러 (`ApiError`)**: 자동으로 콘솔에 로깅 + 사용자에게 일반적인 "서버 에러" 토스트 표시
- **알 수 없는 에러**: 콘솔에 로깅 + 일반적인 에러 토스트 표시

### 수동 에러 핸들링 (`manualErrorHandling`)

form 필드에 서버 유효성 검사 에러를 매핑하는 등 맞춤 처리가 필요할 때 전역 핸들러를 우회:

```typescript
const { mutate } = useMutation({
  mutationFn: someApiFunction,
  meta: { manualErrorHandling: true }, // 전역 토스트 에러 비활성화
  onError: (error) => {
    if (error instanceof ApiError && error.status === 409) {
      form.setError('email', { message: '이미 존재하는 이메일입니다' });
    }
  },
});
```

### 커스텀 에러 메시지

전역 핸들러를 완전히 비활성화하지 않고 커스텀 메시지 제공:

```typescript
useMutation({
  mutationFn: someApiFunction,
  meta: { errorMessage: '프로필 업데이트에 실패했습니다.' },
});
```

---

## 12. Toast 알림 (Sonner)

- **에러**: 전역 에러 핸들러가 자동으로 트리거
- **성공**: `meta.successMessage` 추가 시 자동 트리거

```typescript
useMutation({
  mutationFn: updateProfile,
  meta: { successMessage: '프로필이 업데이트되었습니다!' },
});
```

---

## 13. Mutation/Query Meta 옵션

| 키                    | 타입      | 효과                                                    |
| --------------------- | --------- | ------------------------------------------------------- |
| `successMessage`      | `string`  | 자동으로 Sonner 성공 토스트 표시                        |
| `errorMessage`        | `string`  | 기본 대신 커스텀 Sonner 에러 토스트 표시                |
| `manualErrorHandling` | `boolean` | 전역 에러 토스트 억제 (form 필드에 에러 매핑할 때 사용) |

---

## 14. Form 컴포넌트 구조

`src/shared/ui/elements/form/`

| 컴포넌트               | 용도                                                       |
| ---------------------- | ---------------------------------------------------------- |
| `FormField` (`_base/`) | 레이블, 설명, 에러 메시지 관리 (모든 form 컴포넌트의 기반) |
| `FormInput`            | 일반 텍스트 입력 필드                                      |
| `FormInputPassword`    | 비밀번호 입력 필드 (토글 표시)                             |
| `FormCheckbox`         | 단일 체크박스                                              |
| `FormCheckboxGroup`    | 체크박스 그룹                                              |

**FormField props**: `label`, `description` (optional, 에러 시 대체됨), `required` (optional), `name`

**사용 패턴**: `FormProvider`로 감싸고 `name` prop으로 react-hook-form 필드에 연결.

```typescript
<FormProvider {...form}>
  <form onSubmit={onSubmit} noValidate>
    <FormInput name="title" label="제목" required disabled={isPending} />
    <FormInputPassword name="password" label="비밀번호" required />
    <Button type="submit" disabled={!isDirty || !isValid || isPending}>
      제출
    </Button>
  </form>
</FormProvider>
```

---

## 15. Auth 도메인 구조

인증 관련 로직은 `src/domains/auth/` 에 구조화되어 있습니다.

### 스키마

모든 인증 관련 스키마는 `Account` 중심으로 통일:

- **Account**: 사용자 계정 정보 (id, email, name, avatarUrl, createdAt, updatedAt)
- **Login**: 로그인 요청 스키마
- **CreateAccount**: 회원가입 요청 스키마
- **AuthTokens**: 인증 토큰 (accessToken, refreshToken)

### API 및 Query 구조

```typescript
// auth.api.ts
export const authApi = {
  login: (payload: Login) => Promise<LoginResponse>,
  createAccount: (payload: CreateAccount) => Promise<Account>,
  logout: () => Promise<void>,
  refreshToken: () => Promise<AuthTokens>,
  fetchAccount: () => Promise<Account>,
};

// auth.queries.ts
export const useLoginMutation = () => { ... }
export const useCreateAccountMutation = () => { ... }
export const useFetchAccountQuery = () => { ... }
```

### 에러 핸들링

회원가입(`useCreateAccountMutation`)은 `manualErrorHandling: true`를 사용하여 409 Conflict 에러를 특별히 처리:

```typescript
onError: (error) => {
  if (error instanceof ApiError) {
    if (error.status === 409) {
      toast.error('이미 존재하는 계정입니다');
    } else {
      toast.error('계정 생성에 실패했습니다');
    }
  }
};
```

---

## 16. 핵심 설정 파일 위치

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

## 17. 네이밍 컨벤션

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

## 18. 개발 커맨드

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

## 19. 체크리스트: 기존 도메인에 새 기능 추가

- [ ] `_common/model/<entity>.schema.ts` — Zod 스키마 + 타입 추가/확인
- [ ] `_common/api/<entity>.api.ts` — API 함수 추가
- [ ] `_common/api/<entity>.keys.ts` — 쿼리 키, invalidation, success handler 추가
- [ ] `_common/api/<entity>.queries.ts` — React Query 훅 추가
- [ ] `src/shared/config/texts.ts` — 새 TEXTS 키 추가 (success/error/warning 메시지)
- [ ] `src/shared/config/api.ts` — 새 API_ENDPOINTS 추가
- [ ] `domains/<domain>/features/<feature-name>/hooks/use<FeatureName>.ts` — 비즈니스 로직
- [ ] `domains/<domain>/features/<feature-name>/ui/<FeatureName>.tsx` — 얇은 UI
- [ ] `src/pages/<domain>/` 페이지에 연결

## 20. 체크리스트: 새 도메인 추가

- [ ] 위 "새 기능 추가" 체크리스트 전부
- [ ] `src/domains/<domain>/_common/` 디렉토리 구조 생성
- [ ] `src/shared/config/route-paths.ts` — 라우트 상수 추가
- [ ] `src/app/routes/index.tsx` — 라우트 등록
- [ ] `src/pages/<domain>/` — 페이지 파일 생성
