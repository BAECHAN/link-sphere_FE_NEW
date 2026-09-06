# Link-Sphere FE — Architecture & Pattern Guide

> **문서 성격**: 레퍼런스 — "지금 무엇으로, 왜 이렇게 구성되어 있는가"
>
> **대상 독자**: 이 레포 FE 코드를 처음 보거나, 새 도메인·기능을 추가하기 전에 구조를 확인하려는 개발자
>
> **읽고 나면**: 이 아키텍처가 정식 FSD와 어디가 같고 다른지 알고, 실제 디렉터리 구조·API 3계층
> 패턴·네이밍 컨벤션에 맞춰 코드를 작성할 수 있다.
>
> **마지막 검토**: 2026-09-06

시스템 전체 아키텍처(C4, 배포 파이프라인, FE/BE 구조)는 [SYSTEM-ARCHITECTURE.md](./SYSTEM-ARCHITECTURE.md)를
참고하세요. 기술 스택 목록은 루트 [`README.md`](../README.md#기술-스택)를 참고하세요.

---

## 1. 이 프로젝트의 아키텍처 — FSD 변형

이 프로젝트는 **Feature-Sliced Design(FSD)을 뼈대로 쓰되, FSD의 핵심 규칙 중 하나(Public
API)를 성능을 이유로 정반대로 채택**하고, 그 위에 도메인 그룹핑·3-Layer API 등 여러 패턴을
얹은 변형이다. "FSD를 그대로 쓴다"고 기대하면 두 가지에서 어긋난다 — 슬라이스는 `index.ts`
배럴로 캡슐화되지 않고(오히려 금지), 같은 레이어 안 슬라이스끼리도 자유롭게 서로를 참조한다.

### 조합된 개념

| 개념                                  | 출처                              | 이 레포에서 담당하는 것                                                                         | 대표 위치                                                     |
| ------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| FSD (Feature-Sliced Design)           | feature-sliced.design             | 레이어 6종(`app→pages→widgets→features→entities→shared`) + 하향 의존만 허용                     | `eslint.config.js:936-1070`                                   |
| 도메인 우선 슬라이스 그룹핑           | FSD의 "slice group"을 필수 규칙화 | `features/<도메인>/<액션>/`, `widgets/<도메인>/<슬라이스>/` 처럼 한 단계 더 묶음                | `features/post/create/`, `widgets/post/post-card/`            |
| 3-Layer API 분리                      | 이 레포 자체 규약                 | `*.api.ts`(순수 fetch) → `*.keys.ts`(쿼리 키+무효화) → `*.queries.ts`(React Query 훅) 3단 분리  | `entities/post/api/{post.api,post.keys,post.queries}.ts`      |
| Query Key Factory + 중앙 invalidation | TanStack Query 커뮤니티 패턴      | `<entity>Keys`·`<entity>InvalidateQueries`·`handle<Entity><Action>Success`로 캐시 무효화 캡슐화 | §5 참고                                                       |
| Container/Presentational (headless)   | 고전 React 패턴                   | `hooks/`에 폼·mutation·상태 전부, `ui/`는 JSX만                                                 | §6·§7, ESLint `custom-ui-rules/no-direct-query-import`        |
| Schema-first (Zod as SSOT)            | schema-first 설계                 | `z.infer`로 타입을 스키마에서 파생 — 런타임 검증과 타입을 한 소스로 유지                        | `entities/*/model/*.schema.ts`                                |
| Atomic Design 변형                    | atoms/molecules 개념              | `shared/ui/atoms`(shadcn 원자) / `elements`(조합) / `layouts` 3단 분류                          | `src/shared/ui/{atoms,elements,layouts}`                      |
| 횡단 관심사 중앙화                    | React Query `meta` 옵션 활용      | 토스트·401 리다이렉트·403 처리를 `mutationCache`/`queryCache` 한 곳에서 처리                    | `src/shared/lib/react-query/config/queryClient.ts`            |
| 상수 단일화                           | —                                 | 문자열·엔드포인트·라우트·에러코드를 각각 하나의 상수 객체로 관리                                | `TEXTS`, `API_ENDPOINTS`, `ROUTES_PATHS`, `SERVER_ERROR_CODE` |

### 정식 FSD와 다른 점

| FSD 규칙                                                          | 채택 여부                               | 이유 / 실태                                                                                                                                                                                                                                                                       | 강제 수단                                                                                                                                                                                                |
| ----------------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 레이어 6종 + 하향 의존만 허용                                     | ✅ 채택                                 | FSD 원칙 그대로                                                                                                                                                                                                                                                                   | ESLint `no-restricted-imports` 5블록 (`eslint.config.js:936-1070`)                                                                                                                                       |
| Public API — 슬라이스는 `index.ts` 배럴로만 외부에 노출           | ❌ **정반대로 채택** (배럴 자체를 금지) | dev 서버 부팅 15-70%·빌드 28%·콜드스타트 40% 지연이라는 성능 트레이드오프 때문에 의도적으로 뒤집음                                                                                                                                                                                | ESLint `custom-barrel-rules/no-barrel-import` (`eslint.config.js:821-867`) — 전 레이어에서 `index.ts`/`index.tsx` import 시 에러                                                                         |
| 동일 레이어 슬라이스 격리 (entities는 `@x` 표기로 교차 참조 허용) | ❌ 미채택, 미강제                       | 별도 표기 없이 상시 교차 참조 발생                                                                                                                                                                                                                                                | 없음 — `entities/post/model/post.schema.ts:105-106`이 comment·interaction 스키마를 `export *`로 재수출, `entities/interaction/api/interaction.queries.ts:4-6`이 post·comment·folder의 keys를 직접 import |
| 세그먼트는 목적 기준 명명 (`ui`/`api`/`model`/`lib`/`config`)     | ⚠️ 부분 채택                            | `hooks/`·`utils/`를 세그먼트로도 쓴다(`features/*/hooks/`, `widgets/post/post-list/utils/`) — 정식 FSD 세그먼트명은 아니지만 widgets·features 안에서는 일관되게 쓰인다. 레이어 안에서 세그먼트가 뒤섞이는 것(예: 같은 entities인데 `user`만 `hooks/`, 나머지는 `model/`)만은 금지 | `.claude/CLAUDE.md`의 "레이어별 허용 세그먼트" 표 (문서 규칙, ESLint 미강제)                                                                                                                             |
| 슬라이스 그룹 폴더 허용 (그룹 폴더 자체엔 공유 코드 금지)         | ✅ 채택                                 | 그룹 폴더(`features/post/`, `widgets/layout/` 등)에는 파일이 없고 슬라이스만 있음                                                                                                                                                                                                 | —                                                                                                                                                                                                        |

**즉 이 레포에서 실질적으로 강제되는 FSD 규칙은 "레이어 하향 의존" 하나뿐이다.** 나머지는
미채택이거나 성능상의 이유로 정반대로 뒤집혀 있다. 아래 §2가 그 강제 규칙 전체 목록이다.

### 레이어 구조

레이어 간 화살표(실선)는 ESLint로 강제된다. `entities` 슬라이스 간 화살표(점선)는 정식 FSD라면
`@x` 표기 없이는 금지되지만, 이 레포에는 격리 규칙 자체가 없어 실제로 발생한다.

```mermaid
flowchart TD
  App["app<br/>providers · routes · layouts"] --> Pages["pages<br/>post · auth · bookmark · 403 · 404 · 500"]
  Pages --> Widgets["widgets<br/>post · comment · bookmark · layout"]
  Widgets --> Features["features<br/>post · comment · auth"]
  Features --> Entities["entities<br/>post · comment · interaction · user · folder · upload"]
  Entities --> Shared["shared<br/>api · config · hooks · lib · store · types · ui · utils"]

  EPost["entities/post"] -.export *.-> EComment["entities/comment"]
  EPost -.export *.-> EInteraction["entities/interaction"]
  EFolder["entities/folder"] -.import.-> EPost
  EComment -.import.-> EPost
  EInteraction -.import.-> EPost
  EInteraction -.import.-> EFolder
  EUser["entities/user"] -.import.-> EPost
```

### 정식 FSD로 맞추려면

지금은 아래가 **미채택 상태**다. 채택 여부는 향후 판단할 문제이고, 이 문서는 무엇이 필요한지만
남긴다.

- **Public API 도입**: 각 슬라이스에 `index.ts`를 두고 외부에는 그것만 노출 — 단, 지금
  배럴을 금지한 성능 근거(dev 부팅 지연 등)가 먼저 해소돼야 한다.
- **entities 교차 참조에 `@x` 표기 도입**: `entities/post/@x/comment.ts` 같은 전용 공개 API를
  만들고, 지금처럼 서로의 `model`/`api`를 직접 import하지 않도록 한다.
- **세그먼트 명명 정리**: `hooks/`→`model/` 또는 `lib/`로, `utils/`→`lib/`로 통일.

---

## 2. ESLint가 강제하는 아키텍처 규칙

레이어 하향 의존 외에, 문서 어디에도 안 적혀 있지만 실제로 커밋을 막는 규칙들이다. 아래를
모르고 코드를 쓰면 린트에서 막힌다.

| 규칙                                             | 무엇을 막나                                                                          | 위치                       |
| ------------------------------------------------ | ------------------------------------------------------------------------------------ | -------------------------- |
| `custom-barrel-rules/no-barrel-import`           | 모든 `index.ts`/`index.tsx` import (배럴 금지)                                       | `eslint.config.js:821-867` |
| `custom-ui-rules/no-direct-query-import`         | `**/ui/**`에서 `@tanstack/react-query` 직접 import — Container/Presentational 강제   | `eslint.config.js:779-818` |
| `custom-i18n/no-hardcoded-hangul`                | 한글 UI 문자열 하드코딩 — `TEXTS`만 허용                                             | `eslint.config.js:876-934` |
| `custom-import/no-sonner-toast-direct-import`    | `sonner` 직접 import — `@/shared/lib/toast/toast` 경유 강제                          | `eslint.config.js:408`     |
| `custom-import/no-relative-import-except-styles` | 상대 경로 import(`../`) 금지, `.styles.ts` 파일만 예외                               | `eslint.config.js:407`     |
| `no-restricted-syntax` (Zustand)                 | 컴포넌트/훅 내부에서 스토어 `getState()` 직접 호출 금지 — 셀렉터 훅 사용 강제        | `eslint.config.js:731-777` |
| 파일명 규칙                                      | `*.api.ts`·`*.queries.ts`·`*.schema.ts`·`config/`·`utils/` 등 세그먼트별 파일명 패턴 | `eslint.config.js:656-719` |

---

## 3. Directory Structure

```
src/
├── main.tsx                     # 앱 진입점
│
├── app/                          # 앱 초기화, providers, routing
│   ├── providers/                # AuthProvider, QueryProvider, RouterProvider, ThemeProvider
│   ├── routes/                   # 라우트 설정, ProtectedRoute, RouteErrorBoundary
│   │   └── layouts/              # AppShellLayout, ProtectedLayout, PublicLayout, RootLayout
│   └── layouts/
│       └── app-layout/           # AppLayout
│
├── pages/                        # 라우팅 진입점 — widgets/features 조합. 세그먼트 없음
│   ├── post/                     # index(PostListPage), PostDetailPage, PostEditPage, PostSubmitPage
│   ├── auth/                     # LoginPage, SignUpPage
│   ├── bookmark/                 # BookmarkPage
│   ├── 403/                      # ForbiddenPage
│   ├── 404/                      # NotFoundPage
│   └── 500/                      # ServerErrorPage
│
├── widgets/                      # 복합 UI 블록 — 도메인 그룹 → 슬라이스
│   ├── post/
│   │   ├── post-list/
│   │   │   ├── hooks/            # usePostList
│   │   │   ├── ui/               # PostList, PostListSearch, PostCardSkeleton
│   │   │   └── utils/            # search-parser
│   │   └── post-card/
│   │       ├── hooks/            # usePostCard
│   │       └── ui/               # PostCard
│   ├── comment/
│   │   └── comment-list/
│   │       └── ui/               # CommentList, CommentItem
│   ├── bookmark/
│   │   ├── bookmark-post-list/ui/  # BookmarkPostList
│   │   ├── bookmark-search/ui/     # BookmarkSearch
│   │   └── folder-tree/ui/         # FolderTree, MobileFolderList
│   └── layout/
│       ├── navbar/
│       │   ├── hooks/            # useRecentSearches
│       │   └── ui/               # Navbar, NavbarSearch, MobileNavbarSearch, RecentSearchPanel
│       ├── bottom-tab-bar/ui/
│       ├── sidebar/ui/
│       └── mypage/ui/            # MyPageModal
│
├── features/                     # 사용자 상호작용 — 도메인 그룹 → 액션 슬라이스
│   ├── post/
│   │   ├── create/{hooks,ui}     # useCreatePost, CreatePostForm, BookmarkFolderPicker
│   │   ├── update/{hooks,ui}     # useUpdatePost, UpdatePostForm
│   │   ├── delete/hooks          # usePostDelete
│   │   ├── like/{hooks,ui}       # useLikePost, LikePostButton
│   │   └── bookmark/{hooks,ui}   # useBookmarkFolders, BookmarkPostButton, FolderSelector
│   ├── comment/
│   │   ├── create/{hooks,ui}     # useCreateComment, CommentForm, MobileCommentBar
│   │   ├── update/{hooks,ui}     # useUpdateComment, CommentEditForm
│   │   ├── delete/hooks          # useDeleteComment
│   │   └── like/{hooks,ui}       # useLikeComment, LikeCommentButton
│   └── auth/
│       ├── login/{hooks,ui}      # useLogin, LoginForm, LoginModal
│       ├── signup/{hooks,ui}     # useSignUp, useAvailabilityCheck, SignUpForm
│       └── profile/{hooks,ui}    # useUpdateProfile, UpdateProfileForm
│
├── entities/                     # 비즈니스 엔티티 — data layer + basic display
│   ├── post/
│   │   ├── api/                  # post.api.ts, post.keys.ts, post.queries.ts
│   │   ├── model/                # post.schema.ts (comment·interaction 스키마 re-export 포함)
│   │   └── config/                # const.ts (POST_PAGE_SIZE)
│   ├── comment/
│   │   ├── api/                  # comment.api.ts, comment.keys.ts, comment.queries.ts
│   │   ├── model/                # comment.schema.ts
│   │   └── config/                # const.ts (MAX_COMMENT_CONTENT_BYTES)
│   ├── interaction/
│   │   ├── api/                  # interaction.api.ts, interaction.queries.ts (keys.ts 없음 — post/comment/folder keys 직접 사용)
│   │   └── model/                # interaction.schema.ts
│   ├── folder/
│   │   ├── api/                  # folder.api.ts, folder.keys.ts, folder.queries.ts
│   │   ├── model/                # folder.schema.ts, useRecentFolders.ts
│   │   └── ui/                   # FolderPickerDialog
│   ├── upload/
│   │   └── api/                  # upload.api.ts
│   └── user/
│       ├── api/                  # auth.api.ts, auth.keys.ts, auth.queries.ts
│       ├── model/                # useAuth, useAccount, useAppInitialization, useAuthGuard, useProtectedNavigate
│       └── ui/                   # UserAvatar
│
└── shared/                       # 순수 유틸, UI 원자, API client, config
    ├── api/
    │   ├── client.ts             # HTTP 클라이언트 (apiClient) — fetch 기반, axios 아님
    │   └── common.{api,keys,queries,schema}.ts
    ├── config/
    │   ├── texts.ts               # 모든 UI 문자열 (TEXTS)
    │   ├── api.ts                 # 모든 API 엔드포인트 (API_ENDPOINTS)
    │   ├── route-paths.ts         # 라우트 경로 상수 (ROUTES_PATHS)
    │   ├── nav-items.ts
    │   ├── storage-keys.ts
    │   ├── const.ts
    │   └── error-code.ts          # SERVER_ERROR_CODE
    ├── hooks/                     # 재사용 훅 19개 (useToggle, useDebounce, useIntersectionObserver, usePullToRefresh 등)
    ├── lib/
    │   ├── react-query/config/queryClient.ts   # 중앙 QueryClient 인스턴스
    │   ├── toast/toast.ts         # sonner 래퍼 (직접 import 금지, 이걸 통해서만 사용)
    │   ├── firebase/, image/, content/, react-table/, router/
    │   └── tailwind/utils.ts      # cn() helper
    ├── store/                     # auth, hideBots, loginModal, mypage, sidebar, unsavedChanges (.store.ts)
    ├── types/
    │   ├── common.type.ts
    │   └── auth.type.ts
    ├── ui/
    │   ├── atoms/                 # CVA 기반 Shadcn 기본 컴포넌트
    │   ├── elements/              # 조합 컴포넌트 (MarkdownContent 포함)
    │   │   ├── form/
    │   │   └── modal/{alert,image-viewer}/
    │   └── layouts/                # AuthLayout, ErrorLayout
    └── utils/                     # auth, date, file, form, storage, url, common, error (.util.ts)
```

레이어에 속하지 않는 최상위 디렉터리도 있다 — `src/mocks/`(MSW `handlers/`·`fixtures/`),
`src/test/`(Vitest `setup.ts`·`utils.tsx`), `src/types/`(전역 타입 선언).

---

## 4. 현재 Entities & Widgets

| Entity        | 위치                    | 설명                            |
| ------------- | ----------------------- | ------------------------------- |
| `post`        | `entities/post/`        | 포스트 CRUD + 쿼리              |
| `comment`     | `entities/comment/`     | 댓글 CRUD + 쿼리                |
| `interaction` | `entities/interaction/` | like/bookmark optimistic update |
| `folder`      | `entities/folder/`      | 북마크 폴더 CRUD + 쿼리         |
| `upload`      | `entities/upload/`      | 이미지 업로드                   |
| `user`        | `entities/user/`        | 인증 API + 훅 + UserAvatar      |

| Widget               | 위치                                   | 설명                                          |
| -------------------- | -------------------------------------- | --------------------------------------------- |
| `post-list`          | `widgets/post/post-list/`              | 포스트 목록 (무한스크롤 + 검색)               |
| `post-card`          | `widgets/post/post-card/`              | 포스트 카드 (모든 액션: like, bookmark, 관리) |
| `comment-list`       | `widgets/comment/comment-list/`        | 댓글 목록 (댓글 아이템 + 생성 폼)             |
| `navbar`             | `widgets/layout/navbar/`               | 네비게이션 바                                 |
| `bottom-tab-bar`     | `widgets/layout/bottom-tab-bar/`       | 모바일 하단 탭바                              |
| `sidebar`            | `widgets/layout/sidebar/`              | 사이드바                                      |
| `mypage`             | `widgets/layout/mypage/`               | 마이페이지 모달                               |
| `bookmark-post-list` | `widgets/bookmark/bookmark-post-list/` | 북마크 포스트 목록                            |
| `bookmark-search`    | `widgets/bookmark/bookmark-search/`    | 북마크 내 검색                                |
| `folder-tree`        | `widgets/bookmark/folder-tree/`        | 폴더 트리 / 모바일 폴더 목록                  |

---

## 5. 3-Layer API 패턴

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

> 예외: `entities/interaction/`은 `keys.ts`가 없다 — 자체 캐시 키를 갖지 않고
> `entities/{post,comment,folder}/api/*.keys.ts`의 키·invalidation을 직접 가져다 쓴다
> (`interaction.queries.ts:4-6`). §1 "정식 FSD와 다른 점"의 entities 교차 참조 사례이기도 하다.

---

## 6. Feature Hook 패턴

feature hook = 모든 비즈니스 로직. UI 파일은 훅을 호출하고 JSX만 렌더링.

```typescript
// features/<도메인>/<액션>/hooks/use<FeatureName>.ts
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

## 7. UI Component 패턴 (얇은 레이어)

```typescript
// features/<도메인>/<액션>/ui/<FeatureName>Form.tsx
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

## 8. Zod Schema 패턴

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

## 9. Delete with Confirm 패턴

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

## 10. Optimistic Update 패턴

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

## 11. React Query 설정

`src/shared/lib/react-query/config/queryClient.ts`

| 설정       | 값                         |
| ---------- | -------------------------- |
| Stale Time | 3분 (`3 * 60 * 1000`)      |
| GC Time    | 5분 (`5 * 60 * 1000`)      |
| Retry      | 실패 시 1회 재시도         |
| Refetch    | 윈도우 포커스 및 마운트 시 |

---

## 12. 에러 핸들링 전략

### 전역 에러 핸들링

전역 에러 핸들러는 `queryClient.ts` 내의 `mutationCache`와 `queryCache`에 정의:

- **401 (`NOT_LOGGED_IN` / `INVALID_TOKEN`)**: `AuthUtil.clearAll()` 후 `/auth/login`으로
  리다이렉트 + 로그인 필요 토스트. 단, 로그아웃 처리 중(`AuthUtil.isLoggingOut()`)의 401은
  세션 만료가 아니라 `clearQueries`로 인한 배경 재요청 레이스이므로 무시한다
- **403 (`ACCESS_DENIED`)**: 접근 거부 토스트만 표시
- **그 외 `ApiError`**: 콘솔에 상세 로깅 + 사용자에게는 일반적인 "서버 에러" 토스트
- **알 수 없는 에러**: 콘솔에 로깅 + 일반적인 에러 토스트

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

## 13. Toast 알림 (Sonner)

Sonner를 직접 import하지 않는다 — ESLint `custom-import/no-sonner-toast-direct-import`가
막는다. 항상 래퍼 `@/shared/lib/toast/toast`의 `toast`를 사용한다 (성공/액션 확인은
하단, 오류/경고는 상단으로 위치를 분리해서 정책을 캡슐화하고 있다).

- **에러**: 전역 에러 핸들러가 자동으로 트리거
- **성공**: `meta.successMessage` 추가 시 자동 트리거

---

## 14. Mutation/Query Meta 옵션

| 키                    | 타입      | 효과                                                    |
| --------------------- | --------- | ------------------------------------------------------- |
| `successMessage`      | `string`  | 자동으로 성공 토스트 표시                               |
| `errorMessage`        | `string`  | 기본 대신 커스텀 에러 토스트 표시                       |
| `manualErrorHandling` | `boolean` | 전역 에러 토스트 억제 (form 필드에 에러 매핑할 때 사용) |

---

## 15. Form 컴포넌트 구조

`src/shared/ui/elements/form/`

| 컴포넌트               | 용도                                                       |
| ---------------------- | ---------------------------------------------------------- |
| `FormField` (`_base/`) | 레이블, 설명, 에러 메시지 관리 (모든 form 컴포넌트의 기반) |
| `FormInput`            | 일반 텍스트 입력 필드                                      |
| `FormInputPassword`    | 비밀번호 입력 필드 (토글 표시)                             |
| `FormCheckbox`         | 단일 체크박스                                              |
| `FormCheckboxGroup`    | 체크박스 그룹                                              |

---

## 16. 핵심 설정 파일 위치

| 목적               | 파일                                                | export          |
| ------------------ | --------------------------------------------------- | --------------- |
| 모든 UI 문자열     | `src/shared/config/texts.ts`                        | `TEXTS`         |
| API 엔드포인트     | `src/shared/config/api.ts`                          | `API_ENDPOINTS` |
| 라우트 경로        | `src/shared/config/route-paths.ts`                  | `ROUTES_PATHS`  |
| HTTP 클라이언트    | `src/shared/api/client.ts`                          | `apiClient`     |
| QueryClient        | `src/shared/lib/react-query/config/queryClient.ts`  | `queryClient`   |
| Toast 래퍼         | `src/shared/lib/toast/toast.ts`                     | `toast`         |
| Alert/Confirm 모달 | `src/shared/ui/elements/modal/alert/alert.store.ts` | `useAlert`      |
| Auth 스토어        | `src/shared/store/auth.store.ts`                    | `useAuthStore`  |

---

## 17. 네이밍 컨벤션

| 항목             | 규칙                                     | 예시                             |
| ---------------- | ---------------------------------------- | -------------------------------- |
| Feature 디렉토리 | `<도메인>/<액션>` kebab-case             | `post/create/`                   |
| Widget 디렉토리  | `<도메인>/<슬라이스>` kebab-case         | `post/post-card/`                |
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
pnpm type-check     # TypeScript 타입 검사 (tsc -b --noEmit)
pnpm lint           # ESLint 검사 (--max-warnings 0)
pnpm lint:fix       # ESLint 자동 수정
pnpm format         # Prettier 포맷
pnpm format:check   # Prettier 검사만
pnpm check          # type-check + lint + format:check 일괄
pnpm check:fix      # lint:fix + format + type-check
pnpm test           # Vitest 테스트 실행 (CI)
pnpm test:watch     # Vitest 테스트 감시 모드
pnpm test:coverage  # 커버리지 리포트
pnpm storybook      # Storybook (port 6006)
```

---

## 19. 클릭 가능한 요소와 커서 규칙

`src/app/globals.css`의 `@layer base`에서 전역으로 처리한다 — 개별 컴포넌트에
`cursor-pointer`를 직접 붙이지 않는다. 배경은 `docs/DECISIONS.md`의 2026-09-03
항목 참고.

### 자동으로 pointer가 붙는 대상

| 분류       | 대상                                                                                                              |
| ---------- | ----------------------------------------------------------------------------------------------------------------- |
| 태그       | `button`, `summary`, `select`, `input[type=checkbox\|radio\|file]`                                                |
| ARIA role  | `button`, `link`, `menuitem`, `menuitemcheckbox`, `menuitemradio`, `option`, `tab`, `switch`, `checkbox`, `radio` |
| 형제 label | `[role=checkbox]`/`[role=radio]` 바로 뒤의 `label` (예: `FormCheckbox`, `FormCheckboxGroup`)                      |

`:disabled` / `aria-disabled="true"` / `[data-disabled]`는 제외된다 — 비활성 버튼·메뉴
항목은 그대로 `default` 커서를 유지한다.

### 새 컴포넌트를 만들 때

1. `Button`(`shared/ui/atoms/button.tsx`) 또는 raw `<button>`을 쓴다 → 아무것도 안 해도 pointer가 붙는다.
2. Radix 프리미티브를 새로 감쌀 때는 그 프리미티브가 `button`이나 위 role을 렌더링하는지
   확인한다(Radix 소스에서 확인 가능) → 대부분 자동으로 커버된다.
3. 불가피하게 `div`/`span`에 `onClick`을 달아야 하면 `role="button"`을 반드시 함께
   지정한다. ESLint `custom-a11y/clickable-needs-interactive-element`(`eslint.config.js`)가
   이를 강제한다 — `role`도 `aria-hidden="true"`도 없이 `onClick`만 달면 린트가 막는다.
4. 클릭이 아니라 포인터 오버로 발생하는 어포던스(예: `SelectScrollUpButton`/
   `SelectScrollDownButton`의 자동 스크롤)는 대상이 아니다 — `cursor-default`를 유지한다.

### shadcn 컴포넌트 재생성 시 주의

`dropdown-menu.tsx`(`SubTrigger`/`Item`/`CheckboxItem`/`RadioItem`)와 `select.tsx`
(`SelectItem`)는 shadcn 기본값(`cursor-default`)을 의도적으로 제거해뒀다. shadcn
CLI로 이 컴포넌트를 다시 생성하면 `cursor-default`가 되돌아오므로, 재생성 후 해당
클래스를 다시 지워야 한다.

---

## 20. 체크리스트: 기존 엔티티에 새 기능 추가

- [ ] `entities/<entity>/model/<entity>.schema.ts` — Zod 스키마 + 타입 추가/확인
- [ ] `entities/<entity>/api/<entity>.api.ts` — API 함수 추가
- [ ] `entities/<entity>/api/<entity>.keys.ts` — 쿼리 키, invalidation, success handler 추가
- [ ] `entities/<entity>/api/<entity>.queries.ts` — React Query 훅 추가
- [ ] `src/shared/config/texts.ts` — 새 TEXTS 키 추가 (success/error/warning 메시지)
- [ ] `src/shared/config/api.ts` — 새 API_ENDPOINTS 추가
- [ ] `features/<도메인>/<액션>/hooks/use<FeatureName>.ts` — 비즈니스 로직
- [ ] `features/<도메인>/<액션>/ui/<FeatureName>.tsx` — 얇은 UI
- [ ] `src/pages/<page>/` 페이지에 연결

## 21. 체크리스트: 새 Entity/Widget 추가

- [ ] 위 "새 기능 추가" 체크리스트 전부
- [ ] `src/entities/<entity>/` 디렉토리 구조 생성 (api/, model/)
- [ ] 복합 UI가 필요하면 `src/widgets/<도메인>/<슬라이스>/` 생성 (hooks/, ui/)
- [ ] `src/shared/config/route-paths.ts` — 라우트 상수 추가
- [ ] `src/app/routes/index.tsx` — 라우트 등록
- [ ] `src/pages/<page>/` — 페이지 파일 생성
- [ ] ESLint 레이어 경계 확인 (상위 레이어 import 없는지)
