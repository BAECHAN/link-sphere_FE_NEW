# 폴더 배열 네이밍 컨벤션 — `folders` → `folderList` 통일 + 죽은 코드 정리

> 이전 계획(entities 폴더 선택 엔진 Picker→Select 개명)은 PR #43으로 완료·머지됨.
> 그 직후 사용자가 제기한 새 주제(folder/folders 혼용)를 다루는 새 계획으로 이
> 파일을 덮어쓴다.

## Context

PR #43 이후 사용자가 "폴더 관련 식별자에 단수 folder와 복수 folders가 뒤섞여
있다"고 지적했고, 조사 결과 "s로만 구분하면 헷갈리니 실제로 List(배열)로 관리되는
것들을 확인해서 코드 컨벤션으로 지정하자"고 요청했다.

전수 조사(fresh Explore subagent, 실측) 결과:

- **`List`가 이미 두 가지 뜻으로 쓰이고 있었다**: (A) 진짜 배열 — `FolderList`
  타입(`Folder[]`), `folderList` 지역변수. (B) "목록 조회 API/응답 객체" —
  `FolderListResponse`(객체 `{folders, uncategorizedCount}`), `useFolderListQuery`,
  `fetchFolderList`, `folderKeys.list`. (B)는 `folder.schema.ts:22` 주석에
  "BE FolderListResponse 와 매핑"이라 적혀 있어 BE 응답 스키마 이름을 그대로
  따온 것 — 이 이름들은 건드리면 BE 계약과 어긋난다.
- **실제 인시턴시 지점**(같은 데이터, 다른 이름 — 이게 사용자가 본 혼란의 정체):
  `entities/bookmark/folder/hooks/useFolderSelect.ts`와
  `features/post/create/hooks/usePostCreateBookmarkFolderField.ts`는 `data?.folders`를
  `folderList`(`Array.isArray` 가드로 `Folder[]` 보장)라고 부르는데,
  `widgets/bookmark/folder-tree/hooks/useFolderSections.ts`·`useFolderTree.ts`와
  그걸 쓰는 `FolderTree.tsx`·`MobileFolderList.tsx`, 그리고 조사 범위 밖이던
  `pages/bookmark/BookmarkPage.tsx`까지 **완전히 같은 쿼리의 결과**를 `folders`
  (`Folder[] | undefined`, 매번 `?.` 방어 필요)라고 부른다.
- **복수형이 그대로 맞는 것들**(배열이 아니라 "여러 폴더에 대한 동작/응답/불리언"):
  `BookmarkFoldersResponse`(객체), `ReorderFoldersRequest`(객체), `useBookmarkFolders`
  (함수 3개를 묶은 훅), `wasInFolders`(boolean), `clearBookmarkFolders`(동작 이름),
  `bookmarkClearedAllFolders`(토스트 문구 키), `postFolders`(엔드포인트 문자열
  빌더) — 이들은 손대지 않는다.
- **부수 발견(사용처 0곳인 죽은 코드)**: `FolderList` 타입(`folder.schema.ts:54`,
  `Folder[]`, 레포 전체에서 이 선언 줄 하나뿐)과 `useSuspenseFolderListQuery`
  훅(`folder.queries.ts:43-48`, 호출부 없음).

## 결정 완료

1. **컨벤션**: "진짜 `Folder[]` 배열을 담는 지역변수·훅 반환 필드·구조분해값은
   `folderList`로 통일한다. BE 계약과 매핑된 이름(`FolderListResponse`,
   `useFolderListQuery`, `fetchFolderList`, `folderKeys.list`)과, 배열이 아니라
   동작·응답 객체·불리언이라 복수형이 맞는 이름은 그대로 둔다." —
   `docs/FE-ARCHITECTURE.md` §18 네이밍 컨벤션 표에 명문화한다.
2. **적용 대상**: 실제로 이 컨벤션을 어기고 있던 5개 파일의 `folders`(`Folder[] |
undefined`) 전부를 `folderList`로 변경 — `useFolderSections.ts`, `useFolderTree.ts`
   (`useFolderTree`+`useFolderChips` 둘 다), `FolderTree.tsx`(`FolderTree`+
   `FolderChips` 둘 다), `MobileFolderList.tsx`, `BookmarkPage.tsx`. 원래
   `folderList`였던 `useFolderSelect.ts`/`usePostCreateBookmarkFolderField.ts`는
   이미 맞으므로 변경 없음.
3. **죽은 코드 제거**: `FolderList` 타입, `useSuspenseFolderListQuery` 훅(+ 그 훅만
   쓰던 `useSuspenseQuery` import) 삭제.

## 실행 계획

### 1. `folders` → `folderList` 치환 (5개 파일)

- `src/widgets/bookmark/folder-tree/hooks/useFolderSections.ts:10,13,16` —
  지역변수 선언, `useRecentFolders` 인자, 반환 필드
- `src/widgets/bookmark/folder-tree/hooks/useFolderTree.ts:13,20`(`useFolderTree`
  구조분해·반환), `:87,92`(`useFolderChips` 지역변수·반환)
- `src/widgets/bookmark/folder-tree/ui/FolderTree.tsx:32`(구조분해), `:78,89`
  (`FolderTree` 컴포넌트 사용), `:108`(구조분해), `:121`(`FolderChips` 컴포넌트 사용)
- `src/widgets/bookmark/folder-tree/ui/MobileFolderList.tsx:35`(구조분해), `:80`
  (사용)
- `src/pages/bookmark/BookmarkPage.tsx:61`(지역변수 선언), `:72,103,111,118`(사용
  4곳 — `find`, `if (!folderList)`, `.some`, `useEffect` 의존성 배열)

각 파일에서 다른 이름과 충돌하지 않는지(예: 같은 스코프에 이미 `folderList`가
있는지) 치환 직후 확인한다.

### 2. 죽은 코드 제거

- `src/entities/bookmark/folder/model/folder.schema.ts:54` — `export type
FolderList = z.infer<typeof folderListSchema>;` 삭제 (`folderListSchema` 자체는
  `folderListResponseSchema`가 계속 쓰므로 유지)
- `src/entities/bookmark/folder/api/folder.queries.ts:43-48` —
  `useSuspenseFolderListQuery` 삭제, import 목록(`:1-7`)에서 `useSuspenseQuery`도
  함께 제거(다른 사용처 없음, 확인 완료)

### 3. 컨벤션 문서화

`docs/FE-ARCHITECTURE.md` §18 네이밍 컨벤션 표에 행 추가:

> `Folder[]` 배열 변수/반환값 | `<entity>List` | `folderList` (BE 계약명
> `FolderListResponse`류와 "동작/응답 객체" 성격의 복수형은 예외 — 아래 각주)

각주로 이번 조사에서 확정한 예외 기준(BE 매핑 이름, 배열 아닌 복수형)을 짧게 남긴다.

## 검증

```bash
node -v
pnpm type-check   # FolderList/useSuspenseFolderListQuery 삭제로 인한 참조 누락 확인
pnpm lint         # useSuspenseQuery 미사용 import 등
pnpm test         # 로직 무변경 — 전체 224개 그대로 통과해야 함
pnpm check:docs
pnpm format:check
```

`git diff --stat`이 5개 파일의 변수명 치환 + 2개 파일의 죽은 코드 삭제 + 문서
1곳 추가만 보일 것(동작 변경 없음 — 렌더링 결과·API 호출 동일).

## 작업 방식

이전 PR들과 동일 — `EnterWorktree`로 워크트리 생성 → `cp ../../../.env . &&
pnpm install` → 작업 → 검증 → 계획 파일을 `docs/plans/2026-09-08-folder-list-naming.md`로
커밋 → fresh subagent로 계획 대비 구현 대조 → `git commit -- <경로...>` → push →
PR 생성(대조 결과를 "## 계획 대비 구현"로 포함) → `gh run watch`로 CI 확인 →
사용자에게 머지 확인 → 머지 → `ExitWorktree --action remove`.
