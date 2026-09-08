# entities 폴더 선택 엔진 개명 — FolderPickerModal/useFolderPicker → FolderSelectModal/useFolderSelect

> 이전 계획(BookmarkFolderModal/Field → PostCardBookmarkFolderModal/PostCreateBookmarkFolderField
> 개명 + config 파일명 통일)은 PR #42로 완료·머지됨. 그 직후 사용자가 이어서 제기한 3가지
> 후속 검토(Picker→Select, folder.api.ts 네이밍, create/update/delete 분리) 중 실행이
> 확정된 1건(Picker→Select)을 다루는 새 계획으로 이 파일을 덮어쓴다.

## Context

PR #42 머지 직후 사용자가 3가지를 검토해달라고 요청했다.

1. `entities/bookmark/folder/ui/FolderPickerModal.tsx`(및 `hooks/useFolderPicker.ts`)의
   "Picker"를 "Select"로 바꾸는 게 낫지 않냐 — 안에 있는 props(`onSelectFolder`,
   `selectedFolderIds` 등)도 이미 "select" 어휘를 쓴다는 이유.
2. `entities/bookmark/folder/api/folder.api.ts`의 `addBookmarkFolder`/`removeBookmarkFolder`/
   `clearBookmarkFolders`도 앞서 고친 네이밍 혼동과 같은 문제 아니냐.
3. `folder.queries.ts`의 create/update/delete가 한 hook 안에 뭉쳐 있는 것처럼 보이는데
   `post`처럼 features 레이어로 분리해야 하지 않냐.

조사 결과(실측):

- **2번은 반대로 결론냈다.** `grep "BookmarkFolder"`가 entities API·키·쿼리·features를
  뒤섞어 보여주는 건 사실이지만, `post.api.ts:73 deletePost` → `usePostDelete.ts:7`의
  `mutateAsync: deletePost` 지역변수명 재사용과 동일한, 이 레포 3-Layer API 패턴 전체의
  정상 동작이었다. `folderApi`의 나머지 6개 메서드(`createFolder`, `fetchFolderList` 등)도
  같은 규칙이라 3개만 다르게 바꾸면 오히려 내부 일관성이 깨진다. **사용자도 동의해 변경
  안 함.**
- **3번도 반대로 결론냈다.** entities 레이어는 이미 `useCreateFolderMutation`/
  `useUpdateFolderMutation`/`useDeleteFolderMutation`으로 post와 동일하게 분리돼 있다.
  차이는 features 레이어에 `features/folder/`가 없다는 것뿐인데, `useFolderActions.ts`
  (`widgets/bookmark/folder-tree/hooks/`)를 직접 읽어보니 rename+delete가 **같은 행
  (FolderTree의 FolderItem·MobileFolderList의 FolderCard)에서 함께 트리거되는 인라인
  동작**이라 의도적으로 한 훅에 묶여 있었다(JSDoc: "FolderTree(FolderItem)·
  MobileFolderList(FolderCard)가 공유한다"). post의 create/update/delete는 각각 독립
  페이지·폼이라 features가 맞지만, folder는 FSD 공식 기준("여러 페이지에서 재사용돼야
  feature")으로도 지금 구조(widgets 소유)가 더 맞다. **사용자도 동의해 변경 안 함.**
- **1번은 사용자가 근거를 들은 뒤에도 Select로 개명을 원했다** — 이 계획이 다루는
  유일한 실행 항목이다.

**Select 개명에 대한 참고**(반대 근거였으나 사용자가 감수하기로 함): `Select`는 이미
`shared/ui/atoms/select.tsx`(Radix 드롭다운, `Select`/`SelectTrigger`/`SelectContent`
등 10개 export)가 쓰는 이름이다. 실사용처는 `pages/bookmark/BookmarkPage.tsx`의 정렬
드롭다운 2곳뿐이라 실질적 import 충돌은 없지만, 레포 자체가 과거에 "Selector"/"Picker"
혼용을 문제로 지목하고 "Picker"로 통일한 이력이 있다(`docs/BOOKMARK.md:366-369`).

## 결정 완료 — 개명 대상

| 파일                                                    | 새 이름                 |
| ------------------------------------------------------- | ----------------------- |
| `src/entities/bookmark/folder/ui/FolderPickerModal.tsx` | `FolderSelectModal.tsx` |
| `src/entities/bookmark/folder/hooks/useFolderPicker.ts` | `useFolderSelect.ts`    |

- `FolderPickerModal` 함수 → `FolderSelectModal`, `FolderPickerModalProps` → `FolderSelectModalProps`
- `useFolderPicker` 함수 → `useFolderSelect`, `UseFolderPickerParams` → `UseFolderSelectParams`
- `UNCATEGORIZED_PENDING_KEY`(같은 파일의 다른 export)는 Picker와 무관하므로 변경 없음

## 실행 계획

### 1. 파일 rename (`git mv`) + 내부 식별자 변경

위 표 2개 파일. export 함수명·인터페이스명도 함께 변경(위 목록대로).

### 2. import 경로 + 참조 갱신

grep으로 확인한 실제 참조 지점(전부):

- `src/features/bookmark/toggle/ui/PostCardBookmarkFolderModal.tsx:2,18,31` — import 경로 +
  JSDoc(`entities/bookmark/folder/ui/FolderPickerModal`) + JSX 태그
- `src/features/bookmark/toggle/ui/PostCardBookmarkFolderModal.test.tsx:14-15` — 주석 2곳
- `src/features/post/create/ui/PostCreateBookmarkFolderField.tsx:6,12,45` — import 경로 +
  JSDoc + JSX 태그
- `src/features/post/create/ui/PostCreateBookmarkFolderField.test.tsx:14-15` — 주석 2곳
- `src/features/post/create/hooks/usePostCreateBookmarkFolderField.ts:29` — 주석 1곳
- `src/features/bookmark/toggle/hooks/useBookmarkFolders.ts:12` — 주석 1곳
- rename되는 파일 자기 자신의 import문(`FolderSelectModal.tsx`가 `useFolderSelect`를
  import하는 줄)

### 3. 문서 갱신

**`docs/BOOKMARK.md`** (라이브 서술 — 새 이름으로 갱신):

- 64행 "사용한 도구·기술" — `Radix Dialog 기반 FolderPickerModal` → `FolderSelectModal`
- 127, 162행 — 본문 설명
- §8 코드 지도 트리(250, 265, 268, 294, 297행) — 파일명 2곳 + 주석
- 372행 — §12 용어 사전 `sessionKey` 항목의 "모달(`FolderPickerModal`)"
- 335, 380행 — 직전 개명(PostCard/PostCreate) 이력을 설명하며 `FolderPickerModal`을
  언급하는 문장. 원문은 유지(그 시점 서술로서 정확함)하고 "(현재 `FolderSelectModal`)"
  각주만 추가

**`docs/FE-ARCHITECTURE.md`** — 175, 198, 199행 트리 주석 파일명 갱신

**`docs/DECISIONS.md`** — 58행("...FolderPickerModal을 재사용할 뿐...", 2026-09-08
"결정 2" 항목 안의 사실 서술)에 "(현재 `FolderSelectModal`)" 각주 추가. 120·140행의
`FolderPickerDialog` 언급은 이보다 더 오래된 역사적 이름이라 이번 범위에서 건드리지
않는다(이미 이전 PR들에서도 그대로 유지해온 순수 역사 기록).

### 4. plan 스냅샷 + 계획 대비 구현 대조 (CLAUDE.md §11)

이 계획 파일을 `docs/plans/2026-09-08-folder-select-rename.md`로 구현 코드와 같은
PR에 커밋하고, 구현 후 fresh Explore subagent에게 계획과 diff를 대조시켜 PR 본문에
"## 계획 대비 구현" 섹션으로 남긴다(직전 PR #42와 동일 절차).

## 검증

```bash
node -v                # v24 확인
pnpm type-check
pnpm lint
pnpm test              # 관련 테스트 단언 무수정 확인 — rename 후 이름만 바뀜
pnpm check:docs
pnpm format:check
```

`git diff --stat`이 rename 2개 + import 경로/주석 수정 + 문서 갱신만 보일 것(로직
무변경).

## 작업 방식

이전 PR들과 동일 — `EnterWorktree`로 워크트리 생성 → `cp ../../../.env . &&
pnpm install` → 작업 → 검증 → `git commit -- <경로...>` → push → PR 생성 →
`gh run watch`로 CI 확인 → 사용자에게 머지 확인 → 머지 → `ExitWorktree --action remove`.
