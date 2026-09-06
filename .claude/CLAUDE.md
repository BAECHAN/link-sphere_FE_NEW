# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.
- When asserting how the existing system currently works ("we follow pattern X", "this mirrors
  framework Y"), trace the actual code path first — don't infer architecture from a
  similarly-shaped utility or an external framework's mechanism. State plainly when a claim is
  traced vs. inferred.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. Impact Check Before Changes

**Enumerate what can break before writing code. Both directions: the new work, and what already works.**

Before implementing, check and report:

- **CRUD failure points** — walk 등록(create) / 수정(update) / 읽기(read) / 삭제(delete) for the
  data this change touches. Name what breaks at each: missing rows, duplicate/idempotency,
  ownership & visibility checks, cascade behavior, count/pagination correctness, concurrent requests.
- **Regression on existing features** — list every existing behavior that could break, with the file
  that owns it. Include: shared queries and cache/invalidation paths, derived counts, existing tests
  that encode the old contract, docs and user-facing text that assert the old behavior, and dead or
  unused code paths that still compile against it.

Report both lists before the first edit, not after. If the change alters a data contract
(schema, DTO, API shape), say explicitly what the deploy order is and what breaks in between.

## 6. Precedent Before Invention

**Find how this codebase already solves it. Copy that shape.**

Before designing anything new:

- Search for an existing feature in the same class of problem, and read it.
- Name the precedent by file path before you write code.
- Follow its shape: layering, naming, cache/rollback strategy, error ownership.
- Deviate only for a stated reason - and state the reason.

This is about reusing the established _shape_, not about extending existing functions.
Writing a new hook/util that follows the precedent is the expected outcome.

The test: "Which existing file did I model this on?" should always have an answer.

## 7. User-Facing Tradeoffs Need Sign-Off

**A technical constraint's side effect can still be a UX decision. Don't absorb it silently.**

Some decisions look purely technical ("we can't bind X to history because of Y") but have a
consequence the user actually experiences ("so pressing back will navigate the page instead of
just closing the dialog"). That consequence is a UX call, not a technical inevitability — even
though it followed logically from the constraint. Surface it and ask before treating it as
settled.

- Don't cite research/precedent more strongly than it supports. If a source covers a related but
  different scenario, say so plainly ("X source is about Y, not exactly this case") — don't imply
  it validates the current decision.
- When challenged on a past decision, re-verify the reasoning before defending it. Check whether
  the original claim actually holds up instead of restating it with more confidence.
- If you can't point to the moment the user was asked and agreed, you decided for them — flag it
  and ask, even after the fact.

The test: could the user tell, from what you told them, that this was a judgment call they didn't
get to weigh in on? If not, you decided for them.

## 8. Ground UI/UX Decisions in Research & Precedent

**Don't design UI/UX from taste alone. Cite the evidence.**

When a task involves a UI/UX judgment call (layout, ordering, interaction pattern, information
architecture — not just visual polish), treat it like any other engineering decision that needs
evidence, not intuition:

- Search for relevant HCI/psychology research and cite what it actually found — don't rely on
  what sounds plausible from memory.
- Look at how established products solved the same problem, including documented failures (a
  shipped-then-removed feature is often stronger evidence than a success story).
- Compare alternatives explicitly (a table works well) and record why the rejected options lost,
  not just which one won.
- Keep the evidence in the project's design-decision record (`docs/DECISIONS.md` or the relevant
  feature doc, e.g. `docs/BOOKMARK.md`) so the reasoning survives past this conversation.

The test: if someone challenges the decision later, can you point to a specific study or product
precedent — or did you just say "this feels better"?

## 9. Preview Visual Changes Before Applying Them

**Spacing, alignment, dividers, color — show the screen, don't describe it.**

Some changes are functionally correct but visually a matter of taste: gap sizes, whether a
divider line helps or clutters, alignment choices. Text descriptions of these are unreliable in
both directions — the reader can't always predict how a description will look, and the writer
can't always predict how a description will land. Shipping the code first and finding out after
deployment ("this gap is too wide") is the failure mode this rule exists to prevent (see
`docs/DECISIONS.md`, 2026-09-06, for the incident that prompted it).

- Before writing the real change, build a static preview — a screenshot of the actual running
  component, or a lightweight mockup that reuses the real Tailwind classes and `globals.css`
  color tokens — so it looks like the real thing, not an approximation.
- If there is more than one reasonable option, build them side by side in one place (one
  Artifact page works well) rather than asking the user to imagine each from a description.
  Parallel comparison surfaces a better pick than serial one-at-a-time review (parallel
  prototyping research — see `docs/DECISIONS.md`, 2026-09-06).
- Only write the change to the real component after the user has seen the preview and picked
  (or approved) an option.

This applies to visual/layout polish, not to functional changes with a single correct behavior —
don't build a preview for a bug fix with an obvious right answer.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

# Link-Sphere FE — Claude Code Guide

---

## Critical Rules

- **Never** Node 20으로 작업 진행 → 이 레포는 Node 24(`.nvmrc`) 고정이다. 작업 전 `node -v`가
  `v24`가 아니면 `nvm use`로 맞춘다. `package.json`의 `engines.node`가 강제하므로 다른 버전이면
  `pnpm install`부터 막힌다
- **Never** native `confirm()` → 항상 `useAlert` + `openConfirm` 사용
- **Never** API 레이어 건너뛰기 → API 호출은 반드시 `.api.ts` 에서만
- **Never** 인라인 쿼리 키 → 항상 `<entity>Keys.*` 사용
- **Never** 인라인 한글 UI 문자열 → 항상 `TEXTS.*` 사용 (ESLint `custom-i18n/no-hardcoded-hangul`가 빌드/pre-commit에서 자동 차단. 보간은 `texts.ts`의 함수형 키 사용 예: `messages.success.folderCreated(name)`. 예외: 테스트/스토리/`date.util.ts`·`common.util.ts` 로케일 포맷)
- **Never** 하드코딩 색상 (`text-red-500`, `bg-green-500` 등) → 항상 `globals.css` 디자인 토큰 기반 Tailwind 클래스 사용 (`text-destructive`, `bg-success`, `text-warning` 등)
- **Never** 인라인 API 경로 → 항상 `API_ENDPOINTS.*` 사용
- **Never** feature hook에서 직접 `queryClient.invalidateQueries` → 항상 `.keys.ts` success handlers 사용
- **Never** 다른 엔티티의 raw 쿼리 키를 재구성해 `queryClient.invalidateQueries`를 직접 호출 → 그 엔티티가 공개한 `<entity>InvalidateQueries.xxx()` 래퍼만 사용. 크로스 엔티티 무효화가 필요하면 자기 엔티티의 `.keys.ts`에 `handle<Event>Success` 함수를 만들어 그 안에서 호출한다 (아래 "크로스 엔티티 무효화" 참고)
- **Never** 하위 레이어에서 상위 레이어 import → ESLint 강제 (레이어 방향 위반)
- **Never** 날짜 처리에 `new Date()` / `.getTime()` 직접 사용 → 항상 `dayjs` 사용 (`dayjs(value).valueOf()`, `dayjs().format()` 등)
- **Never** 대상 파일 양식 무시하고 코드 생성 → 항상 붙여넣을 파일(및 인접 코드)을 **먼저 읽고** 들여쓰기·네이밍·import 순서·따옴표·주석 밀도·정렬을 그대로 맞춘다. 본인 스타일을 강요하거나 기존 코드를 재포맷하지 않는다
- **Never** raw HTML 요소로 UI를 일회성 구현 → 항상 공통 컴포넌트(`shared/ui/atoms`·`elements`·`widgets`) 우선. 반복되는 UI는 공통 컴포넌트를 만들거나 기존 것을 사용해 디자인을 단일 관리한다 (예: 버튼은 raw `<button>` 대신 `Button` 컴포넌트). 신규 코드 기준
- **Never** `shared/ui/atoms`·`elements`에 컴포넌트를 추가하거나 시각적으로 변경하고 스토리 없이 커밋 → 항상 같은 커밋에 `<Component>.stories.tsx`를 함께 만들거나 갱신한다. `.storybook/main.ts`의 글롭이 `src/**/*.stories.tsx`를 자동 인식하므로 파일만 만들면 된다 (예시: `checkbox.tsx`+`checkbox.stories.tsx`, `switch.tsx`+`switch.stories.tsx`)
- **Never** `if`문을 인라인으로 작성 (`if (x) return;`) → 항상 중괄호 블록으로 감싼다 (`if (x) {\n  return;\n}`). 한 줄짜리 본문도 예외 없음 (ESLint `curly` 규칙으로 강제 예정)
- **Never** 문장을 다닥다닥 붙여 논리 그룹을 뭉개지 않는다 → 가드절(`if (...) { return; }`) 뒤, 그리고 `if`/`try` 같은 제어 블록 **앞뒤**에 **빈 줄 1줄**을 넣어 논리 단위를 분리한다 (Prettier가 아닌 컨벤션 — 아래 예시 참고)
- **Never** 클릭 가능한 요소에 `cursor-pointer`를 개별로 붙인다 → `globals.css`의 `@layer base` 규칙이 `button`/ARIA role 전체를 전역으로 처리한다(디자인 토큰 섹션의 "인터랙션 커서" 참고). `div`/`span`에 `onClick`만 다는 것도 금지 — `Button`/`<button>`을 쓰거나, 불가피하면 `role="button"`을 함께 지정한다 (ESLint `custom-a11y/clickable-needs-interactive-element`가 차단)
- **Never** `main`에 push한 뒤 워크플로우 결과를 확인하지 않고 "배포됨"이라 보고 →
  push 명령이 성공한 것과 배포가 실제로 완료된 것은 다른 사건이다. 항상
  `gh run list --branch main --workflow "Frontend Deploy (S3 + CloudFront)"`
  (또는 `gh run watch <id>`)로 그 push의 커밋 SHA가 실제로 success인지 확인한
  뒤에만 사용자에게 결과를 보고한다. 실패했으면 원인을 고쳐 재검증하고, 후속
  수정 커밋이 `docs/`나 `CHANGELOG.md`처럼 `deploy.yml`의 경로 필터에 안 걸리는
  파일만 건드렸다면 `gh workflow run "Frontend Deploy (S3 + CloudFront)" --ref main`
  으로 수동 트리거해야 한다(안 그러면 워크플로우 자체가 안 돌아 조용히
  미배포로 남는다). 2026-09-06 실제로 이 순서를 건너뛰어 배포 실패를 놓친
  사고 발생(`docs/CI-CHECK-GATE.md` §9.3, `docs/DEPLOY.md` "Trigger" 참고).
  최종 성공을 확인했더라도 그 과정에 실패한 run이 있었다면(예: 첫 push가
  실패하고 후속 커밋으로 고쳐 재푸시·수동 트리거로 성공한 경우) **최종 보고에
  그 경위를 함께 밝힌다** — "배포 완료"만 말하면 사용자가 실패 run을 GitHub에서
  직접 발견하고 나서야 전체 경위를 되묻게 된다(2026-09-06 실제 사례)
- **Never** 코드/설정을 바꾼 뒤 그 동작을 서술하는 문서 갱신 누락 → 인프라·배포·아키텍처뿐 아니라 **기능 동작(상태 저장 방식, API 계약 등)을 바꿀 때도** 반대편 BE 레포의 문서(특히 `docs/*-BOT.md` 같은 서사형 문서)가 그 동작을 서술하고 있는지 확인한다(2026-09-06, FE 봇 글 숨기기 토글의 저장 방식을 URL→localStorage로 바꿨을 때 BE `docs/RSS-FEED-BOT.md`가 옛 URL 기반 서술로 남아있던 사례 — BE `.claude/CLAUDE.md`의 같은 규칙 참고). 고쳤으면 **최종 보고에 "문서 X를 Y로 갱신함"을 별도 항목으로 명시**한다
- **Never** CloudFront WAF의 바디 크기 제한 룰(`SizeRestrictions_BODY` 등)을 "왜 있는지" 확인 없이 완화·비활성화하지 않는다 → 이런 룰은 WAF가 바디를 검사할 수 있는 한도(CloudFront 기본 16KB) 너머는 애초에 못 본다는 전제에서 온다 — 한도를 넘은 요청을 그냥 통과시키면 그 너머에 숨은 XSS·LFI·RFI·Log4j 페이로드가 무검사로 뚫린다("검사 못 할 바엔 막는다"는 논리). 2026-09-06 댓글 등록 403 조사 중 `SizeRestrictions_BODY`(8,192바이트 초과 차단)를 완화하려다가, 대체 크기 제한 룰(`SizeConstraintStatement`)이 **CloudFront Pro 플랜(월 $15 정액제) 전용**이라 이 계정(Free 플랜)에서는 만들 수 없다는 걸 확인했다. Count로만 오버라이드하면 WAF의 바디 크기 방어가 완전히 사라져(Lambda 자체 한도 6MB까지 통과, 300KB 페이로드로 실측) 비용·우회 위험이 새로 생기므로 **원복했다** — 이 룰은 지금도 8,192바이트 초과를 그대로 차단 중이다. 그 벽 안에서 동작하도록 앱이 자체 상한(`CommentService.MAX_COMMENT_CONTENT_BYTES`)을 두는 쪽으로 대신 풀었다. Pro 업그레이드 없이는 이 8KB 벽을 건드리지 말 것(`docs/DEPLOY.md`의 "CloudFront WAF (수동 관리)" 절, `docs/DECISIONS.md` 2026-09-06 항목 참고)
- **Never** 폼 검증 실패를 버튼 `disabled`만으로 처리하지 않는다(사용자에게 이유를 알려야 하는 경우) → `disabled` 버튼은 클릭 이벤트 자체가 발생하지 않아 `handleSubmit`의 검증 실패 콜백(에러 토스트 등)이 실행될 기회조차 없어진다. 2026-09-06 댓글 길이 제한 UI에서 이 문제로 "왜 제출이 안 되는지" 사용자가 전혀 알 수 없었다(대체용 호버 툴팁도 데스크톱 한정이라 발견성이 낮았다). 진짜 "할 게 없음"(빈 입력) 상태만 `disabled`로 막고, 그 외 검증 실패(길이 초과 등)는 버튼을 눌러지게 둔 채 zod resolver + `onInvalid` 콜백으로 차단하면서 상시 보이는 인라인 안내 문구를 함께 둔다(`useCreateComment.ts`, `CommentForm.tsx` 참고)
- **Never** 멱등한 버튼(초기화·지우기·해제 등 "특정 상태로 만든다"는 뜻의 버튼)을 "할 게 없음"이라는 이유만으로 `disabled` 처리하지 않는다 → `disabled`는 탭 순서에서도 빠져 키보드만 쓰는 사용자는 버튼도 이유도 볼 수 없다(`TooltipWrapper`가 `tabIndex={-1}`로 호버·터치 전용인 것과 맞물린 구멍, 2026-09-06 필터 초기화 버튼에서 발견). 항상 활성 상태로 두고 클릭 핸들러에서 조용히 early return한다(`PostListSearch.tsx`의 `handleClearSearch` 참고). 단, **저장·등록처럼 "눌렀으면 반영됐다"는 피드백을 기대하는 버튼에는 이 패턴을 확장하지 않는다** — 무음 return이 고장으로 읽힌다. 기존 `disabled`와 이유 안내(`UpdatePostForm.tsx` 등) 방식을 그대로 유지한다(`docs/DECISIONS.md` 2026-09-06 항목 참고)

```typescript
// ✅ 블록화 + 논리 그룹마다 빈 줄 (가드절 뒤, try 블록 앞)
const handleCreateAndSelect = async () => {
  if (submittingRef.current || isCreating) {
    return;
  }

  const name = newFolderName.trim();

  if (!name) {
    return;
  }

  submittingRef.current = true;

  try {
    const created = await createFolder({ name });
    await handleSelect(created.id, created.name);
  } finally {
    submittingRef.current = false;
  }
};

// ❌ 인라인 if + 문장 다닥다닥 + try 붙임
const handleCreateAndSelect = async () => {
  if (submittingRef.current || isCreating) return;
  const name = newFolderName.trim();
  if (!name) return;
  submittingRef.current = true;
  try {
    const created = await createFolder({ name });
    await handleSelect(created.id, created.name);
  } finally {
    submittingRef.current = false;
  }
};
```

- **Never** 워크트리 없이 코드 수정 → 이 레포는 여러 Claude 세션이 동시에 돈다. 코드를 **수정하는**
  작업(읽기 전용 조사·질문 답변은 예외)을 시작할 때는 항상 `EnterWorktree`로 워크트리를 만들고
  그 안에서 작업한다. 워킹트리 파일과 `.git/index`(스테이징 영역)를 세션끼리 공유하면 서로
  덮어쓰거나 무관한 커밋에 남의 변경이 딸려 들어간다 (`docs/DECISIONS.md` 참고)
- **Never** `git add`/`git rm`으로 변경을 미리 스테이징 → 워크트리를 쓰지 않는 세션이 하나라도
  있으면 위와 같은 인덱스 오염이 재발한다. 커밋은 항상 `git commit -- <경로...>` 로 대상 파일을
  직접 지정한다
- **Never** 워크트리 진입 후 부트스트랩 생략 → `EnterWorktree`로 만든 워크트리는 gitignore된
  `.env`가 없다. 진입 직후 반드시 실행:
  ```bash
  cp ../../../.env .
  pnpm install
  ```
- **Never** 여러 워크트리에서 동시에 `pnpm dev` → 포트(31119)는 `strictPort` 미설정이라 겹치면
  다음 빈 포트로 조용히 넘어가 헷갈리고, BE가 보는 DB(원격 Postgres)는 워크트리로 격리되지
  않는다. dev 서버는 한 번에 한 워크트리에서만 띄운다
- **Never** `EnterWorktree` 기본값(`fresh` = `origin/main` 기준)을 확인 없이 사용 → 다른 세션이
  로컬 main에만 커밋하고 아직 push하지 않았다면 그 커밋이 빠진 채로 새 워크트리가 갈라진다.
  작업 시작 전 `git log origin/main..main`으로 미푸시 커밋이 있는지 먼저 확인한다
- **Never** 작업 끝난 워크트리를 `keep`으로 방치 → 병합·push까지 끝나면 `ExitWorktree`를
  `action: "remove"`로 정리한다. 세션이 정상 종료되면 harness가 keep/remove를 물어보지만,
  강제 종료·크래시 시엔 이 프롬프트가 안 뜬다(BE `.claude/worktrees/ci-guardrails/` 잔존 사례로
  확인됨). 새 워크트리를 만들기 전 `git worktree list`로 오래된 워크트리가 남아있는지 먼저
  훑고, 디렉토리는 있는데 목록엔 없는 경우(비정상 종료로 등록이 깨진 경우) `git worktree prune`
  으로 정리한다
- **Never** `eslint.config.js`·`.prettierignore`의 ignore 패턴을 루트 상대 경로로만 작성 →
  `.claude/worktrees/`처럼 중첩된 경로가 새서 워크트리 안 빌드 산출물(`dist/`)이 그대로
  검사 대상에 걸린다. `.gitignore`에 있어도 ESLint/Prettier는 자동으로 읽지 않으므로
  `dist/**/*`가 아니라 `**/dist/**`처럼 `**/` prefix를 붙여야 한다(2026-09-03, `pnpm check`
  2,370건 중 2,366건이 이 문제였다 — `pnpm check`가 CI에 걸려 있지 않아 몇 달째 발견도
  못 됐다. 지금은 PR CI(`ci.yml`)와 `deploy.yml`에 게이트로 걸려 있다)

**여러 워크트리의 변경사항이 합쳐진 상태를 미리 보고 싶을 때**: 워크트리는 격리가
목적이라 기본적으로 서로의 변경을 볼 수 없다. 머지 전에 임시로 합쳐서 확인하고
싶으면 테스트 머지 후 버리는 방식을 쓴다 — 실제 작업 브랜치는 건드리지 않는다.

```bash
# 지금 워크트리 안에서, 다른 워크트리 브랜치를 임시로 병합
git merge --no-commit --no-ff <다른-워크트리-브랜치명>
pnpm dev   # 합쳐진 상태로 확인
git merge --abort   # 확인 끝나면 되돌리기 (커밋 안 남음)
```

원칙적으로는 작은 단위로 자주 머지해 `main`을 항상 통합 상태로 유지하는 쪽이
우선이다 — 위 방법은 머지 전 잠깐 확인하는 임시 수단이지, 습관적으로 여러
브랜치를 오래 안 합치고 쌓아두기 위한 방법이 아니다.

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

> **⚠️ 타입체크는 반드시 `npm run type-check`(= `tsc -b --noEmit`)로.** 루트 `tsconfig.json`은
> `files: []` + `references`만 있는 솔루션 스타일이라 `tsc -p tsconfig.json`으로 돌리면 **0개 파일을
> 검사**(무의미)한다. 실제 소스는 `tsconfig.app.json`(`strict` + `noUncheckedIndexedAccess: true`)에서
> 검사되며, build 모드(`-b`)라야 references를 따라가 이 설정까지 검사한다.

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

전체 디렉터리 트리와 "정식 FSD와 다른 점"은 여기 복사해두지 않는다 —
[`docs/FE-ARCHITECTURE.md`](../docs/FE-ARCHITECTURE.md) §1·§3이 정본이다. 새 도메인·슬라이스를
추가하거나 기존 구조를 확인해야 할 때 그 문서를 먼저 읽는다(두 곳에 같은 트리를 유지하면
한쪽만 갱신되고 다른 쪽이 낡는 문제가 실제로 있었다 — 2026-09-06). 세그먼트 사용 규칙은
아래 "폴더 네이밍 규칙" 절 참고.

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

#### 크로스 엔티티 무효화 (다른 엔티티 캐시까지 갱신해야 할 때)

다른 엔티티의 캐시도 함께 갱신해야 하면, 그 엔티티가 공개한
`<entity>InvalidateQueries.xxx()` 래퍼만 import해서 부른다. 그 엔티티의 raw
쿼리 키를 재구성해서 `queryClient.invalidateQueries`를 직접 호출하지 않는다
(캡슐화가 깨지고, 그 엔티티의 키 구조가 바뀌면 여기도 같이 고쳐야 한다).

```typescript
// entities/comment/api/comment.keys.ts
import { postInvalidateQueries } from '@/entities/post/api/post.keys';

export const handleCommentCreateSuccess = (postId: Post['id']) => {
  commentInvalidateQueries.list(postId); // 1. 자기 엔티티
  postInvalidateQueries.detail(postId); // 2. 댓글 수가 반영되는 포스트 상세
  postInvalidateQueries.list(); // 3. 목록의 댓글 수 배지
};
```

`handle<Event>Success`가 어느 엔티티의 `.keys.ts`에 사는지는 "어떤 이벤트가
트리거인가"가 아니라 "어떤 캐시가 영향받는가"로 정한다 — 트리거가 다른
엔티티(post 삭제, 좋아요/북마크 토글)여도 영향받는 캐시를 소유한 엔티티
(folder)가 핸들러를 호스팅할 수 있다 (`folder.keys.ts`의
`handlePostDeleteSuccess`, `handleBookmarkToggleSuccess`). 참고 파일:
`comment.keys.ts`, `folder.keys.ts`, `auth.keys.ts`(`handleAccountUpdateSuccess`,
`handleAuthRestoreSuccess`).

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

### 토스트 단일 소유 원칙 (중복 방지)

**에러 토스트의 유일한 기본 소유자는 React Query 전역 핸들러(`queryClient.ts`)다.**

- transport 레이어(`shared/api/client.ts`)는 UI 토스트를 띄우지 않는다 — 인증 정리·throw만.
- mutation 에러는 전부 `mutationErrorHandler`를 지나가며, `meta.manualErrorHandling`이 없으면 거기서 토스트 1개가 자동으로 뜬다 ([queryClient.ts](src/shared/lib/react-query/config/queryClient.ts) `if (meta?.manualErrorHandling) return;`).

> ⚠️ **Never** mutation `onError`나 그 mutation을 쓰는 컴포넌트 `catch`에서 `toast.`를 직접 부르면서 `meta.manualErrorHandling`을 빼먹지 말 것 → 전역 토스트와 겹쳐 **두 번 뜬다**. 직접 토스트를 띄우면 반드시 `manualErrorHandling: true`.

### 전역 자동 처리 (queryClient)

- `ApiError` → 콘솔 로깅 + 에러 토스트 자동 표시
- mutation `meta.successMessage` → 성공 토스트 자동 표시
- mutation `meta.errorMessage` → 커스텀 에러 토스트
- (query는 opt-in: `meta.errorMessage`가 있을 때만 토스트. mutation은 opt-out: 기본 표시)

### 새 mutation 만들 때 토스트 결정표

| 원하는 동작                           | 설정                                  | 결과                     |
| ------------------------------------- | ------------------------------------- | ------------------------ |
| 일반 에러 토스트면 충분               | (없음)                                | 전역이 `serverError` 1개 |
| 메시지만 커스텀                       | `meta: { errorMessage }`              | 전역이 그 메시지 1개     |
| `onError`/컴포넌트에서 **직접** toast | `meta: { manualErrorHandling: true }` | 내 토스트만 1개          |
| 옵티미스틱 토글(실패 시 롤백만)       | `meta: { manualErrorHandling: true }` | 토스트 없이 롤백         |

### 수동 처리 (`manualErrorHandling`)

form 필드에 서버 오류 매핑 시, 또는 컴포넌트/플로우가 자체 토스트를 띄울 때 전역 핸들러 우회:

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

### 톤 규칙

`TEXTS`의 사용자 노출 문구는 **해요체**로 통일한다 (2026-08-04, 기존 합쇼체 `-되었습니다.`
방침에서 변경 — 토스 등 국내 서비스 UX 라이팅 사례 조사 후 확정). 합쇼체 `-습니다./-입니다.`,
격식 청유형 `-시겠습니까?`, 사용자 노출 개조식 명사 종결(`"폴더 생성 실패"` 등)을 새로 섞지
않는다. 콘솔 로그 전용 문구(`console.error`에만 쓰이는 키, 예: `apiRequestFailed`)는 예외 —
톤 규칙 대상이 아니다.

- 예: `messages.success.accountCreated` `'가입을 완료했어요.'`,
  `messages.error.nicknameDuplicate` `'이미 사용 중인 닉네임이에요.'`,
  `messages.warning.postDeleteConfirm` `'정말 이 포스트를 삭제할까요? …'`.
- 완료를 나타내는 성공 메시지(`messages.success`)는 가능하면 **능동형**으로 쓴다
  (`'프로필이 업데이트됐어요.'`보다 `'프로필을 업데이트했어요.'`). 다만 행위자가 불분명하거나
  상태를 서술하는 문구(예: 삭제된 글 안내처럼 "누가" 지웠는지 알 수 없는 경우)까지 억지로
  능동형으로 바꾸지 않는다 — 어색해지는 쪽이 우선순위에서 진다.
- 제목·헤딩(`DialogTitle`, 페이지 `title` prop 등)은 마침표 없이, 본문·설명·토스트류
  문장은 마침표를 붙인다.
- 가드 테스트 `shared/config/texts.test.ts`가 `TEXTS` 전체를 순회하며 구 합쇼체·격식
  청유형(`니다`로 끝나는 모든 형태 — `습니다`/`입니다`/`합니다`/`옵니다` 등, `니까?`) 잔존
  여부를 자동 검사한다(콘솔 전용 키는 화이트리스트로 제외). 새 문구를 추가하면 이 테스트가
  통과하는지로 톤을 확인할 수 있다.

### 성공 토스트 표시 기준

`messages.success`에 새 키를 추가하기 전에, 정말 토스트가 필요한지부터 판단한다. 낙관적
업데이트로 화면이 이미 바뀌는 액션에 "성공했습니다" 토스트까지 띄우면 사용자가 이미 본 결과를
텍스트로 한 번 더 말해주는 중복 신호가 된다.

**판단 축**:

1. **가시성** — 액션 직후 현재 화면에서 결과가 바로 보이는가? (목록에서 사라짐·이름
   변경·아이콘 상태 전환 등) → 보이면 토스트 불필요.
2. **정보량** — 토스트가 "성공했다" 이상의 구체적 정보(어디에 저장됐는지, 왜 이렇게
   됐는지)를 전달하는가? → 전달한다면 가시성과 무관하게 필요.
3. **실행취소** — 토스트에 "실행 취소" 액션이 붙어 있(을 예정이)는가? → 그렇다면 유지.

| 필요 (예)                                                            | 불필요 (예)                                                                |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `linkCopied` — 클립보드 복사는 화면 변화가 전혀 없음                 | `postDeleted`/`folderDeleted` — 목록에서 바로 사라짐                       |
| `bookmarkSavedTo(folderName)` — 아이콘만 봐선 "어느 폴더"인지 모름   | `accountUpdated`/`postUpdated` — 수정 결과가 즉시 반영됨                   |
| `bookmarkAutoUncategorizedDescription` — 왜 미분류로 이동했는지 설명 | `postVisibilityUpdated`/`bookmarkRemoved` — 아이콘 상태 전환으로 이미 보임 |

- 유의: 시각적 상태 변화만으로 충분하다고 판단해 토스트를 없애도, 스크린리더 사용자에게는
  그 변화가 그대로 전달되지 않을 수 있다(접근성). 별도 `aria-live` 공지가 필요한지는 케이스
  발생 시 별도로 판단한다 — 이 기준만으로 미리 다 막지 않는다.

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

### 인터랙션 커서

Tailwind v4 preflight엔 v3에 있던 `button, [role="button"] { cursor: pointer }`가 없다
(`node_modules/tailwindcss/preflight.css`에 cursor 규칙 자체가 없음). 이걸 컴포넌트마다
개별로 `cursor-pointer`를 붙여 메꾸지 않는다 — `globals.css`의 `@layer base`가 아래
대상 전체에 전역으로 적용한다.

| 분류       | 대상                                                                                                              |
| ---------- | ----------------------------------------------------------------------------------------------------------------- |
| 태그       | `button`, `summary`, `select`, `input[type=checkbox\|radio\|file]`                                                |
| ARIA role  | `button`, `link`, `menuitem`, `menuitemcheckbox`, `menuitemradio`, `option`, `tab`, `switch`, `checkbox`, `radio` |
| 형제 label | `[role=checkbox]`/`[role=radio]` 바로 뒤의 `label` (예: `FormCheckbox`)                                           |

`:disabled`/`aria-disabled="true"`/`[data-disabled]`는 제외(비활성 요소는 `default` 유지).
`Button asChild`로 `<button>`이 아닌 요소를 감쌀 땐 `role="button"`을 함께 지정해야
이 규칙이 적용된다. 선택자 전체 목록·예외·shadcn 재생성 시 주의사항은
`docs/FE-ARCHITECTURE.md` "클릭 가능한 요소와 커서 규칙" 섹션, 배경은
`docs/DECISIONS.md`의 2026-09-03 항목 참고.

### 다크 모드

- 모든 토큰은 `.dark` 클래스에서 자동 override — 별도 `dark:` prefix 불필요
- ThemeProvider가 `<html>`에 `.dark` 클래스를 토글

### 폰트

- 기본 폰트: `Pretendard` (가변 폰트, woff2-variations)
- Tailwind: `font-sans` → Pretendard > Inter > sans-serif

---

## 폴더 네이밍 규칙

### 폴더 네이밍 원칙

| 위치                          | 규칙                                  | ✅                            | ❌                                |
| ----------------------------- | ------------------------------------- | ----------------------------- | --------------------------------- |
| `features/<domain>/` 슬라이스 | **동사(액션)만**                      | `create/`, `like/`, `delete/` | `create-post/`, `createPost/`     |
| `widgets/<domain>/` 슬라이스  | **`<entity>-<role>`** kebab-case 명사 | `post-card/`, `post-list/`    | `postCard/`, `PostCard/`          |
| `app/layouts/`                | **`<name>-layout`**                   | `app-layout/`, `auth-layout/` | `appLayout/`, `AppLayout/`        |
| 슬라이스 내부                 | **역할명 단수 소문자**                | `hooks/`, `ui/`, `utils/`     | `hook/`, `UI/`, `utils-fn/`       |
| 도메인 폴더                   | **단수 소문자**                       | `post/`, `comment/`, `user/`  | `posts/`, `Post/`, `user-domain/` |
| 내부 전용 폴더                | **`_` 접두사**                        | `_base/`                      | `base/`, `__base__/`              |
| `shared/lib/`                 | **라이브러리명 그대로**               | `react-query/`, `firebase/`   | `reactQuery/`, `query/`           |
| 에러 페이지                   | **HTTP 상태코드**                     | `404/`, `500/`                | `not-found/`, `error/`            |
| `pages/` 복합어               | **붙여쓰기**                          | `mypage/`                     | `my-page/`, `myPage/`             |

### 레이어별 허용 세그먼트

위 표가 이름 "형식"(소문자·단수 등) 규칙이라면, 아래는 레이어별로 어떤 세그먼트를
쓸지에 대한 "허용 목록" 규칙이다. 새 슬라이스를 만들 때 이 표부터 확인한다 — 암묵적으로
트리 예시만 보고 유추하면 레이어마다 다른 세그먼트가 섞이게 된다(2026-09-06,
`entities/user/hooks/`·`widgets/bookmark/*`가 각각 이 표의 규칙을 어긴 채로 만들어졌다가
뒤늦게 `model/`·`ui/`로 통일한 사례).

| 레이어                | 허용 세그먼트                        | 규칙                                                                                   |
| --------------------- | ------------------------------------ | -------------------------------------------------------------------------------------- |
| `entities`            | `api/`, `model/`, `ui/`, `config/`   | 훅을 포함한 모든 로직은 `model/`에 둔다. 별도 `hooks/` 세그먼트를 만들지 않는다        |
| `widgets`, `features` | `hooks/`, `ui/`, `utils/`, `config/` | 컴포넌트가 하나라도 있으면 반드시 `ui/` 아래에 둔다 — 슬라이스 루트에 직접 두지 않는다 |
| `pages`               | 세그먼트 없음                        | 페이지 컴포넌트를 슬라이스 폴더에 바로 둔다                                            |

### 실제 폴더 구조 예시

```
features/
  post/
    create/       ← 동사만 (create-post ❌)
      hooks/
      ui/
    like/
    delete/
    bookmark/
widgets/
  post/
    post-card/    ← <entity>-<role> kebab-case
      hooks/
      ui/
    post-list/
shared/
  ui/
    atoms/        ← 집합 명사 단수 (atom ❌)
    elements/
      form/
        _base/    ← 내부 전용은 _ 접두사
```

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
pnpm type-check       # tsc -b --noEmit (build 모드 — references 따라 app/node 설정까지 검사)
pnpm lint             # ESLint 검사
pnpm lint:fix         # ESLint 자동 수정
pnpm format           # Prettier 포맷
pnpm check            # 타입 + 린트 + 포맷 일괄 검사
pnpm check:fix        # 린트·포맷 자동 수정 후 타입 검사
pnpm storybook        # Storybook (port 6006)
```

---

## 코드 스타일 레퍼런스

새 기능 구현 전 아래 파일들을 읽어 스타일을 학습한다. 위 섹션의 패턴 예시가 추상적으로 느껴질 때 이 파일들을 직접 읽으면 된다.

| 역할              | 레퍼런스 파일                                         | 핵심 패턴                                                                                |
| ----------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Feature Hook      | `src/features/post/create/hooks/useCreatePost.ts`     | `DEFAULT_VALUES` + `useForm/zodResolver` + `onSubmit` 핸들러 분리, 반환값 객체           |
| Widget Hook       | `src/widgets/post/post-card/hooks/usePostCard.ts`     | Props(엔티티+옵션) + 권한 체크 + `toast` + `openConfirm` + try-catch                     |
| API 함수          | `src/entities/post/api/post.api.ts`                   | `postApi` 객체 export, JSDoc 한글, 조건부 스프레드, `NProgress`                          |
| Query Keys        | `src/entities/post/api/post.keys.ts`                  | `rootKey` + `mutationKeys` + `queryKeys` + `invalidateQueries` 헬퍼 + `handleXxxSuccess` |
| Query Hooks       | `src/entities/post/api/post.queries.ts`               | `useMutation(meta 메시지)` + `useInfiniteQuery(select 변환)` + 낙관적 업데이트           |
| Optimistic Update | `src/entities/interaction/api/interaction.queries.ts` | `onMutate → cancelQueries → setQueryData → return previous`                              |
| 텍스트 상수       | `src/shared/config/texts.ts`                          | 계층적 namespace(`TEXTS.xxx.yyy`), `as const`, 한국어                                    |
| API 설정          | `src/shared/config/api.ts`                            | `API_BASES` + `API_ENDPOINTS`(함수형/상수형 혼합), DEV 분기                              |

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

---

## 프로젝트 공통 컨텍스트

- **BE**: Spring Boot + Kotlin, port 8080, context-path `/api`
- **FE**: React + TypeScript + Vite, FSD 아키텍처, port 31119
- **배포**: CloudFront → `/api/*` Lambda(BE), `/*` S3(FE)
- **개발 프록시**: `vite.config.ts` — `/api/*` → `localhost:8080` (rewrite 없음)
- **커밋**: 작업 전 `.gitmessage` 파일 먼저 읽고 형식 준수
- **커밋 단위**: 대화 턴(요청)마다 나누지 않고, 논리적으로 완결된 기능·수정 단위로 나눈다.
  같은 기능을 다듬는 과정에서 나온 후속 수정(버그 픽스 포함)은 원래 커밋에 합치고,
  서로 무관한 변경끼리만 별도 커밋으로 분리한다.

---

## 릴리즈노트 (CHANGELOG) 관리

레포 루트 `CHANGELOG.md`로 변경 이력을 관리한다. 형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) + [SemVer](https://semver.org/lang/ko/), **한글 작성**.

**규칙**

- `feat` / `fix` / `perf` / 동작이 바뀌는 `refactor` 커밋 시 → **`CHANGELOG.md`의 `[Unreleased]` 섹션에 항목 추가**를 같은 커밋에 포함한다.
- 섹션: `Added` / `Changed` / `Fixed` / `Removed`. BE API 의존 사항은 `Notes`, 테스트 추가는 `Tests` 섹션 활용.
- `docs` / `style` / `chore` 등 사용자 영향 없는 변경은 기록하지 않는다.

**항목 포맷** — 한 줄 요약 + 접힌 상세로 훑어볼 수 있게 쓴다.

```markdown
- `post` 게시글 등록 시 북마크 폴더를 함께 지정 가능
  <details><summary>배경·구현</summary>

  지금까지는 등록 후 목록에서 북마크 버튼을 다시 눌러야 했다. 카테고리 선택 아래에
  북마크 필드를 추가해, 등록 제출 한 번으로 함께 처리한다.
  (`features/post/create/ui/BookmarkFolderPicker.tsx`(신규))

  </details>
```

- 요약 줄: `` `스코프` `` + 공백 + 한 줄(72자 이내, 줄바꿈·마침표 없음). 굵게(`**`) 쓰지 않는다.
  스코프는 `post` `comment` `auth` `user` `bookmark` `shared` 중 하나.
- 상세 블록: `<summary>`는 `배경·구현`으로 통일. `<summary>` 다음과 `</details>` 앞에 빈 줄을
  반드시 넣는다(없으면 GitHub이 안의 마크다운을 파싱하지 않는다). 배경·트레이드오프·영향
  파일 목록을 요약 없이 그대로 적는다 — 짧은 항목은 상세 블록을 생략해도 된다.
- `### Notes`는 접지 않는다 — BE 배포 순서 정보라 항상 보여야 한다.
- **상세 블록 안 문단을 손으로 여러 줄로 줄바꿈하지 않는다.** 리스트 항목(`- `) 안의
  `<details>` 블록은 이어지는 모든 줄이 그 리스트의 들여쓰기(2칸)를 따라야 하는데,
  사람이 임의로 줄바꿈하면 그 규칙을 놓친 줄이 생기기 쉽다. 그러면 Prettier의 마크다운
  포맷터가 **파일을 다시 포맷할 때마다 `</details>` 들여쓰기가 계속 늘어나는
  non-idempotent 상태**가 된다 — `git commit`의 `lint-staged`(`prettier --write` 1회만
  실행)는 이 상태를 못 잡고 그대로 커밋시키며, CI의 `pnpm check`(`format:check`)에서야
  뒤늦게 걸린다(2026-09-06 하루에 서로 다른 두 세션에서 각각 재현 —
  `docs/CI-CHECK-GATE.md` §9.3, `docs/DECISIONS.md`). **문단은 아무리 길어도 한 줄로
  써서 Prettier(`proseWrap: preserve`이므로 줄바꿈 없이 그대로 유지됨)가 줄바꿈을
  전담하게 한다.** 부득이 손으로 줄바꿈했다면 커밋 전 `pnpm lint`가 아니라
  `pnpm format:check`(또는 `pnpm check` 전체)를 직접 실행해 확인한다 — lint 통과가
  format:check 통과를 보장하지 않는다.

**릴리즈 시점** (버전 확정)

1. `[Unreleased]` 항목들을 새 버전 섹션 `## [X.Y.Z] - YYYY-MM-DD` 으로 승격 (빈 `[Unreleased]` 유지), 하단 compare 링크 갱신 (`https://github.com/BAECHAN/link-sphere_FE_NEW`)
2. API 계약(BE 의존 사항)이 바뀌었다면 `docs/VERSION-COMPATIBILITY.md`에도 상대 레포 최소 버전 행 추가
3. `chore(release): vX.Y.Z` 커밋 → `git push origin main`
4. **태그·GitHub Release는 수동으로 만들지 않는다** — `.github/workflows/release.yml`이 `CHANGELOG.md` push를 감지해 최신 버전 섹션을 파싱, 동명 태그가 없으면 자동으로 태그 생성 + `gh release create`까지 수행한다(이미 있으면 스킵하는 멱등 동작). `git tag`/`gh release create`를 직접 실행할 필요 없음.

- 현재 버전 기준점: `0.1.0` (정식 릴리즈 전 개발 단계 = `0.x`)

## 문서 파일 위치

루트에는 `README.md`·`CHANGELOG.md`만 둔다 — GitHub 생태계에서 관례적으로 루트에 두는
특수 파일(LICENSE·CONTRIBUTING과 같은 급)이고, CHANGELOG는 Keep a Changelog 스펙 자체가
루트 배치를 표준으로 규정한다. 그 외 모든 문서(아키텍처, 배포 가이드, 테스트 가이드,
버전 호환 매트릭스 등)는 전부 `docs/`에 둔다.

### docs/ 내부 분류

새 문서를 쓰기 전에 아래 다섯 종류 중 어느 것인지 먼저 정하고, 한 문서에 여러 목적을
섞지 않는다(_Software Engineering at Google_ 10장: "문서는 하나의 목적만 갖고 거기
충실해야 한다"). 전체 목록은 루트 `README.md`의 `## 문서` 섹션이 정본이다 — 새
문서를 추가하면 거기에 등록한다.

- **독립 기능 문서**(서사형, `docs/<기능명>.md`) — 자기 완결적인 동작 스펙을 가진 기능.
  화면 유무와 무관, "지금 어떻게 동작하는가"를 항상 최신으로 유지하는 매뉴얼
  역할이면서, **그 기능을 만들며 겪은 시행착오(버그를 발견하고 고친 과정)도
  같은 문서 안에 둔다** — 별도 파일로 떼어내지 않는다. 참고:
  `BOOKMARK.md`, `CI-CHECK-GATE.md`, `MYPAGE.md`, `FCM-PUSH-NOTIFICATION.md`(이미 이
  형태로 "삽질 기록" 절을 포함하고 있음), `UNSAVED-CHANGES-GUARD.md`.
- **절차**(how-to·런북) — 예: `DEPLOY.md`, `TESTING.md`.
- **레퍼런스** — 예: `VERSION-COMPATIBILITY.md`, `SYSTEM-ARCHITECTURE.md`.
  `FE-ARCHITECTURE.md`는 레퍼런스이면서 아래 "아키텍처 패턴" 섹션들을 담는 그릇이기도
  하다. `HISTORY.md`는 `.github/workflows/history.yml`이 계속 갱신하는 **자동 생성
  레퍼런스**다 — 직접 편집하지 않는다.
- **설계 결정 기록**(ADR 경량판, `DECISIONS.md`) — **되돌리기 어렵고, 실제로
  대안을 비교해 선택한** 결정만 담는다(예: 모바일 내비 스와이프 폐기 → 하단
  탭바 채택). 업계 ADR 컨벤션 기준으로 "한 엔지니어가 짧은 기간 안에 발견·
  수정한 것"은 애초에 대상이 아니다 — 기능 하나를 구현하다 만난 버그·구현
  함정은 대안 비교 없이 그 자리에서 고친 것이므로 그 기능 문서 안에 남긴다.
  DECISIONS.md는 "이 기능을 이렇게 만들지 저렇게 만들지 검토했다" 수준의
  결정에만 쓴다. append-only 로그라 아래 "독립 기능 문서 내부 순서"를 따르지 않는다.
- **보관**(archive) — 더 이상 갱신하지 않는 과거 기록. 현재 해당 문서 없음.

아래에는 "아키텍처 패턴"이 별도 항목으로 있었으나, 이건 **문서 종류가 아니라
`FE-ARCHITECTURE.md` 안의 섹션 단위**라 위 분류에서 제외했다 — 여러 기능이 재사용하는
구현 방법(그 자체가 독립된 동작 단위는 아닌 것)이면 새 파일을 만들지 않고 기존 패턴
목록(Delete with Confirm, Optimistic Update 등)에 섹션만 추가한다.

feat 커밋 시 CHANGELOG.md 갱신과 같은 타이밍에, 해당하는 문서도 함께 반영한다.

### 독립 기능 문서 내부 순서

BE `.claude/CLAUDE.md`의 "서사형 작업 문서 형식"과 같은 이유로, 여기서도 절
순서를 고정한다(2026-09-03, BE RSS 피드 봇 문서화에서 먼저 확정한 형식을
FE의 기존 "how vs why 분리" 원칙에 맞게 조정 — 시행착오는 DECISIONS.md로
보내지 않고 기능 문서 안에 남긴다는 점만 BE와 다르다. 2026-09-04, BE가 "문서만
보고 고칠 수 있는가" 리뷰를 거쳐 자기완결성 요건을 추가한 것을 FE에도 이식).

**원칙**: 좋은 문서 = _독자에게 필요한 지식 − 독자가 이미 가진 지식_ (Google 기술 문서
가이드). 잘 아는 사람이 쓴 문서는 모르는 상태를 상상하지 못해 맥락을 건너뛰기 쉽다("지식의
저주") — 그래서 아래 순서는 전제 지식 선언·용어 정의를 구조적으로 강제한다. 단, 이미 다른
곳에 정본이 있는 사실(Zustand 스토어·Zod 스키마 원본, 파일 트리 등)은 옮겨적지 않고
**링크로 가리킨다** — 복제하면 원본이 바뀔 때 문서가 조용히 거짓말하게 된다(SSOT).

모든 독립 기능 문서는 제목 아래 인용구(`>`) 블록으로 아래 네 가지를 번호 없이 먼저
밝힌다 — Google 기술 문서 가이드의 audience declaration(WHO/WHAT/WHY)에 해당:

- **문서 성격** — 독립 기능 문서(서사형)임을 명시
- **대상 독자** — 예: "이 레포 FE를 처음 보거나 오랜만에 돌아온 개발자"
- **읽고 나면** — 이 문서만 보고 할 수 있게 되는 것
- **마지막 검토**: `YYYY-MM-DD` — 문서를 고칠 때마다 갱신한다. 실제로 다시 읽고 고친
  날짜만 적는다(검토하지 않은 문서에 오늘 날짜를 넣지 않는다)

이어서 본문은 아래 순서를 따른다:

1. **쉬운 설명** — 핵심 개념을 이 도메인을 모르는 독자도 이해할 수 있는 비유로. **장 끝에
   전체 흐름을 보여주는 Mermaid 순서도를 반드시 넣는다** — 각 단계가 무엇을 하고 무엇을
   주고받는지(API 호출·상태 변경·캐시 무효화 등)를 노드 라벨에 적어, 글을 안 읽고 그림만
   봐도 흐름이 따라와야 한다. mermaid 코드 펜스(백틱 세 개 + `mermaid`)를 쓴다(GitHub이
   도형으로 렌더한다). 한글 라벨에 `·`·`(`·`:`가 섞이면 노드 텍스트를 큰따옴표로 감싸고,
   줄바꿈은 `<br/>`를 쓴다
2. **전제 지식** — 이 문서가 가정하는 지식과 가정하지 않는 지식을 나누고, 가정하지 않는
   부분은 어느 문서를 먼저 보면 되는지 링크한다(설계 배경이 `DECISIONS.md`에 있으면 여기서
   연결)
3. **사용한 도구·기술** — bullet point, "기능 자체" / "구현·검증 과정에서 쓴 도구" 구분
4. **왜 만들었나** (문제)
5. **구조** — 다이어그램·핵심 설계 결정과 그 근거. 1번 순서도와 성격이 다른 다이어그램
   (컴포넌트 트리·시퀀스 다이어그램 등)이면 여기 둬도 되지만, 두 그림의 역할 차이를 한
   줄로 밝힌다
6. **상태 모델** — 이 기능이 새 Zustand 스토어·React Query 키 계층·Zod 스키마를 도입했다면
   그 shape를 표로 설명한다. 원본 코드는 옮겨적지 않고 파일을 링크한다(복제 금지) — 이
   문서 전체에서 반복 언급되는 상태 조각이 있는데 shape가 한 곳에도 정리돼 있지 않다면
   이 절이 비어 있다는 신호다
7. **운영 파라미터** — 있다면(주기·건수·타임아웃 등) 표로, 각 값의 실제 위치를
   `파일:줄`까지 명시
8. **코드 지도와 자주 하는 수정** — "이 단계는 어느 파일인가" 매핑과 "이렇게 고치려면"
   레시피 표. 파일명만이 아니라 `파일:줄`까지 명시한다. `README.md`나 `FE-ARCHITECTURE.md`
   에 이미 있는 디렉터리 트리는 복제하지 않는다
9. **검증 결과** — 실제로 확인한 수치·화면
10. **시행착오** — 겪은 버그와 디버깅 과정. **뒤쪽에 배치** — 결과를 다 본 사람을
    위한 부록이지 첫 진입점이 아니다. 이 기능 하나에 국한된 이야기라면 여기 남기고,
    더 큰 단위의 설계 재검토로 이어졌다면 그 부분만 `DECISIONS.md`에도 짧게 링크
11. **남은 것**
12. **용어 사전** — 이 문서에서 처음 나오는 고유 용어·식별자(스토어 이름, 훅 이름, 내부
    개념 등)를 정의 없이 쓰지 않는다. 문서 전체에서 반복 등장하는데 한 번도 설명되지 않은
    용어가 있다면 여기 모은다
13. **관련 문서** 링크

문서를 다 쓴 뒤에는 처음부터 훑어 다음을 확인한다 — 사람 리뷰어가 없는 1인 개발 레포에서
Google이 말하는 "독자 리뷰"(도메인을 모르는 사람이 읽어 명확성을 검증하는 것)를 스스로
대행하는 절차다: ① 정의 없이 등장하는 고유 용어가 있는가 ② 이 문서만 보고 값을 바꾸거나
고칠 수 있는가 ③ 다른 곳의 정본과 중복해서 적은 사실이 있는가 ④ 문서의 코드 스니펫이
실제 소스와 여전히 일치하는가(특히 오래 갱신되지 않은 문서일수록 노후화 위험이 크다).
