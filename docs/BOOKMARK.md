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
│           ├── FolderTree.tsx            # 데스크탑 사이드바 (폴더 트리)
│           └── MobileFolderList.tsx      # 모바일 폴더 그리드 (drill-down)
├── entities/
│   └── folder/
│       ├── api/
│       │   ├── folder.api.ts             # 폴더 CRUD + 폴더별 게시글(search) API
│       │   ├── folder.queries.ts         # useFolderListQuery, useFolderPostsInfiniteQuery, mutations
│       │   └── folder.keys.ts            # posts(folderKey, sort, search) 쿼리 키 + cross-invalidation
│       └── model/
│           └── folder.schema.ts          # Folder, FolderKey, FolderSort, Request 스키마
└── shared/
    ├── ui/elements/
    │   └── SearchInput.tsx               # 공통 검색 입력 (아이콘 + 단축키 Kbd)
    └── config/
        ├── api.ts                        # bookmark 엔드포인트
        └── texts.ts                      # placeholders.bookmarkSearch, bookmark.empty.searchNoResult 등
```

---

## API 엔드포인트

`src/entities/folder/api/folder.api.ts` 기준 (`API_ENDPOINTS.bookmark`, `shared/config/api.ts`).

| 메서드   | 경로                                                  | 설명                                                              |
| -------- | ----------------------------------------------------- | ----------------------------------------------------------------- |
| `GET`    | `/bookmark/folders`                                   | 내 폴더 목록 (bookmarkCount 포함, sortOrder ASC)                  |
| `POST`   | `/bookmark/folders`                                   | 폴더 생성 (`sort_order = max+1`)                                  |
| `PATCH`  | `/bookmark/folders/{id}`                              | 폴더 이름 수정                                                    |
| `DELETE` | `/bookmark/folders/{id}`                              | 폴더 삭제 (안의 북마크는 미분류로 이동 — BE `ON DELETE SET NULL`) |
| `PATCH`  | `/bookmark/folders/reorder`                           | 폴더 순서 재정렬 (`folderIds` 전체)                               |
| `GET`    | `/bookmark/folders/{key}/posts?page&size&sort&search` | 폴더별 게시글 조회 (검색 포함)                                    |
| `PATCH`  | `/bookmark/{postId}/folder`                           | 단건 북마크 폴더 이동 (`folderId=null` → 미분류)                  |

- `folderKey`(경로의 `{key}`): `'all' | 'uncategorized' | UUID`
- `sort`: `'latest' | 'oldest' | 'title' | 'views'`
- `search`: 값이 있을 때만 쿼리에 붙습니다 (`folder.api.ts`의 `if (search) searchParams.search = search`).

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

---

## 참고

- 날짜별 변경 로그: [HISTORY.md](./HISTORY.md) — 2026-06-28 "북마크 폴더 관리 기능 도입",
  2026-07-11 "북마크 페이지 내 검색 기능 추가".
- 모바일 내비게이션(하단 탭바) 결정 배경: [DECISIONS.md](./DECISIONS.md).
