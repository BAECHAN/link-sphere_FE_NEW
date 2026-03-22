# Link-Sphere FE — Claude Code Guide

---

## Critical Rules

- **Never** native `confirm()` → 항상 `useAlert` + `openConfirm` 사용
- **Never** API 레이어 건너뛰기 → API 호출은 반드시 `.api.ts` 에서만
- **Never** 인라인 쿼리 키 → 항상 `<entity>Keys.*` 사용
- **Never** 인라인 문자열 → 항상 `TEXTS.*` 사용
- **Never** 하드코딩 색상 (`text-red-500`, `bg-green-500` 등) → 항상 `globals.css` 디자인 토큰 기반 Tailwind 클래스 사용 (`text-destructive`, `bg-success`, `text-warning` 등)
- **Never** 인라인 API 경로 → 항상 `API_ENDPOINTS.*` 사용
- **Never** feature hook에서 직접 `queryClient.invalidateQueries` → 항상 `.keys.ts` success handlers 사용
- **Never** 하위 레이어에서 상위 레이어 import → ESLint 강제 (레이어 방향 위반)
- **Never** 날짜 처리에 `new Date()` / `.getTime()` 직접 사용 → 항상 `dayjs` 사용 (`dayjs(value).valueOf()`, `dayjs().format()` 등)

---

## 변경 범위 원칙

- **요청된 것만 수정** — 명시적으로 요청받지 않은 파일, 함수, 타입은 건드리지 않는다
- **기존 함수 시그니처 변경 금지** — 인자 추가/제거/변경, 반환 타입 변경은 명시적 요청 없이 불가
- **새 기능은 새 코드로** — 기존 함수/훅 확장보다 새 hook/util을 별도 작성
- **수정 전 읽기** — 파일을 수정하기 전 반드시 현재 내용을 읽고 기존 동작 파악
- **레이어 계약 유지** — entities 레이어 hook의 인터페이스를 features 요구에 맞춰 바꾸지 않는다
  → features 레이어에서 해결 방법을 찾는다

---

## 작업 후 검증

모든 코드 수정 후 반드시 순서대로 실행:

1. `npm run type-check` — TypeScript 컴파일 에러 확인 (필수)
2. `npm run test` — 관련 테스트 실행 (테스트 파일이 존재하는 경우)
3. `npm run lint` — ESLint 레이어 경계 위반 확인 (import 변경 시)

에러가 있으면 진행 전 반드시 수정.

---

## React Query 라이프사이클 주의

| 위치                          | 실행 조건                           | 용도                                      |
| ----------------------------- | ----------------------------------- | ----------------------------------------- |
| `mutate(vars, { onSuccess })` | 컴포넌트 **마운트 상태**에서만 실행 | 컴포넌트 내부 상태 업데이트               |
| `useMutation({ onSuccess })`  | 컴포넌트 언마운트 후에도 실행       | toast, cache invalidation, 전역 부수 효과 |

**navigate() 후 toast/side-effect 필요한 경우**:

- `useMutation({ onSuccess })` 레벨에서 처리 (entities 레이어 또는 hook 초기화 시점)
- `mutate(vars, { onSuccess })` 에 넣으면 navigate 후 컴포넌트 unmount로 실행 안 됨

---

## Architecture — FSD (Feature-Sliced Design)

레이어 의존 방향: `app → pages → widgets → features → entities → shared`
도메인 그룹핑: `features/<domain>/<slice>/`, `widgets/<domain>/<slice>/`

```
src/
├── app/                          # 앱 초기화, providers, routing, layouts
│   ├── providers/                # RouterProvider, ThemeProvider, AuthProvider, QueryProvider
│   ├── routes/                   # index.tsx, ProtectedRoute.tsx, layouts/
│   └── layouts/
│       ├── app-layout/           # AppLayout.tsx
│       ├── auth-layout/
│       └── error-layout/
│
├── pages/                        # 라우팅 진입점 — widgets/features만 조합
│   ├── post/                     # PostSubmitPage, PostDetailPage, PostEditPage
│   ├── auth/                     # LoginPage, SignUpPage
│   ├── mypage/
│   ├── 403/ 404/ 500/
│   └── index.tsx
│
├── widgets/                      # 복합 UI 블록 — 도메인 그룹핑
│   ├── post/
│   │   ├── post-list/            # hooks/usePostList.ts, ui/, utils/search-parser.ts
│   │   └── post-card/            # hooks/usePostCard.ts, ui/PostCard.tsx
│   ├── comment/
│   │   └── comment-list/         # ui/CommentList.tsx, ui/CommentItem.tsx
│   └── layout/
│       └── navbar/               # ui/Navbar.tsx, NavbarSearch.tsx, MobileNavbarSearch.tsx
│
├── features/                     # mutation + trigger UI — 도메인 그룹핑
│   ├── post/
│   │   ├── create/               # hooks/useCreatePost.ts, ui/CreatePostForm.tsx
│   │   ├── update/               # hooks/useUpdatePost.ts, ui/UpdatePostForm.tsx
│   │   ├── delete/               # hooks/useDeletePost.ts (UI 없음)
│   │   ├── like/                 # hooks/useLikePost.ts, ui/LikePostButton.tsx
│   │   └── bookmark/             # hooks/useBookmarkPost.ts, ui/BookmarkPostButton.tsx
│   ├── comment/
│   │   ├── create/               # hooks/useCreateComment.ts, ui/CommentForm.tsx
│   │   ├── update/               # hooks/useUpdateComment.ts, ui/CommentEditForm.tsx
│   │   ├── delete/               # hooks/useDeleteComment.ts (UI 없음)
│   │   └── like/                 # hooks/useLikeComment.ts, ui/LikeCommentButton.tsx
│   └── auth/
│       ├── login/                # hooks/useLogin.ts, ui/LoginForm.tsx
│       └── signup/               # hooks/useSignUp.ts, ui/SignUpForm.tsx
│
├── entities/                     # data layer + basic display UI
│   ├── post/
│   │   ├── api/                  # post.api.ts, post.keys.ts, post.queries.ts
│   │   ├── model/                # post.schema.ts (+ test)
│   │   └── config/               # const.ts
│   ├── comment/
│   │   ├── api/                  # comment.api.ts, comment.keys.ts, comment.queries.ts
│   │   └── model/                # comment.schema.ts
│   ├── interaction/
│   │   ├── api/                  # interaction.api.ts, interaction.queries.ts
│   │   └── model/                # interaction.schema.ts (canonical)
│   └── user/
│       ├── api/                  # auth.api.ts, auth.keys.ts, auth.queries.ts
│       ├── hooks/                # useAuth.ts, useAccount.ts, useAppInitialization.ts
│       └── ui/                   # UserAvatar.tsx
│
├── shared/                       # 순수 유틸, UI atoms, API client, config
│   ├── api/                      # client.ts, common.schema.ts, common.keys.ts
│   ├── config/                   # texts.ts (TEXTS), api.ts (API_ENDPOINTS), route-paths.ts, const.ts
│   ├── hooks/                    # useToggle, useDebounce, useIntersectionObserver, useIsMobile, ...
│   ├── lib/
│   │   ├── firebase/             # firebase.ts, fcm.ts
│   │   ├── react-query/config/   # queryClient.ts
│   │   └── tailwind/             # utils.ts (cn)
│   ├── store/                    # auth.store.ts (useAuthStore)
│   ├── types/                    # common.type.ts, auth.type.ts
│   ├── ui/
│   │   ├── atoms/                # Button, Input, Card, Badge, Select, Checkbox, Avatar, Dialog, ...
│   │   ├── elements/
│   │   │   ├── form/             # FormInput, FormInputPassword, FormCheckbox, FormCheckboxGroup
│   │   │   │   └── _base/        # FormField.tsx
│   │   │   ├── modal/alert/      # Alert.tsx, alert.store.ts (useAlert)
│   │   │   ├── ActionButton.tsx
│   │   │   ├── AsyncBoundary.tsx
│   │   │   ├── MarkdownContent.tsx
│   │   │   ├── PostCreationLoadingBadge.tsx
│   │   │   ├── SearchInput.tsx
│   │   │   ├── ScrollToTop.tsx
│   │   │   ├── SpinnerOverlay.tsx
│   │   │   └── TooltipWrapper.tsx
│   │   └── layouts/              # AuthLayout.tsx, ErrorLayout.tsx
│   └── utils/                    # auth.util, common.util, date.util, file.util, form.util, storage.util
│
├── mocks/
│   ├── handlers/                 # MSW handler 파일들
│   ├── fixtures/                 # 테스트 픽스처 (auth, post, comment)
│   └── server.ts
└── test/
    ├── setup.ts                  # MSW 글로벌 셋업
    └── utils.tsx                 # renderWithProviders(), createTestQueryClient()
```

---

## 3-Layer API 패턴

**절대로 레이어를 건너뛰거나 합치지 않는다.**

### Layer 1 — `<entity>.api.ts` (순수 async, React 의존 없음)

```typescript
// entities/<entity>/api/<entity>.api.ts
import { apiClient } from '@/shared/api/client';
import { API_ENDPOINTS } from '@/shared/config/api';

export const entityApi = {
  createEntity: async (payload: CreateEntity): Promise<Entity> =>
    apiClient.post<Entity>(API_ENDPOINTS.entity.base, payload),

  fetchEntityList: async (): Promise<Entity[]> =>
    apiClient.get<Entity[]>(API_ENDPOINTS.entity.base),

  fetchEntity: async (id: string): Promise<Entity> =>
    apiClient.get<Entity>(`${API_ENDPOINTS.entity.base}/${id}`),

  updateEntity: async (id: string, payload: UpdateEntity): Promise<Entity> =>
    apiClient.patch<Entity>(`${API_ENDPOINTS.entity.base}/${id}`, payload),

  deleteEntity: async (id: string): Promise<void> =>
    apiClient.delete<void>(`${API_ENDPOINTS.entity.base}/${id}`),
};
```

### Layer 2 — `<entity>.keys.ts` (쿼리 키 + invalidation + success handlers)

```typescript
// entities/<entity>/api/<entity>.keys.ts
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

export const handleEntityCreateSuccess = () => entityInvalidateQueries.list();
export const handleEntityUpdateSuccess = (id: Entity['id']) => {
  entityInvalidateQueries.detail(id);
  entityInvalidateQueries.list();
};
export const handleEntityDeleteSuccess = () => entityInvalidateQueries.list();
```

### Layer 3 — `<entity>.queries.ts` (얇은 React Query 래퍼)

```typescript
// entities/<entity>/api/<entity>.queries.ts
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

feature hook = 모든 비즈니스 로직. UI 파일은 훅 호출 + JSX 렌더링만.

```typescript
// features/<domain>/<slice>/hooks/use<SliceName>.ts
export function useCreatePost() {
  const navigate = useNavigate();
  const { mutateAsync: createPost, isPending: isCreating } = useCreatePostMutation();

  const form = useForm<CreatePost>({
    resolver: zodResolver(createPostSchema),
    defaultValues: { title: '', url: '' },
    mode: 'onChange',
  });

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      await createPost(data, {
        onSuccess: () => {
          form.reset();
          navigate(ROUTES_PATHS.POST.ROOT);
        },
      });
    } catch (error) {
      console.error(error);
    }
  });

  return { form, onSubmit, isCreating };
}
```

```typescript
// features/<domain>/<slice>/ui/<SliceName>Form.tsx
export function CreatePostForm() {
  const { form, onSubmit, isCreating } = useCreatePost();
  const canSubmit = form.formState.isDirty && form.formState.isValid && !isCreating;

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate>
        <FormInput name="url" label={TEXTS.labels.url} required disabled={isCreating} />
        <Button type="submit" disabled={!canSubmit}>
          {isCreating ? TEXTS.buttons.submitting : TEXTS.buttons.submit}
        </Button>
      </form>
    </FormProvider>
  );
}
```

---

## Widget Hook 패턴

widget hook = 여러 entity query 조합 + UI 블록 특화 파생 상태. 뮤테이션 로직은 포함하지 않는다.

```typescript
// widgets/<domain>/<widget>/hooks/use<Widget>.ts
export function usePostList(filter: PostFilter) {
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } =
    usePostListQuery(filter);

  const posts = data?.pages.flatMap((page) => page.content) ?? [];
  const isEmpty = !isLoading && posts.length === 0;

  return { posts, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, isEmpty };
}
```

widget hook이 **불필요한 경우**: entity query 1개 + trivial 파생만이면 컴포넌트에서 직접 사용한다.

---

## Zod Schema 패턴

```typescript
// entities/<entity>/model/<entity>.schema.ts
export const entitySchema = z.object({
  id: z.string(),
  title: z.string().min(1, TEXTS.validation.titleRequired),
  content: z.string().nullable(), // nullable: null 허용, undefined 불가
  image: z.string().optional(), // optional: undefined 허용, null 불가
  createdAt: z.coerce.date(), // 날짜는 z.coerce.date() 사용
  updatedAt: z.coerce.date(),
});

// Form 입력 스키마 (서버 응답 스키마와 별도)
export const createEntitySchema = z.object({ title: z.string().min(1) });
export const updateEntitySchema = z.object({ title: z.string().min(1) });

export type Entity = z.infer<typeof entitySchema>;
export type CreateEntity = z.infer<typeof createEntitySchema>;
export type UpdateEntity = z.infer<typeof updateEntitySchema>;
```

---

## Delete with Confirm 패턴

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

참조: `src/entities/interaction/api/interaction.queries.ts`

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

목록(InfiniteData)까지 함께 업데이트:

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

## 에러 핸들링 전략

### 전역 자동 처리 (queryClient)

- `ApiError` → 콘솔 로깅 + 에러 토스트 자동 표시
- mutation `meta.successMessage` → 성공 토스트 자동 표시
- mutation `meta.errorMessage` → 커스텀 에러 토스트

### 수동 처리 (`manualErrorHandling`)

form 필드에 서버 오류 매핑 시 전역 핸들러 우회:

```typescript
useMutation({
  mutationFn: someApiFunction,
  meta: { manualErrorHandling: true },
  onError: (error) => {
    if (error instanceof ApiError && error.status === 409) {
      form.setError('email', { message: TEXTS.messages.error.duplicateEmail });
    }
  },
});
```

---

## React Query 설정

`src/shared/lib/react-query/config/queryClient.ts`

| 설정       | 값                     |
| ---------- | ---------------------- |
| Stale Time | 3분 (`3 * 60 * 1000`)  |
| GC Time    | 5분 (`5 * 60 * 1000`)  |
| Retry      | 실패 시 1회            |
| Refetch    | 윈도우 포커스 + 마운트 |

---

## 핵심 설정 파일

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

## TEXTS 구조 (`src/shared/config/texts.ts`)

모든 UI 문자열은 `TEXTS.*`로 참조. 새 문자열 추가 시 반드시 `texts.ts`에 먼저 키를 추가한 뒤 사용.

```
TEXTS
├── pages.home / pages.post.ROOT / pages.post.SUBMIT
├── labels.nickname / email / password / message
├── placeholders.nickname / email / password / message / postSearch
├── buttons.retry / refresh / home / back / login / logout / delete / search / ...
├── auth.login.* / auth.signup.*
├── nav.brand / feed / submit / logIn / logOut / toggleSearch / toggleTheme / saving
├── post.form.create.* (title, description1/2, urlLabel, urlPlaceholder, titleLabel, ...)
├── post.form.update.* (title, description, titleLabel, titlePlaceholder, updating, update, ...)
├── post.card.* (anonymous, visitWebsite, aiSummary, edit, saving, ...)
├── post.detail.* (notFound, back, heading, commentsHeading)
├── comment.list.* (loadError, heading, empty)
├── comment.form.* (replyPlaceholder, commentPlaceholder, preview, cancel, submitting, ...)
├── descriptions.passwordGuide
├── validation.urlFormat / urlRequired / titleRequired / passwordRegex / emailRegex / ...
├── messages.info.noData / noPosts
├── messages.warning.postDeleteConfirm / commentDeleteConfirm / memberDeleteConfirm
├── messages.success.postCreated / postUpdated / postDeleted / linkCopied / accountCreated
├── messages.error.defaultError / loginFailed / postCreateFailed / linkCopyFailed / ...
├── shortcuts.sidebarToggle / sidebarToggleMac
└── ariaLabels.* (레이아웃, 헤더, 사이드바, 입력 필드 등)
```

---

## 디자인 토큰 (`src/app/globals.css`)

Tailwind v4 CSS 변수 기반 테마. **하드코딩 색상 클래스 사용 금지** — 아래 의미론적 클래스를 사용한다.

### 주요 색상 토큰 → Tailwind 클래스

| 의미        | CSS 변수        | Tailwind 클래스                             | 사용 예              |
| ----------- | --------------- | ------------------------------------------- | -------------------- |
| 기본 배경   | `--background`  | `bg-background`                             | 페이지 배경          |
| 기본 텍스트 | `--foreground`  | `text-foreground`                           | 본문 텍스트          |
| 카드        | `--card`        | `bg-card`, `text-card-foreground`           | Card 컴포넌트        |
| 기본 강조   | `--primary`     | `bg-primary`, `text-primary-foreground`     | 주요 버튼, CTA       |
| 보조        | `--secondary`   | `bg-secondary`, `text-secondary-foreground` | 보조 버튼            |
| 음소거      | `--muted`       | `bg-muted`, `text-muted-foreground`         | 비활성 텍스트, 힌트  |
| 강조        | `--accent`      | `bg-accent`, `text-accent-foreground`       | 호버, 선택 상태      |
| 파괴적 액션 | `--destructive` | `text-destructive`, `bg-destructive`        | 삭제 버튼, 에러 상태 |
| 성공        | `--success`     | `text-success`, `bg-success`                | 완료, 성공 상태      |
| 경고        | `--warning`     | `text-warning`, `bg-warning`                | 주의 상태            |
| 정보        | `--info`        | `text-info`, `bg-info`                      | 안내, 정보 배지      |
| 카테고리    | `--category`    | `bg-category`, `text-category-foreground`   | 카테고리 배지        |
| 테두리      | `--border`      | `border-border`                             | 구분선               |
| 입력        | `--input`       | `border-input`                              | 입력 필드 테두리     |
| 링          | `--ring`        | `ring-ring`                                 | 포커스 링            |

### 반경 토큰

| 토큰          | 클래스       | 값                          |
| ------------- | ------------ | --------------------------- |
| `--radius-sm` | `rounded-sm` | `calc(var(--radius) - 4px)` |
| `--radius-md` | `rounded-md` | `calc(var(--radius) - 2px)` |
| `--radius-lg` | `rounded-lg` | `var(--radius)`             |
| `--radius-xl` | `rounded-xl` | `calc(var(--radius) + 4px)` |

### 다크 모드

- 모든 토큰은 `.dark` 클래스에서 자동 override — 별도 `dark:` prefix 불필요
- ThemeProvider가 `<html>`에 `.dark` 클래스를 토글

### 폰트

- 기본 폰트: `Pretendard` (가변 폰트, woff2-variations)
- Tailwind: `font-sans` → Pretendard > Inter > sans-serif

---

## 네이밍 컨벤션

| 항목             | 규칙                                     | 예시                                     |
| ---------------- | ---------------------------------------- | ---------------------------------------- |
| Feature 디렉토리 | `<domain>/<slice>` kebab-case            | `post/create/`, `comment/like/`          |
| Widget 디렉토리  | `<domain>/<widget>` kebab-case           | `post/post-list/`, `layout/navbar/`      |
| Entity 디렉토리  | `<entity>/` (단수형)                     | `post/`, `comment/`, `user/`             |
| 컴포넌트 파일    | PascalCase.tsx                           | `CreatePostForm.tsx`, `PostCard.tsx`     |
| Feature 훅       | `use<SliceName>.ts`                      | `useCreatePost.ts`, `useLikeComment.ts`  |
| Widget 훅        | `use<WidgetName>.ts`                     | `usePostList.ts`, `usePostCard.ts`       |
| Mutation 훅      | `use<Action><Entity>Mutation`            | `useCreatePostMutation`                  |
| Query 훅         | `useFetch<Entity>Query` / `use<Entity>s` | `useFetchPostDetailQuery`, `useComments` |
| 쿼리 키 객체     | `<entity>Keys`                           | `postKeys`, `commentKeys`                |
| Invalidate 헬퍼  | `<entity>InvalidateQueries`              | `postInvalidateQueries`                  |
| Success 핸들러   | `handle<Entity><Action>Success`          | `handlePostCreateSuccess`                |
| API 객체         | `<entity>Api`                            | `postApi`, `commentApi`                  |
| Zod 스키마       | `<entity>Schema`, `create<Entity>Schema` | `postSchema`, `createPostSchema`         |
| TS 타입          | 스키마와 동일 (PascalCase)               | `Post`, `CreatePost`, `Comment`          |

---

## Form 컴포넌트

`src/shared/ui/elements/form/`

| 컴포넌트             | 용도                                              |
| -------------------- | ------------------------------------------------- |
| `FormField` (\_base) | 레이블, 설명, 에러 메시지 관리 (모든 form의 기반) |
| `FormInput`          | 일반 텍스트 입력                                  |
| `FormInputPassword`  | 비밀번호 입력 (표시 토글)                         |
| `FormCheckbox`       | 단일 체크박스                                     |
| `FormCheckboxGroup`  | 체크박스 그룹                                     |

**사용 패턴**: `FormProvider`로 감싸고 `name` prop으로 react-hook-form 필드에 연결.

---

## 테스트 환경

| 항목          | 내용                                                                      |
| ------------- | ------------------------------------------------------------------------- |
| 테스트 러너   | Vitest 4.0.18 + jsdom                                                     |
| 글로벌 셋업   | `src/test/setup.ts` (MSW, jsdom stubs, toast mock)                        |
| 커스텀 render | `src/test/utils.tsx` → `renderWithProviders()`, `createTestQueryClient()` |
| MSW           | `src/mocks/server.ts` + `handlers/` + `fixtures/`                         |
| API URL 전략  | `.env.test`에 `VITE_API_BASE_URL=http://localhost` → MSW 인터셉트         |
| 강제 실행     | `.husky/pre-push` + GitHub Actions `deploy.yml`                           |

```bash
pnpm test            # 1회 실행 (CI / pre-push)
pnpm test:watch      # 감시 모드 (TDD)
pnpm test:coverage   # 커버리지 → coverage/index.html
```

---

## 개발 커맨드

```bash
pnpm dev              # 개발 서버 (port 31119, /api → BE 51119 프록시)
pnpm build            # TypeScript 컴파일 + Vite 빌드
pnpm type-check       # tsc --noEmit
pnpm lint             # ESLint 검사
pnpm lint:fix         # ESLint 자동 수정
pnpm format           # Prettier 포맷
pnpm check            # 타입 + 린트 + 포맷 일괄 검사
pnpm check:fix        # 린트·포맷 자동 수정 후 타입 검사
pnpm storybook        # Storybook (port 6006)
```

---

## 체크리스트: 기존 엔티티에 새 기능 추가

- [ ] `entities/<entity>/model/<entity>.schema.ts` — Zod 스키마 + 타입 확인/추가
- [ ] `entities/<entity>/api/<entity>.api.ts` — API 함수 추가
- [ ] `entities/<entity>/api/<entity>.keys.ts` — 쿼리 키, invalidation, success handler 추가
- [ ] `entities/<entity>/api/<entity>.queries.ts` — React Query 훅 추가
- [ ] `src/shared/config/texts.ts` — TEXTS 키 추가 (success/error/warning 메시지)
- [ ] `src/shared/config/api.ts` — API_ENDPOINTS 추가
- [ ] `features/<domain>/<slice>/hooks/use<Slice>.ts` — 비즈니스 로직
- [ ] `features/<domain>/<slice>/ui/<Slice>.tsx` — 얇은 UI (필요 시)
- [ ] `src/pages/<page>/` 페이지에 연결

## 체크리스트: 새 도메인 추가

- [ ] 위 "새 기능 추가" 체크리스트 전부
- [ ] `entities/<entity>/` 디렉토리 구조 생성 (api/, model/)
- [ ] `features/<domain>/` 슬라이스 디렉토리 생성
- [ ] `widgets/<domain>/` 복합 UI 필요 시 생성
- [ ] `src/shared/config/route-paths.ts` — 라우트 상수 추가
- [ ] `src/app/routes/index.tsx` — 라우트 등록
- [ ] `src/pages/<domain>/` — 페이지 파일 생성

---

## 슬래시 커맨드 (`.claude/commands/`)

| 커맨드            | 사용법                            | 역할                        |
| ----------------- | --------------------------------- | --------------------------- |
| `/new-domain`     | `/new-domain notification`        | entity + features 전체 생성 |
| `/new-feature`    | `/new-feature post pin-post`      | feature hook + UI 생성      |
| `/add-entity-api` | `/add-entity-api post tag`        | 3-layer API 파일 생성       |
| `/add-schema`     | `/add-schema member address`      | Zod 스키마 파일 생성        |
| `/fix-bug`        | `/fix-bug 삭제 후 목록 갱신 안됨` | 버그 분석 + 수정            |
| `/code-review`    | `/code-review`                    | 아키텍처 준수 리뷰          |
