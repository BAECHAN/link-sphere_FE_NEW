# 북마크 폴더 선택 컴포넌트 개명 — PostCardBookmarkFolderModal / PostCreateBookmarkFolderField

> 이전 계획(features 네이밍 완화 + 테스트 기준 명문화 + `post/bookmark`→`bookmark/toggle`
> 승격)은 PR #40·#41로 전부 완료·머지됨. 그 작업 중 발견된 새 문제(아래 Context)를
> 다루는 새 계획으로 이 파일을 덮어쓴다.

## Context

PR #41 이후 구조를 다시 들여다보다가, 사용자가 `BookmarkFolderModal.tsx`가
그 안에서 호출하는 `entities/bookmark/folder/ui/FolderPickerModal.tsx`와 이름·JSDoc
설명이 사실상 동일해서 구분이 안 된다고 지적했다:

- `FolderPickerModal`의 JSDoc: "북마크 폴더 선택 UI — 보관함의 즉시 저장
  (`BookmarkFolderModal`)과 등록 폼의 지연 선택(`BookmarkFolderField`)이 공유하는
  프레젠테이션 컴포넌트"
- `BookmarkFolderModal`의 JSDoc: "북마크 폴더 선택 UI — 즉시 저장(탭 = 바로
  저장/제거 + 닫힘) 동작은 `useBookmarkFolderModal`이 소유..."

두 설명 모두 "북마크 폴더 선택 UI"로 시작해 이름만 봐서는 어느 게 껍데기(entities,
270줄 마크업 전부)이고 어느 게 얇은 래퍼(features, 45줄)인지 알 수 없다. 이어서
`BookmarkFolderModal`(즉시 저장, `PostCard`에서 호출)과 `BookmarkFolderField`
(지연 선택, `CreatePostForm`에서 호출)도 호출 맥락이 이름에 없어 같은 문제가 있다.

조사 결과 웹에서 확인한 근거:

- FSD 공식 [Layers](https://feature-sliced.design/docs/reference/layers) 문서가
  정확히 이 패턴("entity UI는 여러 페이지에서 같은 외형을 재사용하고, 다른
  비즈니스 로직은 props/slot으로 붙는다")을 정상적인 설계로 인정하지만, 그 wrapper를
  뭐라고 이름 붙일지는 규정하지 않는다 — 네이밍은 팀 판단 영역.
- CEV(Context-Element-Variant) 네이밍 패턴과 일반 React 컨벤션 모두 "컴포넌트가
  특정 맥락에 강하게 묶여 있으면 그 맥락(부모/사용처)의 이름을 붙인다"고 권한다
  ([참고](https://medium.com/@smail.oubaalla/how-to-name-your-react-component-conventions-b8daf3abc574)).
- 폴더 위치만으로 구분하는 건 실무에서 신뢰할 수 없다 — VS Code 자체 이슈 트래커에
  quick open(⌘P) 경로 표시가 잘못된 방향으로 잘리는 문제([#156062](https://github.com/microsoft/vscode/issues/156062))와
  동일 파일명이 여러 폴더에 있을 때 결과가 제대로 안 보이는 문제
  ([#63807](https://github.com/Microsoft/vscode/issues/63807))가 몇 년째 열려있다.
  즉 폴더 경로가 항상 눈에 보인다는 보장이 없으므로 이름 자체로 구분돼야 한다.
- "Picker"→"Select" 대체는 검토 후 기각했다 — 이 레포에서 `Select`는 이미
  `shared/ui/atoms/select.tsx`(Radix 드롭다운 원시 컴포넌트)가 쓰는 예약어라,
  폴더 리스트+모달 UI에 다시 쓰면 "그 드롭다운을 감싼 건가?"라는 새 오해가 생긴다.
  `Picker`는 이 폴더 선택 UI 계열에서만 쓰이는 유일한 단어라 그대로 유지한다.

실측 확인(추측 아님, grep으로 확인):

- `BookmarkFolderModal`을 여는 곳은 `BookmarkPostButton` 하나뿐이고, 그 버튼은
  `widgets/post/post-card/ui/PostCard.tsx`에서만 쓰인다. `PostCard`는 피드
  (`PostList`)·상세(`PostDetailPage`)·북마크 페이지(`BookmarkPostList`) 세 곳에서
  재사용되는 **같은 위젯 하나**이므로, 호출 맥락은 "PostCard" 하나로 수렴한다(별도
  "PostDetail" 맥락은 없다).
- `BookmarkFolderField`를 여는 곳은 `CreatePostForm.tsx` 하나뿐(`features/post/create/`).
- 두 컴포넌트의 실제 차이는 "다중 선택 여부"가 아니다(`FolderPickerModal`이
  두 경우 모두 다중 폴더 소속을 지원) — 진짜 차이는 **탭 시점에 즉시 반영되는지,
  폼 제출 시점에 한 번에 반영되는지**다.

## 결정 완료 — 개명 대상과 새 이름

기존 이름(`BookmarkFolderModal`/`BookmarkFolderField`)의 단어를 지우거나 바꾸지
않고, 호출 맥락 접두사(`PostCard`/`PostCreate`)만 앞에 덧붙인다.

| 파일                                                           | 새 이름                                  |
| -------------------------------------------------------------- | ---------------------------------------- |
| `src/features/bookmark/toggle/ui/BookmarkFolderModal.tsx`      | `PostCardBookmarkFolderModal.tsx`        |
| `src/features/bookmark/toggle/ui/BookmarkFolderModal.test.tsx` | `PostCardBookmarkFolderModal.test.tsx`   |
| `src/features/bookmark/toggle/hooks/useBookmarkFolderModal.ts` | `usePostCardBookmarkFolderModal.ts`      |
| `src/features/post/create/ui/BookmarkFolderField.tsx`          | `PostCreateBookmarkFolderField.tsx`      |
| `src/features/post/create/ui/BookmarkFolderField.test.tsx`     | `PostCreateBookmarkFolderField.test.tsx` |
| `src/features/post/create/hooks/useBookmarkFolderField.ts`     | `usePostCreateBookmarkFolderField.ts`    |

**변경하지 않는 것**:

- `entities/bookmark/folder/ui/FolderPickerModal.tsx` / `hooks/useFolderPicker.ts` —
  "여러 맥락에서 재사용되는 범용 엔진"이라는 이름의 의미가 그대로 유지된다.
- `features/bookmark/toggle/hooks/useBookmarkFolders.ts` — 개명 대상이 아니었다.
  mutation 4개를 행 동작 3개로 묶는 계층이라 그대로 두고, JSDoc의
  `BookmarkFolderModal` 언급만 새 이름으로 갱신한다.
- `BookmarkPostButton.tsx` — 이미 "Post"+"Button" 형태로 호출 맥락이 이름에
  드러나 있어 그대로 둔다.

개명 후 세 컴포넌트:

```
FolderPickerModal              (entities — 범용 엔진, 호출자를 가리키지 않음)
PostCardBookmarkFolderModal    (features/bookmark/toggle — PostCard에서 즉시 저장)
PostCreateBookmarkFolderField  (features/post/create — 등록 폼에서 지연 선택)
```

## 실행 계획

### 1. 파일 rename (`git mv`)

위 표의 6개 파일. export되는 함수/컴포넌트 이름도 파일명과 동일하게 바꾼다
(`BookmarkFolderModal`→`PostCardBookmarkFolderModal`, `useBookmarkFolderModal`→
`usePostCardBookmarkFolderModal`, `BookmarkFolderField`→`PostCreateBookmarkFolderField`,
`useBookmarkFolderField`→`usePostCreateBookmarkFolderField`). Props 인터페이스명
(`BookmarkFolderModalProps` 등)도 함께 바꾼다.

### 2. import 경로 + 참조 갱신

grep으로 확인한 실제 참조 지점(전부):

- `src/features/bookmark/toggle/ui/BookmarkPostButton.tsx:7,18,19,51` — import 경로 +
  JSDoc 주석 2곳
- `src/features/post/create/ui/CreatePostForm.tsx:8,54` — import 경로 + JSX
- `src/features/bookmark/toggle/hooks/useBookmarkFolders.ts` JSDoc의
  `BookmarkFolderModal` 언급 → `PostCardBookmarkFolderModal`
- `src/entities/bookmark/folder/ui/FolderPickerModal.tsx:19,32-33` — JSDoc 3곳
  (`BookmarkFolderModal`→`PostCardBookmarkFolderModal`, `BookmarkFolderField`→
  `PostCreateBookmarkFolderField`)
- `src/entities/bookmark/folder/hooks/useFolderPicker.ts:49` — 주석 1곳
- `src/entities/bookmark/folder/hooks/useRecentFolders.ts:20` — 주석 1곳
- `src/shared/ui/elements/modal/SheetDialogContent.tsx:11` — JSDoc 1곳
- rename되는 파일들 자기 자신의 import문(예: `PostCardBookmarkFolderModal.tsx`가
  `usePostCardBookmarkFolderModal`을 import하는 줄, `.test.tsx`가 컴포넌트를
  import하는 줄)

### 3. 문서 갱신

**`docs/BOOKMARK.md`** (라이브 서술 — 새 이름으로 갱신):

- §5 소제목 "`BookmarkFolderModal` 행 동작"(124행) → "`PostCardBookmarkFolderModal` 행 동작"
- 126행 설명, 158-174행 "링크 등록 폼의 폴더 선택" 절 전체(소제목·본문·비교표)
- §8 코드 지도 트리(252-292행) — 파일명 4곳 + 주석
- §8 "자주 하는 수정" 표의 테스트 실행 커맨드(317행)
- §9 검증 결과(321-326행) — **여기는 이미 과거 개명 이력
  (`FolderSelector`→`BookmarkFolderModal`, `BookmarkFolderPicker`→`BookmarkFolderField`)을
  적고 있는 문단**이라, 새로 다시 쓰지 않고 그 이력에 이어서
  "→`PostCardBookmarkFolderModal`/`PostCreateBookmarkFolderField`(2026-09-08)"를
  추가한다(테스트 파일명도 갱신하되 통과 개수는 재검증 후 채움)
- §11 남은 것 근처 366-367행 — `BookmarkFolderField`/`BookmarkFolderModal` 언급을
  새 이름으로

**`docs/FE-ARCHITECTURE.md`** — §3 트리 주석 2곳(159, 174행) 파일명 갱신

**`docs/CI-CHECK-GATE.md`** (183-184, 210행) — 과거 dep 누락 기록. 이미
"`FolderSelector.tsx`(현재 `BookmarkFolderModal.tsx`)" 형태로 각주가 달려 있으므로
원문은 유지하고 "(현재 `PostCardBookmarkFolderModal.tsx`)"로 각주만 갱신

**`docs/DECISIONS.md`** (14, 55행) — 이 세션에서 이미 쓴 2026-09-08 결정 항목 안의
사실 서술(`BookmarkFolderField.tsx`/`useBookmarkFolderField.ts` 언급). 과거 기록
성격이므로 원문 유지 + "(현재 `PostCreateBookmarkFolderField.tsx`)" 각주만 추가

### 4. `const.ts` 4중 basename 충돌 정리 (같은 조사에서 발견, 함께 처리)

`find src -name "*.ts" -o -name "*.tsx" | xargs -n1 basename | sort | uniq -d`로
실측 확인한 실제 중복(추측 아님):

```
src/shared/config/const.ts        (전역 설정 — 유지)
src/entities/post/config/const.ts        → post.const.ts
src/entities/comment/config/const.ts     → comment.const.ts
src/entities/bookmark/folder/config/const.ts → folder.const.ts
```

이미 각 슬라이스가 쓰고 있는 `<entity>.<역할>.ts` 규칙(`folder.api.ts`,
`folder.schema.ts`, `folder.util.ts`)을 `config/`에도 그대로 적용하는 것뿐이라
새 규칙이 아니다. `shared/config/const.ts`는 도메인이 없는 전역 설정이라 대상에서
제외.

- `git mv`로 3개 파일 rename
- import 경로 갱신: grep으로 실측한 참조 지점 전부(총 11곳)
  - `post/config/const.ts` → `post.const.ts`: `entities/post/api/post.queries.ts:25`,
    `entities/bookmark/folder/api/folder.queries.ts:28` (2곳)
  - `comment/config/const.ts` → `comment.const.ts`:
    `features/comment/update/ui/CommentEditForm.tsx:12`,
    `features/comment/update/hooks/useUpdateComment.ts:11`,
    `features/comment/update/hooks/useUpdateComment.test.tsx:13`,
    `features/comment/create/ui/CommentForm.tsx:10`,
    `features/comment/create/hooks/useCreateComment.ts:14`,
    `features/comment/create/hooks/useCreateComment.test.tsx:14`,
    `entities/comment/utils/comment.util.ts:2`,
    `entities/comment/model/comment.schema.ts:4` (8곳)
  - `bookmark/folder/config/const.ts` → `folder.const.ts`:
    `entities/bookmark/folder/utils/folder.util.ts:6` (1곳)
- `docs/FE-ARCHITECTURE.md` §16/§18 네이밍 표에 "`config/` 파일도 `<entity>.const.ts`"
  규칙이 없다면 한 줄 추가(선례 확정이므로 문서화)

### 5. PR #41이 남긴 문서 누락 2건 (같은 조사에서 발견, 함께 처리)

- `src/features/post/create/ui/BookmarkFolderField.tsx:12`(rename 후
  `PostCreateBookmarkFolderField.tsx`) JSDoc이 아직 옛 경로
  `features/post/bookmark/ui/BookmarkFolderModal`을 가리킴 → 새 경로로 수정
  (겸사겸사 이번 rename 반영)
- `.claude/CLAUDE.md:662` "`features`·`widgets`가 **이미 쓰는** 그룹 폴더 패턴
  (`features/post/bookmark/`, ...)" — 현재형 서술인데 그 경로가 이제 없음 →
  `features/bookmark/toggle/`로 갱신

## 검증

```bash
node -v                # v24 확인
pnpm type-check
pnpm lint
pnpm test              # BookmarkFolderModal.test.tsx(8)·BookmarkFolderField.test.tsx(11)
                        # 단언 무수정 확인 — rename 후 파일명만 바뀜
pnpm check:docs
pnpm format:check
```

수동 확인: `pnpm dev` 후 피드/상세/북마크 페이지의 북마크 버튼 → 모달 정상 동작,
등록 폼의 폴더 선택 필드 정상 동작(둘 다 로직 변경 없음, import 경로만 이동).

## 작업 방식

이전 PR들과 동일 — `EnterWorktree`로 워크트리 생성 → `cp ../../../.env . &&
pnpm install` → 작업 → 검증 → `git commit -- <경로...>` → push → PR 생성 →
`gh run watch`로 CI 확인 → 사용자에게 머지 확인 → 머지 → `ExitWorktree --action remove`.
