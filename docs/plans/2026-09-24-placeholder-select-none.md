# 입력창 placeholder가 드래그 선택 하이라이트에 잡히지 않게 하기

<!-- no-diagram: CSS 규칙 1개 추가 + 문서 갱신뿐이라 단계·분기가 있는 흐름이 없다 -->

## Context

북마크 페이지 검색창(`BookmarkSearch` → `SearchInput` → `Input` atom)의 placeholder
"북마크 내 검색"이 선택되는 것처럼 보인다는 지적.

재현 결과(Playwright, 네이티브 `<input placeholder>` 최소 페이지, 직접 측정):

| 브라우저 | 빈 입력창 안에서 드래그 | 페이지를 가로질러 드래그            | `getSelection().toString()`에 포함? |
| -------- | ----------------------- | ----------------------------------- | ----------------------------------- |
| Chromium | 선택 안 됨              | **placeholder 글자가 하이라이트됨** | 포함 안 됨(복사해도 안 딸려옴)      |
| WebKit   | 선택 안 됨              | **입력창 박스 전체가 하이라이트됨** | 포함 안 됨                          |
| Firefox  | 선택 안 됨              | 하이라이트 안 됨                    | 포함 안 됨                          |

즉 실제 복사 대상은 아니지만 **시각적으로 선택된 것처럼 보이는** 문제다.
`::placeholder { user-select: none }` 적용 시(직접 측정):

- Chromium: placeholder 하이라이트 사라짐, 입력한 값("react")은 여전히 드래그 선택 가능
- WebKit: placeholder 글자 영역은 하이라이트에서 빠짐(박스 나머지는 WebKit 고유 동작으로 남음), 입력값 선택 정상
- Firefox: 원래 문제 없음, 입력값 선택 정상

`input` 자체에 `user-select: none`(또는 `:placeholder-shown`)을 거는 방식은 iOS Safari에서
빈 입력창에 타이핑이 막히는 알려진 위험(출처 미상, 재검증 필요)이 있어 채택하지 않는다 —
`::placeholder` 의사 요소에만 걸면 입력 요소 자체는 건드리지 않는다.

## 범위 결정 (승인 필요)

**전역 `::placeholder` 규칙**으로 처리한다 — 북마크 검색창만이 아니라 네비바 검색창,
폴더 이름 입력, 댓글 textarea 등 모든 placeholder에 적용된다.

- 선례: `src/app/globals.css:484-510`의 select-none 전역 블록(2026-09-21, `docs/plans/2026-09-21-select-none-global.md`)이
  "컴포넌트마다 `select-none`을 붙여 메꾸지 않고 여기 모은다"는 원칙으로 이미 존재한다.
- 같은 `SearchInput`을 쓰는 `NavbarSearch.tsx`에도 똑같은 문제가 있으므로 북마크만 고치면 불일치가 생긴다.
- placeholder는 입력값이 아니라 안내 문구라 복사 대상이 아니다(위 표: selection 문자열에도 원래 포함 안 됨) —
  기존 블록 주석의 "입력값(input/textarea)은 복사 대상이라 제외" 원칙과 충돌하지 않는다.

## 변경

1. **`src/app/globals.css`** — 기존 select-none `@layer base` 블록(484-510) 바로 아래에 별도 규칙 추가:

   ```css
   /* placeholder는 안내 문구라 복사 대상이 아니다. 네이티브 placeholder는 원래
      선택 문자열에 포함되지 않지만, Chromium·WebKit은 페이지를 가로질러 드래그하면
      하이라이트를 칠해 선택된 것처럼 보인다. input 자체가 아니라 의사 요소에만
      걸어 입력값 선택·타이핑은 건드리지 않는다. */
   @layer base {
     ::placeholder {
       @apply select-none;
     }
   }
   ```

   기존 선택자 목록에 끼워 넣지 않는 이유: 기존 블록은 "클릭 가능한 요소" 기준이라 성격이 다르다.
   `@apply select-none`은 기존 블록과 동일하게 `-webkit-` 접두사를 Tailwind에 위임한다.

2. **`docs/FE-ARCHITECTURE.md` §20 "자동으로 select-none이 붙는 대상"**(982-1004) — 표에
   `의사 요소 | ::placeholder` 행 추가, 불릿에 "placeholder는 입력값이 아니라 복사 대상이 아님,
   input 자체엔 걸지 않음" 한 줄 추가. `.claude/skills/design-tokens/SKILL.md:164-167`은
   FE-ARCHITECTURE §20을 가리키기만 하므로 수정 불필요.

3. **`CHANGELOG.md` `[Unreleased]` → `### Changed`** — 선례(2026-09-21 select-none 전역화,
   `CHANGELOG.md:78`)와 같은 섹션·형식:
   `` `shared` 입력창 placeholder가 드래그 선택 하이라이트에 잡히지 않게 변경 ``
   - `배경·구현` details(문단 한 줄로, 수동 줄바꿈 금지). PR 생성 후 PR 링크 후속 커밋.

4. **`docs/plans/2026-09-24-placeholder-select-none.md`** — 이 계획 스냅샷(§11).

커밋: `style(shared): 입력창 placeholder 드래그 선택 하이라이트 방지` (선례 9207846과 같은 type).

## 작업 절차

1. `EnterWorktree` → `cp ../../../.env .` → `pnpm install` (`git log origin/main..main` 비어 있음 확인됨)
2. 위 1~4 반영
3. `git commit -- <경로...>` → PR → fresh Explore subagent로 계획 대비 구현 대조 → PR 본문 `## 계획 대비 구현`
4. CHANGELOG PR 링크 후속 커밋 → squash 머지 → deploy 워크플로우 success 확인 후 보고

## 검증

- `pnpm type-check`, `pnpm lint`, `pnpm format:check`, `pnpm check:docs`(docs 수정)
- 빌드 산출 CSS에 `::placeholder{-webkit-user-select:none;user-select:none}`가 들어갔는지 확인
  (`pnpm build` 후 `dist/assets/*.css` grep)
- `browser-verification` skill 절차로 실제 앱에서 녹화:
  - 북마크 페이지 검색창(로그인 필요) 또는 네비바 검색창에서 페이지를 가로질러 드래그 →
    placeholder 하이라이트 없음
  - 검색창에 값 입력 후 드래그 → 입력값은 정상 선택됨
  - 변경 전/후 스크린샷 나란히 제시
