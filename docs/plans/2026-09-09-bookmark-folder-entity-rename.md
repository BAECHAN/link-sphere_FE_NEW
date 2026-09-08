# entities/bookmark/folder 전체 export를 BookmarkFolder로 개명

> 이전 계획(폴더 배열 `folders`→`folderList` 통일 + 죽은 코드 정리)은 PR #44로
> 완료·머지됨. 사용자가 "features 레이어는 이미 다 BookmarkFolder를 쓰는데 entities
> 레이어만 계속 Folder다, 왜 그대로 두냐"고 지적한 새 요청을 다루는 계획으로 이
> 파일을 덮어쓴다.

## Context

`features/bookmark/toggle/`·`features/post/create/`는 이미 `useBookmarkFolders`,
`BookmarkFoldersResponse`, `PostCardBookmarkFolderModal`, `PostCreateBookmarkFolderField`
등 전부 "BookmarkFolder" 접두사를 쓰는데, 정작 그 밑단인
`entities/bookmark/folder/`는 `Folder` 타입·`folderApi`·`FolderSelectModal`·
`useFolderSelect`·`FolderUtil`·`folderKeys` 등 약 40개 export 전부가 접두사 없이
"Folder"만 쓴다 — 레이어 사이 네이밍이 실제로 안 맞는다.

사용자에게 "entities 안 식별자를 어디까지 BookmarkFolder로 바꿀지"(전체 export
vs 핵심 타입만) 물었고 **전체 export(권장)**로 확정했다. 파일명은 그대로 두기로
했으나, 조사 중 **예외 2개**를 발견해 바로잡는다: `FolderSelectModal.tsx`·
`useFolderSelect.ts`는 `folder.api.ts` 같은 `<entity>.<역할>.ts` 파일이 아니라
"파일명 = export되는 컴포넌트/훅 이름"이라는 이 레포의 다른 컨벤션을 따른다 —
바로 전전 PR(#43)에서 `FolderPickerModal.tsx`→`FolderSelectModal.tsx`로 export명이
바뀔 때 파일명도 같이 바꾼 전례가 이미 있다. 이번에 export만 바꾸고 파일명을 안
바꾸면 파일명과 그 안의 export명이 어긋나는 새 불일치가 생기므로, 이 2개 파일만
`BookmarkFolderSelectModal.tsx`/`useBookmarkFolderSelect.ts`로 함께 바꾼다.
`folder.api.ts`·`folder.keys.ts`·`folder.queries.ts`·`folder.schema.ts`·
`folder.const.ts`·`folder.util.ts` 6개는 그대로 둔다(그룹 폴더 규칙 — 파일 접두사는
디렉터리 세그먼트명 "folder"를 따르지 export명을 안 따름).

전수 조사(fresh Explore subagent 2개, 실측) 결과 확정한 예외 규칙 3가지:

1. **이미 "Bookmark"가 붙어 있는 이름은 그대로 둔다** — `useAddBookmarkFolderMutation`,
   `useRemoveBookmarkFolderMutation`, `useClearBookmarkFoldersMutation`,
   `BookmarkFoldersResponse`, `bookmarkFoldersResponseSchema`,
   `handleBookmarkFolderChangeSuccess`, `folderApi`/`folderMutationKeys` 안의
   `addBookmarkFolder`/`removeBookmarkFolder`/`clearBookmarkFolders` 멤버(컨테이너만
   바뀜). 기계적으로 다시 붙이면 `BookmarkBookmarkFolder` 중복이 생긴다.
2. **BE 응답 JSON 키와 매핑된 스키마 필드명은 그대로 둔다** — `folderListResponseSchema`의
   `folders` 필드, `reorderFoldersSchema`/`bookmarkFoldersResponseSchema`의 `folderIds`
   필드. 이름은 export(타입)만 바뀌고, 필드 자체를 바꾸면 실제 API 응답 파싱이
   깨진다. 같은 이유로 **쿼리 키 런타임 문자열**(`folder.keys.ts`의
   `rootKey = ['folder']`, `folderMutationKeys`의 `'addBookmarkFolder'` 등 문자열
   값)도 바꾸지 않는다 — TS 식별자명만 바꾸고 값은 그대로 둔다(이 문자열을 캐시
   키로 하드코딩 비교하는 `entities/user/api/auth.keys.test.ts:23`가 깨지지 않게
   하기 위함이기도 하다).
3. **`entities/bookmark/folder/` 밖(features·widgets·pages)은 건드리지 않는다** —
   `widgets/bookmark/folder-tree/`의 `FolderTree`·`useFolderActions`·
   `useFolderSections` 같은 이름은 그대로 두고, 그 안에서 entities로부터
   import하는 타입·훅 이름과 이를 사용하는 타입 annotation만 새 이름으로 갱신한다.
   내부(비-export) 헬퍼 함수·로컬 변수·파라미터명(`folderId`, `folderKey`, `folder`,
   `folderList`, `folderIds`)도 바꾸지 않는다 — 단, 훅/컴포넌트와 1:1로 짝지어진
   비-export `Props`/`Params` 인터페이스(`UseFolderSelectParams`,
   `FolderSelectModalProps`)는 PR #43에서도 이미 같은 방식으로 처리했으므로 짝
   맞춰 함께 바꾼다.
4. **SCREAMING_SNAKE_CASE 상수는 대문자로 삽입** — `RECENT_FOLDER_COUNT` →
   `RECENT_BOOKMARK_FOLDER_COUNT`, `MIN_FOLDER_COUNT_TO_SHOW_RECENT` →
   `MIN_BOOKMARK_FOLDER_COUNT_TO_SHOW_RECENT`.
5. **참고만(이번에 처리 안 함)**: `useReorderFoldersMutation`/`folderApi.reorderFolders`/
   `reorderFoldersSchema`/`ReorderFoldersRequest` 전체 체인이 레포 어디서도(UI
   포함) 실사용되지 않는 게 이번 조사로 드러났다 — 재정렬 UI가 아직 없는 상태로
   API 레이어만 먼저 만들어진 것으로 보인다. 이름은 이번 규칙대로 바꾸지만,
   삭제는 이번 요청 범위(네이밍) 밖이라 하지 않는다.
6. **`FolderUtil.pickRecentFolders` 정적 메서드명은 그대로 둔다** — 클래스 자체가
   `BookmarkFolderUtil`로 바뀌면 `BookmarkFolderUtil.pickRecentFolders(...)`로 이미
   맥락이 분명해져 메서드명까지 다시 접두사를 붙일 필요가 없다.

## 결정 완료 — 개명 매핑 전체 (약 40개)

### `model/folder.schema.ts`

| 기존                                                        | 신규                               |
| ----------------------------------------------------------- | ---------------------------------- |
| `folderSchema`                                              | `bookmarkFolderSchema`             |
| `folderListSchema`                                          | `bookmarkFolderListSchema`         |
| `folderListResponseSchema`                                  | `bookmarkFolderListResponseSchema` |
| `createFolderSchema`                                        | `createBookmarkFolderSchema`       |
| `updateFolderSchema`                                        | `updateBookmarkFolderSchema`       |
| `reorderFoldersSchema`                                      | `reorderBookmarkFoldersSchema`     |
| `folderSortEnum`                                            | `bookmarkFolderSortEnum`           |
| `FolderKey`                                                 | `BookmarkFolderKey`                |
| `Folder`                                                    | `BookmarkFolder`                   |
| `FolderListResponse`                                        | `BookmarkFolderListResponse`       |
| `CreateFolderRequest`                                       | `CreateBookmarkFolderRequest`      |
| `UpdateFolderRequest`                                       | `UpdateBookmarkFolderRequest`      |
| `ReorderFoldersRequest`                                     | `ReorderBookmarkFoldersRequest`    |
| `FolderSort`                                                | `BookmarkFolderSort`               |
| `bookmarkFoldersResponseSchema` / `BookmarkFoldersResponse` | (변경 없음)                        |
| 스키마 내부 필드 `folders`/`folderIds`                      | (변경 없음 — BE 매핑)              |

### `api/folder.api.ts`

`folderApi` → `bookmarkFolderApi`. 멤버: `fetchFolderList`→`fetchBookmarkFolderList`,
`createFolder`→`createBookmarkFolder`, `updateFolder`→`updateBookmarkFolder`,
`deleteFolder`→`deleteBookmarkFolder`, `reorderFolders`→`reorderBookmarkFolders`,
`fetchFolderPosts`→`fetchBookmarkFolderPosts`. `addBookmarkFolder`/
`removeBookmarkFolder`/`clearBookmarkFolders`는 변경 없음.

### `api/folder.keys.ts`

`folderMutationKeys`→`bookmarkFolderMutationKeys`, `folderKeys`→`bookmarkFolderKeys`,
`folderInvalidateQueries`→`bookmarkFolderInvalidateQueries`,
`handleFolderCreateSuccess`→`handleBookmarkFolderCreateSuccess`,
`handleFolderUpdateSuccess`→`handleBookmarkFolderUpdateSuccess`,
`handleFolderDeleteSuccess`→`handleBookmarkFolderDeleteSuccess`,
`handleFolderReorderSuccess`→`handleBookmarkFolderReorderSuccess`.
`handleBookmarkToggleSuccess`/`handlePostDeleteSuccess`/
`handlePostContentUpdateSuccess`/`handleBookmarkFolderChangeSuccess`는 이름에
"Folder"가 없거나 이미 Bookmark가 붙어 있어 변경 없음(단, 이 파일을 cross-entity로
import하는 `post.queries.ts`·`interaction.queries.ts`는 그대로 이 이름들을 계속
가져다 쓴다 — import 구문 자체는 안 바뀜).

### `api/folder.queries.ts`

`useFolderListQuery`→`useBookmarkFolderListQuery`,
`useFolderPostsInfiniteQuery`→`useBookmarkFolderPostsInfiniteQuery`,
`prefetchFolderPosts`→`prefetchBookmarkFolderPosts`,
`useCreateFolderMutation`→`useCreateBookmarkFolderMutation`,
`useUpdateFolderMutation`→`useUpdateBookmarkFolderMutation`,
`useDeleteFolderMutation`→`useDeleteBookmarkFolderMutation`,
`useReorderFoldersMutation`→`useReorderBookmarkFoldersMutation`.
`useAddBookmarkFolderMutation`/`useRemoveBookmarkFolderMutation`/
`useClearBookmarkFoldersMutation`는 변경 없음. 비-export 내부 헬퍼(`resolveCurrentBookmarkState`,
`patchPostBookmarkCaches`, `removePostFromFolderPostsCache`, `cancelBookmarkFolderQueries`,
`rollbackBookmarkFolderMutation`, `PostBookmarkPatch`, `BookmarkFolderMutationContext`,
지역변수 `previousFolderList` 등)는 손대지 않는다.

### `config/folder.const.ts`

`RECENT_FOLDER_COUNT`→`RECENT_BOOKMARK_FOLDER_COUNT`,
`MIN_FOLDER_COUNT_TO_SHOW_RECENT`→`MIN_BOOKMARK_FOLDER_COUNT_TO_SHOW_RECENT`.

### `utils/folder.util.ts`

`FolderUtil`→`BookmarkFolderUtil` (static 메서드 `pickRecentFolders`명은 유지).

### `hooks/useFolderSelect.ts` → **파일명도 `useBookmarkFolderSelect.ts`로 변경**

`useFolderSelect`→`useBookmarkFolderSelect`, 비-export `UseFolderSelectParams`→
`UseBookmarkFolderSelectParams`(1:1 짝). `UNCATEGORIZED_PENDING_KEY`는 변경 없음.

### `hooks/useRecentFolders.ts`

`useRecentFolders`→`useRecentBookmarkFolders`.

### `ui/FolderSelectModal.tsx` → **파일명도 `BookmarkFolderSelectModal.tsx`로 변경**

`FolderSelectModal`→`BookmarkFolderSelectModal`, 비-export `FolderSelectModalProps`→
`BookmarkFolderSelectModalProps`(1:1 짝). 내부 로컬 컴포넌트 `FolderRow`/
`FolderRowProps`는 변경 없음(파일의 대표 export가 아님).

## 실행 계획

### 1. entities/bookmark/folder 내부 9개 파일(테스트 3개 포함) rename + 참조 갱신

`git mv`로 2개 파일 rename(`FolderSelectModal.tsx`→`BookmarkFolderSelectModal.tsx`,
`useFolderSelect.ts`→`useBookmarkFolderSelect.ts`), 위 매핑표대로 export명·내부
import 전부 치환. 파일 간 import 그래프(조사로 확정):

```
folder.api.ts     → folder.schema
folder.keys.ts    → folder.schema
folder.util.ts    → folder.schema, folder.const
folder.queries.ts → folder.api, folder.keys, folder.schema
useRecentFolders  → folder.schema, folder.util
useBookmarkFolderSelect → folder.queries, useRecentFolders, folder.schema
BookmarkFolderSelectModal → useBookmarkFolderSelect, folder.schema
```

같은 디렉터리 테스트 3개(`folder.queries.test.ts`, `useRecentFolders.test.ts`,
`folder.schema.test.ts`)도 같은 배치로 갱신.

### 2. 크로스 엔티티 참조 갱신 (최우선 — 놓치면 빌드가 깨짐)

- `entities/post/api/post.queries.ts` — `folderKeys`→`bookmarkFolderKeys`,
  `FolderListResponse`→`BookmarkFolderListResponse` (import + 본문 사용처 전부,
  `handleBookmarkToggleSuccess`/`handlePostDeleteSuccess`/`handlePostContentUpdateSuccess`
  import는 이름 안 바뀌므로 그대로)
- `entities/post/api/post.queries.test.ts` — 동일 두 이름
- `entities/interaction/api/interaction.queries.ts` — 동일 두 이름
- `entities/interaction/api/interaction.queries.test.ts` — 동일 두 이름
- `entities/user/api/auth.keys.ts` — `folderInvalidateQueries`→`bookmarkFolderInvalidateQueries`
  (런타임 문자열 `['folder','posts']`에 의존하는 `auth.keys.test.ts:23`는 위 예외
  규칙 2번대로 무영향 — 값 자체는 안 바뀜)
- `pages/post/PostDetailPage.tsx` — `folderInvalidateQueries`→`bookmarkFolderInvalidateQueries`

### 3. features·widgets·pages 소비처 — import 경로/타입 annotation만 갱신

아래 파일들은 **자기 자신의 이름은 그대로**, entities에서 가져오는 이름만 바꾼다.
(대표 패턴 1회 설명 — 각 파일 전수 목록은 조사로 이미 확보했으므로 실제 구현 시
`grep -rn "from '@/entities/bookmark/folder" src`로 재확인하며 하나씩 처리)

- `pages/bookmark/BookmarkPage.tsx` — `FolderKey`→`BookmarkFolderKey`,
  `FolderSort`→`BookmarkFolderSort`, `useFolderListQuery`→`useBookmarkFolderListQuery`
- `widgets/bookmark/bookmark-post-list/{ui/BookmarkPostList.tsx,hooks/useBookmarkPostList.ts}` —
  `FolderKey`→`BookmarkFolderKey`, `FolderSort`→`BookmarkFolderSort`,
  `useFolderPostsInfiniteQuery`→`useBookmarkFolderPostsInfiniteQuery`
- `widgets/bookmark/folder-tree/hooks/useFolderSections.ts` —
  `useFolderListQuery`→`useBookmarkFolderListQuery`,
  `useRecentFolders`→`useRecentBookmarkFolders`
- `widgets/bookmark/folder-tree/hooks/useFolderTree.ts` — `Folder`→`BookmarkFolder`,
  `FolderKey`→`BookmarkFolderKey`, `FolderSort`→`BookmarkFolderSort`,
  `useFolderListQuery`→`useBookmarkFolderListQuery`,
  `prefetchFolderPosts`→`prefetchBookmarkFolderPosts`
- `widgets/bookmark/folder-tree/hooks/useFolderActions.ts` — `Folder`→`BookmarkFolder`,
  `useUpdateFolderMutation`→`useUpdateBookmarkFolderMutation`,
  `useDeleteFolderMutation`→`useDeleteBookmarkFolderMutation`
- `widgets/bookmark/folder-tree/hooks/useCreateFolderForm.ts` —
  `useCreateFolderMutation`→`useCreateBookmarkFolderMutation`
- `widgets/bookmark/folder-tree/ui/FolderTree.tsx` — `Folder`→`BookmarkFolder`,
  `FolderKey`→`BookmarkFolderKey`, `FolderSort`→`BookmarkFolderSort`
- `widgets/bookmark/folder-tree/ui/MobileFolderList.tsx` — `Folder`→`BookmarkFolder`,
  `FolderKey`→`BookmarkFolderKey`
- `features/bookmark/toggle/ui/PostCardBookmarkFolderModal.tsx` —
  `FolderSelectModal`→`BookmarkFolderSelectModal`(import 경로도 새 파일명으로),
  JSDoc 갱신
- `features/bookmark/toggle/ui/PostCardBookmarkFolderModal.test.tsx` —
  `BookmarkFoldersResponse`(변경 없음)·`FolderListResponse`→`BookmarkFolderListResponse`,
  주석의 `FolderSelectModal` 언급
- `features/bookmark/toggle/hooks/usePostCardBookmarkFolderModal.ts` —
  `Folder`→`BookmarkFolder`
- `features/bookmark/toggle/hooks/useBookmarkFolders.ts` — JSDoc의
  `FolderSelectModal` 언급만(로직 무관)
- `features/post/create/ui/PostCreateBookmarkFolderField.tsx` —
  `FolderSelectModal`→`BookmarkFolderSelectModal`(import 경로 포함), JSDoc 갱신
- `features/post/create/ui/PostCreateBookmarkFolderField.test.tsx` —
  `FolderListResponse`→`BookmarkFolderListResponse`, 주석의 `FolderSelectModal` 언급
- `features/post/create/hooks/usePostCreateBookmarkFolderField.ts` —
  `Folder`→`BookmarkFolder`, `useFolderListQuery`→`useBookmarkFolderListQuery`,
  주석의 `FolderSelectModal` 언급
- `mocks/fixtures/folder.fixtures.ts` — `Folder`→`BookmarkFolder`,
  `FolderListResponse`→`BookmarkFolderListResponse`
- `mocks/handlers/folder.handlers.ts` — `BookmarkFoldersResponse`(변경 없음, 확인만)

### 4. 문서 갱신

- `docs/BOOKMARK.md` — 코드 지도 트리·API 시그니처·상태 모델·운영 파라미터 표 등
  전체를 새 이름으로 갱신(양이 많으므로 전체 재훑음 필요). 335·380행처럼 이미
  "(현재 X)" 각주가 달린 과거 개명 이력 문장은 원문을 유지하고 각주만
  "(현재 `BookmarkFolderSelectModal`)"로 갱신
- `docs/FE-ARCHITECTURE.md` — §3 트리(175,196,198,199행 등)의 파일 안 export명
  주석, §18 `<entity>List` 각주의 `folderList`/`FolderListResponse` 언급
- `docs/DECISIONS.md` — 과거 결정 항목 중 살아있는 "(현재 X)" 포인터가 있으면
  최신 이름으로 갱신(원문은 유지)

## 검증

```bash
node -v
pnpm type-check   # 이름 누락·불일치는 전부 여기서 잡힘 — 가장 중요한 게이트
pnpm lint
pnpm test         # 로직 무변경 — 224개 전부 통과해야 함
pnpm check:docs
pnpm format:check
```

`pnpm type-check`가 0 에러가 될 때까지 반복 — 이 규모 rename은 타입 에러가
가장 신뢰할 수 있는 누락 탐지기다. 그 다음 `grep -rn "\bFolder\b\|\bfolderApi\b\|
useFolderSelect\|FolderSelectModal\|folderKeys\b" src`로 의도치 않게 남은 옛 이름이
없는지(위 "변경 없음" 목록 제외) 최종 확인.

## 작업 방식

이전 PR들과 동일 — `EnterWorktree`로 워크트리 생성 → `cp ../../../.env . &&
pnpm install` → 작업 → 검증 → 계획 파일을 `docs/plans/2026-09-09-bookmark-folder-entity-rename.md`로
커밋 → fresh subagent로 계획 대비 구현 대조 → `git commit -- <경로...>` → push →
PR 생성(대조 결과를 "## 계획 대비 구현"로 포함) → `gh run watch`로 CI 확인 →
사용자에게 머지 확인 → 머지 → `ExitWorktree --action remove`.

이번 PR은 이전 PR들보다 변경 파일 수가 훨씬 많다(entities 9개 + 크로스 엔티티
5개 + 소비처 약 15개 + 문서 3개, 도합 30개 이상) — 로직 변경은 전혀 없지만 diff
자체는 크다는 점을 미리 밝혀둔다.
