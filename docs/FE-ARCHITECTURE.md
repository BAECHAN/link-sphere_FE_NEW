# Link-Sphere FE — Architecture & Pattern Guide

시스템 전체 아키텍처(C4, 배포 파이프라인, FE/BE 구조)는 [SYSTEM-ARCHITECTURE.md](./SYSTEM-ARCHITECTURE.md)를 참고하세요.

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

## 2. Directory Structure (FSD)

레이어 의존 방향: `app → pages → widgets → features → entities → shared`
(하위 레이어는 상위 레이어를 import할 수 없음. ESLint로 강제 적용.)

```
src/
├── app/                          # 앱 초기화, providers, routing
│   ├── providers/                # RouterProvider, ThemeProvider, AuthProvider, QueryProvider
│   ├── routes/                   # 라우트 설정, ProtectedRoute, layout wrappers
│   └── layouts/
│       └── app-layout/           # AppLayout (Navbar 포함한 앱 셸)
│
├── pages/                        # 라우팅 진입점 — widgets/features 조합
│   ├── post/                     # PostSubmitPage, PostDetailPage, PostEditPage, index(PostListPage)
│   ├── auth/                     # LoginPage, SignUpPage
│   ├── 403/                      # ForbiddenPage
│   ├── 404/                      # NotFoundPage
│   └── 500/                      # ServerErrorPage
│
├── widgets/                      # 복합 UI 블록 — features + entities 조합
│   ├── navbar/
│   │   └── ui/                   # Navbar, NavbarSearch, MobileNavbarSearch
│   ├── post-list/
│   │   ├── hooks/                # usePostList
│   │   ├── ui/                   # PostList, PostListSearch
│   │   └── utils/                # search-parser
│   ├── post-card/
│   │   ├── hooks/                # usePostCard
│   │   └── ui/                   # PostCard (PostCard 모든 액션 포함)
│   └── comment-list/
│       ├── hooks/                # useCommentList
│       └── ui/                   # CommentList, CommentItem
│
├── features/                     # 사용자 상호작용 — mutation + trigger UI
│   ├── auth-login/
│   │   ├── hooks/                # useLogin
│   │   └── ui/                   # LoginForm
│   ├── auth-signup/
│   │   ├── hooks/                # useSignUp
│   │   └── ui/                   # SignUpForm
│   ├── create-post/
│   │   ├── hooks/                # useCreatePost
│   │   └── ui/                   # CreatePostForm
│   ├── update-post/
│   │   ├── hooks/                # useUpdatePost
│   │   └── ui/                   # UpdatePostForm
│   ├── delete-post/
│   │   └── hooks/                # usePostDelete
│   ├── like-post/
│   │   ├── hooks/                # useLikePost
│   │   └── ui/                   # LikePostButton
│   ├── bookmark-post/
│   │   ├── hooks/                # useBookmarkPost
│   │   └── ui/                   # BookmarkPostButton
│   ├── create-comment/
│   │   ├── hooks/                # useCreateComment
│   │   └── ui/                   # CommentForm
│   ├── update-comment/
│   │   ├── hooks/                # useUpdateComment
│   │   └── ui/                   # CommentEditForm
│   ├── delete-comment/
│   │   └── hooks/                # useDeleteComment
│   └── like-comment/
│       ├── hooks/                # useLikeComment
│       └── ui/                   # LikeCommentButton
│
├── entities/                     # 비즈니스 엔티티 — data layer + basic display
│   ├── post/
│   │   ├── api/
│   │   │   ├── post.api.ts       # 순수 async fetch 호출
│   │   │   ├── post.keys.ts      # 쿼리 키 + invalidation helpers + success handlers
│   │   │   └── post.queries.ts   # 얇은 React Query 훅 래퍼
│   │   ├── model/
│   │   │   └── post.schema.ts    # Zod 스키마 + TypeScript 타입 (interaction/comment re-export 포함)
│   │   └── config/
│   │       └── const.ts          # POST_PAGE_SIZE 등
│   ├── comment/
│   │   ├── api/
│   │   │   ├── comment.api.ts
│   │   │   ├── comment.keys.ts
│   │   │   └── comment.queries.ts
│   │   └── model/
│   │       └── comment.schema.ts
│   ├── interaction/
│   │   ├── api/
│   │   │   ├── interaction.api.ts
│   │   │   └── interaction.queries.ts   # Optimistic updates (like, bookmark)
│   │   └── model/
│   │       └── interaction.schema.ts    # Canonical 위치
│   └── user/
│       ├── api/
│       │   ├── auth.api.ts
│       │   ├── auth.keys.ts
│       │   └── auth.queries.ts   # useLoginMutation, useLogoutMutation, useFetchAccountQuery
│       ├── hooks/
│       │   ├── useAuth.ts        # 통합 인증 관리 훅
│       │   ├── useAccount.ts
│       │   ├── useAuthInitialization.ts
│       │   └── useAppInitialization.ts
│       └── ui/
│           └── UserAvatar.tsx
│
└── shared/                       # 순수 유틸, UI 원자, API client, config
    ├── api/
    │   ├── client.ts             # HTTP 클라이언트 (apiClient)
    │   ├── common.schema.ts      # 공통 Zod 스키마 (PaginationResponse 등)
    │   ├── common.keys.ts
    │   └── common.queries.ts
    ├── config/
    │   ├── texts.ts              # 모든 UI 문자열 (TEXTS)
    │   ├── api.ts                # 모든 API 엔드포인트 (API_ENDPOINTS)
    │   ├── route-paths.ts        # 라우트 경로 상수 (ROUTES_PATHS)
    │   ├── const.ts              # 앱 전역 상수
    │   └── error-code.ts         # 에러 코드 상수
    ├── hooks/                    # 재사용 훅 (useToggle, useDebounce, useIntersectionObserver 등)
    ├── lib/
    │   ├── react-query/config/queryClient.ts   # 중앙 QueryClient 인스턴스
    │   └── tailwind/utils.ts     # cn() helper
    ├── store/
    │   └── auth.store.ts         # Zustand 인증 스토어 (useAuthStore)
    ├── types/
    │   ├── common.type.ts
    │   └── auth.type.ts
    ├── ui/
    │   ├── atoms/                # CVA 기반 Shadcn 기본 컴포넌트
    │   ├── elements/             # 조합 컴포넌트 (MarkdownContent 포함)
    │   │   ├── form/
    │   │   ├── modal/alert/      # Alert.tsx, alert.store.ts (useAlert)
    │   │   └── ...
    │   └── layouts/              # AuthLayout, ErrorLayout
    └── utils/                    # auth.util, date.util, file.util, form.util, storage.util
```

---

## 3. 현재 Entities & Features

| Entity        | 위치                    | 설명                            |
| ------------- | ----------------------- | ------------------------------- |
| `post`        | `entities/post/`        | 포스트 CRUD + 쿼리              |
| `comment`     | `entities/comment/`     | 댓글 CRUD + 쿼리                |
| `interaction` | `entities/interaction/` | like/bookmark optimistic update |
| `user`        | `entities/user/`        | 인증 API + 훅 + UserAvatar      |

| Widget         | 위치                    | 설명                                          |
| -------------- | ----------------------- | --------------------------------------------- |
| `post-list`    | `widgets/post-list/`    | 포스트 목록 (무한스크롤 + 검색)               |
| `post-card`    | `widgets/post-card/`    | 포스트 카드 (모든 액션: like, bookmark, 관리) |
| `comment-list` | `widgets/comment-list/` | 댓글 목록 (댓글 아이템 + 생성 폼)             |
| `navbar`       | `widgets/navbar/`       | 네비게이션 바                                 |

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
```

### Layer 3 — `<entity>.queries.ts` (얇은 React Query 래퍼)

```typescript
import { useMutation, useQuery } from '@tanstack/react-query';
import { entityApi } from '@/entities/<entity>/api/entity.api';
import { entityKeys, handleEntityCreateSuccess } from '@/entities/<entity>/api/entity.keys';
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
// features/<feature-name>/hooks/use<FeatureName>.ts
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
// features/<feature-name>/ui/<FeatureName>Form.tsx
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
// entities/<entity>/model/<entity>.schema.ts
export const entitySchema = z.object({
  id: z.string(),
  name: z.string().min(1, TEXTS.validation.nameRequired),
  content: z.string().nullable(), // nullable 필드는 .nullable() 사용
  createdAt: z.coerce.date(), // 날짜 필드는 z.coerce.date() 사용
});

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

참조: `src/entities/interaction/api/interaction.queries.ts` (`useLikePostMutation`)

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

---

## 10. React Query 설정

`src/shared/lib/react-query/config/queryClient.ts`

| 설정       | 값                         |
| ---------- | -------------------------- |
| Stale Time | 3분 (`3 * 60 * 1000`)      |
| GC Time    | 5분 (`5 * 60 * 1000`)      |
| Retry      | 실패 시 1회 재시도         |
| Refetch    | 윈도우 포커스 및 마운트 시 |

---

## 11. 에러 핸들링 전략

### 전역 에러 핸들링

전역 에러 핸들러는 `queryClient.ts` 내의 `mutationCache`와 `queryCache`에 정의:

- **API 에러 (`ApiError`)**: 자동으로 콘솔에 로깅 + 사용자에게 일반적인 "서버 에러" 토스트 표시
- **알 수 없는 에러**: 콘솔에 로깅 + 일반적인 에러 토스트 표시

### 수동 에러 핸들링 (`manualErrorHandling`)

```typescript
const { mutate } = useMutation({
  mutationFn: someApiFunction,
  meta: { manualErrorHandling: true },
  onError: (error) => {
    if (error instanceof ApiError && error.status === 409) {
      form.setError('email', { message: '이미 존재하는 이메일입니다' });
    }
  },
});
```

---

## 12. Toast 알림 (Sonner)

- **에러**: 전역 에러 핸들러가 자동으로 트리거
- **성공**: `meta.successMessage` 추가 시 자동 트리거

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

---

## 15. 핵심 설정 파일 위치

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

## 16. 네이밍 컨벤션

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

## 17. 개발 커맨드

```bash
npm run dev            # 개발 서버 (port 31119, localhost 모드)
npm run build          # TypeScript 컴파일 + Vite 빌드
npm run lint           # ESLint 검사
npm run lint:fix       # ESLint 자동 수정
npm run format         # Prettier 포맷
npm run test           # Vitest 테스트 실행 (CI)
npm run test:watch     # Vitest 테스트 감시 모드
npm run storybook      # Storybook (port 6006)
```

---

## 18. 체크리스트: 기존 엔티티에 새 기능 추가

- [ ] `entities/<entity>/model/<entity>.schema.ts` — Zod 스키마 + 타입 추가/확인
- [ ] `entities/<entity>/api/<entity>.api.ts` — API 함수 추가
- [ ] `entities/<entity>/api/<entity>.keys.ts` — 쿼리 키, invalidation, success handler 추가
- [ ] `entities/<entity>/api/<entity>.queries.ts` — React Query 훅 추가
- [ ] `src/shared/config/texts.ts` — 새 TEXTS 키 추가 (success/error/warning 메시지)
- [ ] `src/shared/config/api.ts` — 새 API_ENDPOINTS 추가
- [ ] `features/<feature-name>/hooks/use<FeatureName>.ts` — 비즈니스 로직
- [ ] `features/<feature-name>/ui/<FeatureName>.tsx` — 얇은 UI
- [ ] `src/pages/<page>/` 페이지에 연결

## 19. 체크리스트: 새 Entity/Widget 추가

- [ ] 위 "새 기능 추가" 체크리스트 전부
- [ ] `src/entities/<entity>/` 디렉토리 구조 생성 (api/, model/)
- [ ] 복합 UI가 필요하면 `src/widgets/<widget>/` 생성 (hooks/, ui/)
- [ ] `src/shared/config/route-paths.ts` — 라우트 상수 추가
- [ ] `src/app/routes/index.tsx` — 라우트 등록
- [ ] `src/pages/<page>/` — 페이지 파일 생성
- [ ] ESLint 레이어 경계 확인 (상위 레이어 import 없는지)
