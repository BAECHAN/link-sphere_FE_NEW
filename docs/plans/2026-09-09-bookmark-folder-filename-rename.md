# entities/bookmark/folder 역할 파일명을 bookmark-folder.\*로 개명

> 이전 계획(entities export 전체를 `BookmarkFolder`로 개명)은 PR #46으로 완료·머지됨.
> 사용자가 "파일명도 `bookmark-folder.api.ts` 이런 식으로 해야 하지 않나 — `folder`라고만
> 하면 나중에 다른 기능을 수행하는 folder가 생겼을 때 헷갈린다"고 지적한 새 요청을
> 다루는 계획으로 이 파일을 덮어쓴다.

## Context

### 왜 하는가

PR #46에서 `entities/bookmark/folder/`의 export 약 40개를 전부 `BookmarkFolder` 접두사로
바꿨다. 그런데 파일명 6개(`folder.api.ts`·`folder.keys.ts`·`folder.queries.ts`·
`folder.schema.ts`·`folder.const.ts`·`folder.util.ts`)는 그대로 뒀다.

당시 나는 "파일 접두사는 디렉터리 세그먼트명(`folder`)을 따르지 export명을 안 따른다"를
근거로 들었는데, **이 규칙은 문서에 존재하지 않는다**(2026-09-09 재검증). 실제 규칙은
[`docs/FE-ARCHITECTURE.md:660`](../FE-ARCHITECTURE.md)의

> `<entity>.const.ts` — `api/`·`model/`·`utils/`와 같은 `<entity>.<역할>.ts` 규칙

이고, 여기서 `<entity>`는 **엔티티명**이다. 같은 §18 표가 API 객체를 `<entity>Api`,
쿼리 키를 `<entity>Keys`로 규정하는데 이들은 이미 `bookmarkFolderApi`·`bookmarkFolderKeys`다.
즉 PR #46에서 엔티티명이 `bookmarkFolder`로 바뀐 뒤로 **이 6개 파일은 접두사가 엔티티명과
불일치하는 레포 내 유일한 역할 파일**이 됐다. 이번 변경은 새 규칙 도입이 아니라 규칙 준수
회복이다.

### 근거 검증 결과 (실측)

| 확인 항목                                             | 결과                                                                                                                                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.claude/CLAUDE.md:661-665`의 `bookmark-folder/` 금지 | **디렉터리 전용 규칙** — 섹션 제목이 "폴더 네이밍 규칙", 예시에 트레일링 슬래시, 근거가 "도메인 폴더" 행. 파일명에는 적용 안 됨                                                            |
| 역할 파일 56개 접두사                                 | 52개가 1단어이나 해당 엔티티명(`post`·`comment`·`category`·`auth`…)이 전부 1단어라서 그런 것. 복합 접두사 선례는 `.store.ts`에 4개(`hideBots`·`loginModal`·`unsavedChanges`·`imageViewer`) |
| ESLint `unicorn/filename-case`                        | `*.api.ts`·`*.queries.ts`·`*.schema.ts`·`utils/**`에 `kebabCase` 강제 → `bookmark-folder.api.ts`가 정확한 형식. `*.keys.ts`·`config/*.ts`는 미강제이나 일관성 위해 동일 형식               |
| 현재 basename 충돌                                    | `src/` 299개 중 중복 2건(`utils.ts`, `index.tsx`)뿐, 역할 파일 중복 0건. 다른 의미의 "folder" 도메인 0건                                                                                   |

즉 "지금 헷갈린다"가 아니라 **장래 대비**이며, 동시에 위 규칙 불일치 해소이기도 하다.

## 변경 내용

### 1. 역할 파일 6개 + 짝 테스트 2개 rename (`git mv`)

| 기존                          | 신규                                   |
| ----------------------------- | -------------------------------------- |
| `api/folder.api.ts`           | `api/bookmark-folder.api.ts`           |
| `api/folder.keys.ts`          | `api/bookmark-folder.keys.ts`          |
| `api/folder.queries.ts`       | `api/bookmark-folder.queries.ts`       |
| `api/folder.queries.test.ts`  | `api/bookmark-folder.queries.test.ts`  |
| `model/folder.schema.ts`      | `model/bookmark-folder.schema.ts`      |
| `model/folder.schema.test.ts` | `model/bookmark-folder.schema.test.ts` |
| `config/folder.const.ts`      | `config/bookmark-folder.const.ts`      |
| `utils/folder.util.ts`        | `utils/bookmark-folder.util.ts`        |

전부 `src/entities/bookmark/folder/` 하위. **파일 내용(export명·로직)은 일절 안 바꾼다** —
import 경로 문자열만 갱신한다.

### 2. mocks 2개 rename

| 기존                                    | 신규                                             |
| --------------------------------------- | ------------------------------------------------ |
| `src/mocks/fixtures/folder.fixtures.ts` | `src/mocks/fixtures/bookmark-folder.fixtures.ts` |
| `src/mocks/handlers/folder.handlers.ts` | `src/mocks/handlers/bookmark-folder.handlers.ts` |

둘 다 북마크 폴더 전용이라 같은 모호성을 가진다. `src/mocks/handlers/index.ts`가
`folder.handlers`를 import하므로 함께 갱신.

**이 2개 파일은 안의 export 식별자도 함께 바꾼다** — mocks 레이어는 파일 접두사와 export명이
1:1로 대응하는 패턴이고(`post.handlers.ts`→`postHandlers`, `comment.handlers.ts`→
`commentHandlers`), fixture 식별자는 엔티티 타입명을 따른다(`mockPost: Post`,
`mockComment: Comment`, `mockAccount: Account`). 파일명만 바꾸고 두면 지금 고치려는 것과
똑같은 불일치가 mocks에 새로 생긴다. 타입은 PR #46에서 이미 `BookmarkFolder`로 바뀌어
있어 식별자만 뒤처진 상태이기도 하다.

| 기존                                                 | 신규                             | 근거                    |
| ---------------------------------------------------- | -------------------------------- | ----------------------- |
| `folderHandlers`                                     | `bookmarkFolderHandlers`         | `<entity>Handlers` 패턴 |
| `mockFolder: BookmarkFolder`                         | `mockBookmarkFolder`             | `mock<EntityType>` 패턴 |
| `mockFolderListResponse: BookmarkFolderListResponse` | `mockBookmarkFolderListResponse` | 동일                    |

### 3. `useRecentFolders.ts` → `useRecentBookmarkFolders.ts` rename

PR #46 잔여 불일치. 이 파일은 `<entity>.<역할>.ts`가 아니라 "파일명 = export명" 컨벤션
대상인데(같은 디렉터리 `useBookmarkFolderSelect.ts`·`BookmarkFolderSelectModal.tsx`가 그
형태), PR #46이 export만 `useRecentBookmarkFolders`로 바꾸고 파일명을 안 따라가서 어긋난
상태다. 짝 테스트 `useRecentFolders.test.ts` → `useRecentBookmarkFolders.test.ts`도 함께.

### 4. `recentFolders` → `recentFolderList` (§18 규칙 누락분)

`docs/FE-ARCHITECTURE.md:661`의 `<entity>List` 규칙("훅 반환 필드·구조분해값이 실제로
배열일 때")에 해당하는데 PR #44에서 누락됐다. PR #44 계획서는 `useRecentFolders`를 **인자
전달 위치**로만 언급했고 반환 필드 자체는 검토 대상에 안 넣었다 — 의도적 제외가 아닌 누락.

`recentFolders`는 `BookmarkFolder[]`가 맞고(`.length`·`.map()` 사용), 각주의 예외 2가지
(BE 계약 매핑 / 배열 아님) 어디에도 안 걸린다. 사용처 7개 파일:
`useRecentFolders.ts:44,48`(정의), `useBookmarkFolderSelect.ts:40,113`,
`useFolderSections.ts:13,18`, `useFolderTree.ts:17,26`, `FolderTree.tsx:36,60,65`,
`MobileFolderList.tsx:35,56,62`, `BookmarkFolderSelectModal.tsx:55,113,118` + 테스트.

전수 조사 결과 같은 유형의 누락이 레포에 총 7종 있었다. 사용자 확인을 거쳐 **이번 PR은
bookmark 도메인 3종만** 처리한다 — 나머지는 rename 대상 파일과 무관한 post·comment·category
도메인이라 한 PR에 섞으면 diff가 커지고 리뷰가 어려워진다.

| 식별자               | 배열 근거                                  | 위치                                                      | 신규                  | 이번 PR |
| -------------------- | ------------------------------------------ | --------------------------------------------------------- | --------------------- | ------- |
| `recentFolders`      | `BookmarkFolder[]`, `.length`·`.map()`     | `useRecentFolders.ts:44,48` 정의 + 6개 파일 + 테스트 13줄 | `recentFolderList`    | ✅      |
| `folders` (파라미터) | `folders: BookmarkFolder[]` 명시 타입      | `useRecentFolders.ts:26`, `folder.util.ts:13`             | `folderList`          | ✅      |
| `usedFolders`        | `folders.filter(...)` → `BookmarkFolder[]` | `folder.util.ts:14,20,25`                                 | `usedFolderList`      | ✅      |
| `posts`              | `flatMap().filter()` → `Post[]`            | 16곳 (post·bookmark 위젯)                                 | `postList`            | ❌ 후속 |
| `previousComments`   | `getQueryData<Comment[]>`                  | 16곳                                                      | `previousCommentList` | ❌ 후속 |
| `comments`           | `Comment[]`/`PostComment[]` 명시           | 9곳                                                       | `commentList`         | ❌ 후속 |
| `categories`         | `CategoryOption[]`                         | 2곳                                                       | `categoryOptionList`  | ❌ 후속 |

**바꾸지 않는 것**(명시적 판단):

- 훅 이름 `useRecentBookmarkFolders` — §18 규칙 대상은 "배열 변수/반환값"이지 훅 이름이
  아니다. 각주가 `useBookmarkFolders`를 명시적으로 예외 처리한 것과 같은 이유.
- 지역 상태 `recentFolderIds` — `string[]`(id 배열)이지 `<Entity>[]`가 아니다.
  `folderIds`·`selectedFolderIds`와 같은 레포 공통 idiom을 따른다.
- `folder.queries.ts:55,61`의 `posts` — 이번에 rename하는 파일 안에 있지만, 같은 이름이
  `post.queries.ts`·`usePostList.ts`·`PostList.tsx` 등에 걸쳐 있어 여기만 바꾸면 오히려
  불일치가 생긴다. 후속 PR에서 16곳을 한꺼번에 처리한다.
- 테스트의 `const folders = getQueryData<BookmarkFolderListResponse>(...)` — 배열이 아니라
  응답 객체라 §18 예외 2번. 이름이 오해 소지는 있으나 규칙 위반은 아니므로 이번엔 안 건드린다.

### 5. 문서 갱신

- `docs/BOOKMARK.md` 20줄, `docs/FE-ARCHITECTURE.md` 8줄, `docs/DECISIONS.md` 3줄
- `docs/FE-ARCHITECTURE.md:660`의 예시 `folder.const.ts` → `bookmark-folder.const.ts`
- **`docs/FE-ARCHITECTURE.md` §18에 각주 추가** — "`<entity>`는 엔티티명이지 디렉터리
  세그먼트명이 아니다. 그룹 폴더(`entities/bookmark/folder/`) 아래에서도 파일 접두사는
  엔티티명(`bookmark-folder`)을 따른다"를 명시. 이 모호성이 실제로 PR #46에서 잘못된
  근거를 낳았으므로 재발 방지로 기록한다.
- **`docs/DECISIONS.md`에 2026-09-09 항목 추가** — 2026-09-08 항목이 "복합명
  `bookmark-folder/`는 도메인 폴더 규칙과 충돌"이라고 적어둔 것이 **디렉터리에 한한
  판단**임을 밝히고, 파일명에는 반대 결론(복합 접두사 채택)이 적용됨을 남긴다. 안 남기면
  다음 사람이 같은 혼동을 반복한다.

### 6. 손대지 않는 것

- **`docs/plans/*.md` 30줄** — append-only 규칙(CI `docs/plans 불변성 확인` 스텝이 차단).
  옛 파일명이 남아도 그대로 둔다. `scripts/check-docs.js`는 `docs/` 최상위만 비재귀
  스캔하므로 CI도 안 깨진다.
- **디렉터리명 `entities/bookmark/folder/`** — `.claude/CLAUDE.md:661-665`의 디렉터리
  규칙을 그대로 따른다. 그룹 폴더가 이미 맥락을 주므로 `bookmark-folder/`로 안 바꾼다.
- 파일 내부 export명·로직 — PR #46에서 이미 정리됨.

## 실행 순서

1. 워크트리 생성(`EnterWorktree`) → `cp ../../../.env . && pnpm install` → `node -v`가 v24인지 확인
2. `git mv`로 파일 11개 rename (역할 6 + 짝 테스트 2 + mocks 2 + 훅 1, 훅 테스트 포함 시 12)
3. import 경로 문자열 갱신 — `@/entities/bookmark/folder/...` 절대경로만 쓰이고 상대경로
   import은 0건이므로 치환이 단순하다. 대상 32개 파일 / 48줄 + `mocks/handlers/index.ts`
4. `recentFolders` → `recentFolderList` 치환 (7개 파일 + 테스트)
5. 문서 갱신 (§5)
6. 검증 (아래)
7. 계획 파일을 `docs/plans/2026-09-09-bookmark-folder-filename-rename.md`로 커밋
8. fresh Explore subagent로 계획 대비 구현 대조
9. `git commit -- <경로...>` → push → PR 생성(`## 계획 대비 구현` 포함) → `gh run watch`
   → 사용자에게 머지 확인 → 머지 → `ExitWorktree --action remove` → 로컬 main `git pull`

## 검증

```bash
node -v            # v24 확인
pnpm type-check    # import 경로 누락은 전부 여기서 TS2307로 잡힘 — 핵심 게이트
pnpm lint          # unicorn/filename-case가 kebabCase 준수를 확인해줌
pnpm test          # 224개 전부 통과해야 함 (로직 무변경)
pnpm check:docs    # docs/BOOKMARK.md:86의 풀패스 참조가 갱신됐는지 확인
pnpm format:check
```

추가 최종 확인:

```bash
# 옛 파일명이 코드/문서에 남아있지 않은지 (docs/plans/ 제외)
grep -rn "folder\.\(api\|keys\|queries\|schema\|const\|util\|fixtures\|handlers\)" src docs README.md .claude --include=*.ts --include=*.tsx --include=*.md | grep -v "docs/plans/"
grep -rn "useRecentFolders\|recentFolders" src docs | grep -v "docs/plans/"
```

`pnpm type-check` 0 에러가 가장 신뢰할 수 있는 누락 탐지기다 — 파일명이 바뀌면 옛 경로를
import하는 모든 곳이 즉시 `TS2307`로 드러난다.

## 규모

- rename **12개 파일** (역할 6 + 짝 테스트 2 + mocks 2 + 훅 1 + 훅 테스트 1)
- import 경로 갱신 약 33개 파일 / 49줄 (`@/entities/bookmark/folder/...` 절대경로만, 상대경로 0건)
- mocks export 식별자 3개 (소비처 배럴 1곳뿐)
- `<entity>List` 치환 3종 — `recentFolders`(7개 파일+테스트 13줄), `folders` 파라미터(2곳),
  `usedFolders`(3곳)
- 문서 31줄 / 3개 md + `FE-ARCHITECTURE.md` §18 각주 1개 + `DECISIONS.md` 신규 항목 1개
- **로직 변경 0** — 순수 파일명·식별자 변경. 테스트 224개가 그대로 통과해야 한다

## 후속 PR로 미루는 것

`<entity>List` 규칙 위반 4종(`posts` 16곳, `previousComments` 16곳, `comments` 9곳,
`categories` 2곳). post·comment·category 도메인이라 이번 파일명 변경과 무관하고, 한 PR에
섞으면 리뷰가 어려워진다. 이번 PR 본문에 "후속 예정"으로 명시해 잊히지 않게 한다.
