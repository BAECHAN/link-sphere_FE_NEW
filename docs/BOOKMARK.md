# 북마크 (폴더 관리 + 폴더 내 검색) 기능

## 개요

북마크 페이지(`/bookmark`)는 저장한 링크(북마크)를 **폴더로 분류**하고, 폴더 안에서
**제목·설명·태그로 검색**하는 화면입니다. 폴더 목록·게시글 목록·검색이 한 페이지에
모여 있으며, **데스크탑과 모바일에서 레이아웃이 다르게 렌더링**됩니다.

---

## 반응형 렌더링 분기

> ⚠️ 이 페이지는 화면 폭에 따라 **완전히 다른 레이아웃**으로 그려집니다. "웹에는 있는데
> 모바일엔 없다"처럼 보이는 요소는 대부분 **분기 차이**이니 아래 표를 먼저 확인하세요.

- 감지: `useIsMobile()` (`src/shared/hooks/useIsMobile.ts`) — UA가 모바일이거나
  `matchMedia('(max-width: 768px)')`가 매치되면 `true`, resize 시 재평가.
- 라우팅은 단일 라우트(`/bookmark` → `BookmarkPage`). 별도 모바일 페이지는 없고
  `BookmarkPage`가 내부에서 3가지로 분기합니다.

| 조건                                                 | 화면                                                    | 검색창(`BookmarkSearch`) |
| ---------------------------------------------------- | ------------------------------------------------------- | ------------------------ |
| 모바일 + `folder` 파라미터 없음 (`isMobileListMode`) | `MobileFolderList` — 폴더 그리드(전체·미분류·내 폴더)   | ❌ 없음                  |
| 모바일 + `folder` 선택됨                             | 뒤로가기 헤더 + 정렬 + **검색창** + 게시글 목록         | ✅ 있음                  |
| 데스크탑                                             | `FolderTree` 사이드바 + 정렬 + **검색창** + 게시글 목록 | ✅ 있음                  |

**핵심**: 모바일은 drill-down 구조라 **폴더(전체 폴더 포함)에 진입해야 검색창이 보입니다.**
데스크탑은 사이드바+게시글이 항상 함께 보이므로 검색창이 처음부터 노출됩니다. 즉 두
플랫폼 모두 검색을 지원하며, 노출 시점만 다릅니다(현재 UX 의도).

---

## 파일 구조

```
src/
├── pages/
│   └── bookmark/
│       └── BookmarkPage.tsx              # 3분기 렌더링 + folder/sort/q URL 파라미터 wiring
├── widgets/
│   └── bookmark/
│       ├── bookmark-search/
│       │   └── BookmarkSearch.tsx        # 검색 위젯 (q URL 파라미터 자체 관리)
│       ├── bookmark-post-list/
│       │   └── BookmarkPostList.tsx      # search prop 소비 + 무한스크롤 + 빈 상태 분기
│       └── folder-tree/
│           ├── FolderTree.tsx            # 데스크탑 사이드바 (폴더 트리, 전체 행은 숫자 없음)
│           └── MobileFolderList.tsx      # 모바일 폴더 그리드 (drill-down)
│                                          # 위 둘 + FolderSelector 모두 "최근 저장한 폴더" 상단 구획 포함
├── features/
│   └── post/
│       └── bookmark/
│           ├── hooks/
│           │   └── useBookmarkFolders.ts # add/remove/clear/toggle 라우팅 (§ FolderSelector 표)
│           └── ui/
│               ├── BookmarkPostButton.tsx # 카드의 북마크 버튼 — 클릭 시 FolderSelector 오픈
│               └── FolderSelector.tsx     # 폴더 선택 모달/바텀시트 (탭=즉시 저장/제거)
│                                          # 링크 등록 폼의 BookmarkFolderPicker(§6)와 다이얼로그
│                                          # shell(SheetDialogContent)을 공유하지만 탭=지연 선택
├── entities/
│   └── folder/
│       ├── api/
│       │   ├── folder.api.ts             # 폴더 CRUD + 소속 추가/제거/전체해제 + 폴더별 게시글 API
│       │   ├── folder.queries.ts         # useFolderListQuery, mutations (낙관적 갱신 공용 헬퍼 포함)
│       │   └── folder.keys.ts            # posts(folderKey, sort, search) 쿼리 키 + cross-invalidation
│       └── model/
│           ├── folder.schema.ts          # Folder, FolderKey, FolderSort, BookmarkFoldersResponse 등
│           └── useRecentFolders.ts       # "최근 저장한 폴더" 상단 구획 선정 훅 (§5)
└── shared/
    ├── ui/elements/
    │   └── SearchInput.tsx               # 공통 검색 입력 (아이콘 + 단축키 Kbd)
    └── config/
        ├── api.ts                        # bookmark 엔드포인트
        └── texts.ts                      # placeholders.bookmarkSearch, bookmark.empty.searchNoResult 등
```

테스트: `src/mocks/fixtures/folder.fixtures.ts`, `src/mocks/handlers/folder.handlers.ts`
(폴더 목록 + 소속 3개 엔드포인트 기본 핸들러).

---

## API 엔드포인트

`src/entities/folder/api/folder.api.ts` 기준 (`API_ENDPOINTS.bookmark`, `shared/config/api.ts`).

| 메서드   | 경로                                                  | 설명                                                                           |
| -------- | ----------------------------------------------------- | ------------------------------------------------------------------------------ |
| `GET`    | `/bookmark/folders`                                   | 내 폴더 목록 (bookmarkCount·lastUsedAt 포함, sortOrder ASC)                    |
| `POST`   | `/bookmark/folders`                                   | 폴더 생성 (`sort_order = max+1`)                                               |
| `PATCH`  | `/bookmark/folders/{id}`                              | 폴더 이름 수정                                                                 |
| `DELETE` | `/bookmark/folders/{id}`                              | 폴더 삭제 (**이 폴더에만 있던** 북마크만 미분류로 — 다른 폴더에도 있으면 유지) |
| `PATCH`  | `/bookmark/folders/reorder`                           | 폴더 순서 재정렬 (`folderIds` 전체)                                            |
| `GET`    | `/bookmark/folders/{key}/posts?page&size&sort&search` | 폴더별 게시글 조회 (검색 포함)                                                 |
| `POST`   | `/bookmark/{postId}/folders/{folderId}`               | 폴더에 추가 (북마크 없으면 자동 생성)                                          |
| `DELETE` | `/bookmark/{postId}/folders/{folderId}`               | 그 폴더에서만 제거 (북마크 자체는 유지)                                        |
| `DELETE` | `/bookmark/{postId}/folders`                          | 폴더 소속 전부 해제 → 미분류                                                   |

- `folderKey`(경로의 `{key}`): `'all' | 'uncategorized' | UUID`
- `sort`: `'latest' | 'oldest' | 'title' | 'views' | 'viewed'` — `viewed`(최근 열람순)는
  개인별 열람 기록(BE `post_views` 테이블) 기준. 한 번도 안 연 글은 항상 맨 뒤
- `search`: 값이 있을 때만 쿼리에 붙습니다 (`folder.api.ts`의 `if (search) searchParams.search = search`).
- 폴더 소속 관련 3개 엔드포인트(추가/제거/전체해제)는 모두 **멱등** — 이미 그 상태여도
  200을 반환하고 404를 던지지 않습니다. 응답은 세 엔드포인트 공통으로
  `{ postId, isBookmarked, folderIds }`(`BookmarkFoldersResponse`)입니다.

---

## 주요 구현 사항

### 1. 검색 상태는 URL `q` 파라미터가 단일 소스

`BookmarkSearch`는 별도 상위 상태 없이 `useSearchParams`로 `q`를 직접 읽고 씁니다.
제출/클리어 시 `q`를 갱신하고, 뒤로가기 등으로 URL이 바뀌면 `useEffect`로 로컬 입력값을
동기화합니다. 덕분에 `<BookmarkSearch />`만 배치하면 어느 분기에서도 그대로 동작합니다.

```tsx
// widgets/bookmark/bookmark-search/BookmarkSearch.tsx
const searchQuery = searchParams.get('q') ?? '';
const [searchInput, setSearchInput] = useState(searchQuery);
useEffect(() => setSearchInput(searchQuery), [searchQuery]); // 뒤로가기 동기화

const applySearch = (value: string) => {
  const trimmed = value.trim();
  if (trimmed) searchParams.set('q', trimmed);
  else searchParams.delete('q');
  setSearchParams(searchParams, { replace: true });
};
```

`BookmarkPage`는 `q`를 읽어 목록으로 전달합니다.

```tsx
// pages/bookmark/BookmarkPage.tsx
const search = searchParams.get('q') ?? '';
...
<BookmarkSearch className="mb-4" />
<BookmarkPostList folderKey={activeFolderKey} sort={sort} search={search} />
```

### 2. 검색어의 쿼리 키 반영 (검색어별 캐시 분리)

`folder.keys.ts`의 posts 키에 `search`가 포함되어 검색어별로 캐시가 분리되고,
`useFolderPostsInfiniteQuery`가 `search`를 API로 전달합니다.

```typescript
// entities/folder/api/folder.keys.ts
posts: (folderKey: FolderKey, sort?: FolderSort, search?: string) =>
  [...rootKey, 'posts', folderKey, sort ?? 'latest', search ?? ''] as const,
```

### 3. 모바일 검색 제출 버튼

`SearchInput` 자체엔 제출 버튼이 없습니다. `BookmarkSearch`가 붙이는 제출 버튼은
`md:hidden`이라 **모바일에서만 노출**되고, 데스크탑은 Enter로 제출합니다.

```tsx
<Button type="submit" className="h-10 px-6 rounded-xl font-bold md:hidden">
  {TEXTS.buttons.search}
</Button>
```

### 4. 검색 시 빈 상태 문구 분기

`BookmarkPostList`는 `search`가 있을 때 빈 상태 문구를
`TEXTS.bookmark.empty.searchNoResult`('검색 결과가 없어요.')로 전환합니다.

### 5. "최근 저장한 폴더" 상단 구획 (split menu)

폴더 목록 순서를 고정할지 최근 사용순으로 올릴지에 대한 결론입니다. Sears &
Shneiderman의 split menu 연구를 따라 **상단에 최근 저장한 폴더 최대 3개를 별도
구획으로 보여주되, 아래 본 목록 순서는 절대 바꾸지 않습니다.** 상단 구획의 폴더도
아래 본 목록에서 빼지 않고 그대로 중복 표시합니다 — 빼면 본 목록의 나머지 위치가
흔들려 공간기억이 깨지기 때문입니다.

`entities/folder/model/useRecentFolders.ts`가 선정 로직을 담당합니다.

- **노출 조건**: 폴더 총 6개 이상 **AND** 저장 이력(`lastUsedAt` not null) 있는
  폴더 3개 이상. 둘 중 하나라도 안 되면 상단 구획 자체가 안 뜹니다.
- **고정 개수**: 정확히 3개. 임계값을 채우지 못하면 0개(미노출)만 있고 1~2개인
  중간 상태는 없습니다 — 개수가 흔들리면 아래 본 목록의 시작 위치도 흔들립니다.
- **스냅샷 시점**: `useFolderListQuery`가 로딩 중일 땐 `folders`가 빈 배열이라,
  데이터가 도착한(`isLoading`이 꺼지는) 시점에 1회만 계산해 고정합니다. 그 뒤
  `folders`가 바뀌어도(재검증, 다른 탭에서 저장 등) 다시 계산하지 않습니다.
  - `FolderSelector`(모달)는 `open`을 `sessionKey`로 넘겨 열 때마다 새로
    스냅샷을 찍습니다.
  - `FolderTree`/`MobileFolderList`(상시 마운트 화면)는 `sessionKey`를 넘기지
    않아 페이지 방문(마운트) 동안 한 번만 계산합니다.
- **`lastUsedAt`의 실제 런타임 타입에 주의**: `Folder.lastUsedAt`은 타입상
  `Date`지만, `folderApi.fetchFolderList`가 `apiClient.get<T>()`로 제네릭
  캐스팅만 할 뿐 `folderSchema`로 실제 파싱(`.parse()`)하지 않기 때문에
  런타임엔 BE가 보낸 원시 ISO 문자열 그대로 들어옵니다(`createdAt`/`updatedAt`도
  동일). `useRecentFolders`의 정렬 비교는 이 때문에 `new Date(...)`로 감싸
  문자열·Date 어느 쪽이 와도 안전하게 처리합니다 — 다른 곳에서 `folder.lastUsedAt`을
  `Date` 메서드로 직접 다룰 땐 이 갭을 기억하세요.

### 6. 링크 등록 폼의 폴더 선택 (`BookmarkFolderPicker`) — 이 페이지가 아닌 다른 화면

`src/features/post/create/ui/BookmarkFolderPicker.tsx`는 `/bookmark` 페이지가 아니라
**링크 등록 폼**(`CreatePostForm`)에 있는 필드입니다. `FolderSelector`와 행 구성·모바일
바텀시트 전환(`SheetDialogContent` 공용 컴포넌트, `FolderSelector`에서 처음 쓰인 패턴을
추출)은 동일하지만, 핵심 동작이 다릅니다.

|                  | `FolderSelector` (이 페이지)          | `BookmarkFolderPicker` (등록 폼)                    |
| ---------------- | ------------------------------------- | --------------------------------------------------- |
| 대상             | 이미 존재하는 북마크                  | 아직 만들어지지 않은 게시글                         |
| 행 탭            | 즉시 API 호출로 저장/제거 + 모달 닫힘 | 폼의 `bookmark`/`folderIds` 값만 변경, 모달 안 닫힘 |
| 확정 시점        | 탭하는 순간                           | 등록 제출(`POST /post`) 시 BE가 한 번에 처리        |
| '북마크 제거' 행 | 있음                                  | 없음 (아직 북마크가 없으므로 미분류 재탭으로 충분)  |

폼 스키마(`entities/post/model/post.schema.ts`의 `createPostSchema`)에 `bookmark: boolean`,
`folderIds: string[]` 두 필드가 있고, 등록 성공 시 `useCreatePostMutation`이 이 값을 보고
`folder.list`/`folder.postsRoot` 캐시를 조건부로 무효화합니다(`post.queries.ts`).

---

## 다중 폴더 소속 모델

북마크 하나가 **여러 폴더에 동시에 소속**될 수 있습니다(N:M). 기존(폴더 하나만 지정
가능)과 달라진 개념 3가지:

- **미분류 = 소속 폴더가 0개인 상태.** "폴더가 없는 상태"가 아니라 "폴더 중 어디에도
  속하지 않은 상태"입니다. `post.userInteractions.bookmarkFolderIds: string[]`가
  빈 배열이면 미분류입니다.
- **`전체` 행에는 숫자를 표시하지 않습니다.** 폴더별 개수 합산은 다중 소속에서
  중복 집계되어 부정확하고, 정확한 값을 내려주려면 서버 필드가 필요한데 이번엔
  숫자 자체를 안 보여주는 쪽으로 결정했습니다. 다만 **목록 자체는 중복 없이** 한
  북마크가 여러 폴더에 있어도 `전체`에는 한 번만 나옵니다(BE가 EXISTS 세미조인으로
  보장).
- **폴더에서 제거 ≠ 북마크 제거.** 소속된 폴더 중 하나에서 빼도 다른 폴더 소속이나
  북마크 자체는 그대로입니다. 마지막 폴더에서 빠지면 미분류로 남을 뿐, 북마크가
  사라지지 않습니다. 완전히 삭제하려면 `북마크 제거` 행을 따로 눌러야 합니다.

### FolderSelector 행 동작 표

`BookmarkPostButton`을 누르면 열리는 모달(`features/post/bookmark/ui/FolderSelector.tsx`)의
전체 동작입니다. 탭 = 즉시 저장/제거 + 모달 닫힘(확인 단계 없음).

| 행          | 상태                      | 탭하면                           | 토스트                                                                                                      |
| ----------- | ------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 미분류      | 북마크 아님               | 북마크 켜기 (미분류로 생성)      | `{folderName}에 저장되었습니다.` (미분류)                                                                   |
| 미분류      | 북마크 O, 소속 0개(✓)     | **아무 것도 안 함** (no-op)      | 없음                                                                                                        |
| 미분류      | 북마크 O, 소속 1개 이상   | 소속 전부 해제                   | `모든 폴더에서 제거되었습니다.`                                                                             |
| 폴더 X      | 비소속                    | 그 폴더에 추가 (자동 북마크)     | `{folderName}에 저장되었습니다.`                                                                            |
| 폴더 X      | 소속(✓), 다른 폴더도 있음 | 그 폴더에서만 제거               | `{folderName} 폴더에서 제거되었습니다.`                                                                     |
| 폴더 X      | 소속(✓), **마지막 폴더**  | 그 폴더에서만 제거 → 미분류가 됨 | `{folderName}에 저장되었습니다.` (미분류) + description "마지막 폴더에서 제거되어 미분류로 이동되었습니다." |
| 북마크 제거 | —                         | 북마크 완전 삭제 (소속도 전부)   | `북마크가 제거되었습니다.`                                                                                  |

체크된 미분류가 no-op인 이유: "미분류에서 제거"는 곧 북마크 해제인데 그건 `북마크 제거`
행과 중복되고, 오탭 한 번으로 북마크가 조용히 사라지면 안 되기 때문입니다. 소속된 모든
폴더에 **동일한 ✓ 아이콘**이 표시됩니다(다중 선택 UI가 아니라, 탭할 때마다 즉시
반영되는 토글 방식).

---

## 참고

- 날짜별 변경 로그: [HISTORY.md](./HISTORY.md) — 2026-06-28 "북마크 폴더 관리 기능 도입",
  2026-07-11 "북마크 페이지 내 검색 기능 추가".
- 모바일 내비게이션(하단 탭바) 결정 배경: [DECISIONS.md](./DECISIONS.md).
