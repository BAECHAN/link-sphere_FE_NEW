# 아키텍처 위반 재발 방지 — 1단계: 정본 문서 ↔ 실제 코드 정합성 감사 (실행 계획)

## Context

앞서 여러 방향(ESLint 자동화 중심, 문서+cross-context review 중심, 5단계 프로세스)을
검토했으나, 사용자가 "가장 먼저 해야 하는 건 FE-ARCHITECTURE.md·CLAUDE.md·ESLint 규칙이
실제 소스코드와 일치하는지 확인하는 것"이라고 지적했다. 5단계 계획의 1단계("현재 아키텍처를
md에 정확히 명시")를 먼저 완전히 끝내지 않으면, 이후 단계(새 세션 대조 검토, 주기적 검토
시스템)가 처음부터 틀린 기준을 비교 대상으로 삼게 된다.

**감사 방법**: Explore 에이전트 3개를 병렬로 띄워 각각 `docs/FE-ARCHITECTURE.md`,
`.claude/CLAUDE.md`, `eslint.config.js` 전체를 실제 `src/` 코드·설정 파일과 대조했다. 각
에이전트에게 "애매하면 절대 임의로 확정 짓지 말고 ❓(확인 필요)로 분리해서 보고하라"고 명시
지시했다. 아래는 그 결과를 (A) 문서 정정 / (B) 설정 자체 문제 / (C) 판단 필요로 재분류한
것이다.

## (C) 사용자 확인 완료 — 확정된 실행 항목

| #   | 이슈                                                                                                                                                   | 결정                                                                                                                                                                                                                                    | 비고                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| C1  | `entities/bookmark/folder/ui/BookmarkFolderSelectModal.tsx`(270줄)가 CRUD를 전부 담은 완전한 인터랙션 UI라 "entities/ui는 시각적 표현만" 규칙과 어긋남 | **FSD 공식 문서를 참고해 CLAUDE.md/FE-ARCHITECTURE.md의 entities/features UI 배치 규칙 자체를 재검토·갱신**. 코드는 건드리지 않음. **이 재검토 과정에서 현재 구조와 안 맞는 부분이 더 나오면 판단하지 말고 반드시 사용자에게 물어본다** | 사용자 지시: "임의로 조율하지 말고 나한테 물어봐서 조율" |
| C2  | raw `<button>`이 `shared/ui` 밖에 20곳 이상(`FolderTree.tsx` 5곳 등) — 규칙 도입 전/후 구분 필요한 상황                                                | **커밋 이력 조사 없이 전부 위반으로 간주하고 `Button` 컴포넌트로 교체**                                                                                                                                                                 |                                                          |
| C3  | `.npmrc`에 `engine-strict=true`가 없어 "Node 24 아니면 install부터 막힌다"는 CLAUDE.md 주장이 실제로 에러인지 경고인지 미확인                          | **`.npmrc`에 `engine-strict=true` 추가해서 확실히 강제**                                                                                                                                                                                |                                                          |

## (A) 문서 정정 — 코드가 맞고 문서가 낡음 (문서를 코드에 맞춰 갱신)

| #   | 문서:위치                        | 무엇이 다른가                                                                                                                                                                                  |
| --- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | CLAUDE.md TEXTS 트리             | `common`·`mypage`·`recentSearch`·`bookmark`·`errors`·`notification`·`unsavedChanges` 7개 네임스페이스 누락(실제 20개 중 13개만 문서화)                                                         |
| A2  | CLAUDE.md TEXTS 키 예시          | `messages.success.postDeleted`·`folderCreated(name)`·`comment.form.submitting`·`post.detail.back/heading/commentsHeading` 전부 존재하지 않는 키(실제는 `backToList`, `saving` 등)              |
| A3  | CLAUDE.md/FE-ARCHITECTURE.md §23 | "Util Class 7/8·8/8 파일" → 실제 9개 파일 중 8개(`version.util.ts` 신규 미반영, 양쪽 문서 동일 오류)                                                                                           |
| A4  | CLAUDE.md                        | "현재 버전 기준점: 0.1.0" → CHANGELOG 최신 릴리즈 0.13.0                                                                                                                                       |
| A5  | FE-ARCHITECTURE.md §1            | `post.schema.ts:105-106` → 실제 102-103행                                                                                                                                                      |
| A6  | FE-ARCHITECTURE.md §1 Mermaid    | `interaction→comment`, `post→bookmark/folder`, `post→category` 엣지 3개 누락(실제 15개 중 12개만 표시)                                                                                         |
| A7  | FE-ARCHITECTURE.md §5            | `comment.keys.ts` 코드 예시가 실제와 다름(댓글 목록은 낙관적 갱신으로 대체돼 invalidate 안 함)                                                                                                 |
| A8  | FE-ARCHITECTURE.md §3            | `app/ui/PostMutationLoadingToast.tsx`, `shared/store/appVersion.store.ts`, `shared/utils/version.util.ts`, `navbar/hooks/useNavbarSearch.ts` 트리 누락                                         |
| A9  | FE-ARCHITECTURE.md §8            | `usePostList` 코드 예시가 존재하지 않는 `PostFilter`·`usePostListQuery`를 사용(실제는 인자 없음, Suspense 쿼리로 전환됨)                                                                       |
| A10 | 양쪽 문서                        | 코드 인용 스니펫이 각 문서 **자신의 규칙(인라인 if 금지, 한글 하드코딩 금지)을 위반하는 형태**로 적혀 있음(실제 코드는 규칙 준수, 인용만 틀림) — `queryClient.ts`, `CreatePostForm.tsx` 인용부 |

## (B) 설정/도구 자체 문제 — 문서 정정이 아니라 eslint.config.js를 고치거나 정리할지 판단 필요

이건 (A)와 성격이 다르다. 문서가 아니라 **실제 검사 도구가 죽어있거나 사각지대가 있는 것**이므로,
"코드를 문서에 맞춘다"는 4단계 원칙이 적용 안 된다 — 코드(설정)를 고칠지, 제거할지, 그대로
둘지 별도 판단이 필요하다. **우선순위 순으로 정렬, 🔴🟡🟢는 실질적 위험도.**

| #   | 내용                                                                                                                                                        | 위험도     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| B1  | `getState()` 금지 규칙이 화살표 함수 컴포넌트/훅을 못 잡음(`function` 선언만 잡힘 — 레포 실제 훅 대다수는 화살표 함수)                                      | 🔴         |
| B2  | 배럴 import 금지가 디렉터리 형태 배럴을 못 막아 **실제 위반 2건이 지금 lint 통과 중**(`RouterProvider.tsx`, `mocks/server.ts`)                              | 🔴         |
| B3  | `config/` 파일명 규칙 블록이 `files`/`ignores` 자기 상쇄로 완전히 죽어있음(config 파일 12개 전부 검사 밖) + 주석(camelCase)과 실제 규칙(kebabCase) 불일치   | 🟡         |
| B4  | `.styles.ts` 관련 설정 6곳이 전부 죽어있음(레포에 `.styles.ts` 파일 자체가 없음, `styled-components` 실질 미사용)                                           | 🟡         |
| B8  | "Custom Hook camelCase(`use*.tsx`)" 규칙이 실제 훅 파일(전부 `.ts`)과 무관 — 훅 파일명 규칙이 사실상 없음                                                   | 🟡         |
| B10 | `src/*.d.ts` ignore가 중첩 경로(`src/types/lucide-react.d.ts`)를 못 덮어 수동 `eslint-disable`로 회피 중 — 과거 워크트리 사고와 같은 "`**/` 누락" 패턴 재발 | 🟡         |
| B5  | "warn이라 실패 안 한다"는 주석이 실제(`--max-warnings 0`)와 정반대                                                                                          | 🟢(주석만) |
| B6  | `import/resolver` 설정이 실제로 아무 규칙에도 안 쓰임                                                                                                       | 🟢         |
| B7  | 설치만 되고 config에 미연결된 ESLint 패키지 4개: `eslint-plugin-react`, `eslint-config-react`, `eslint-plugin-react-refresh`, `eslint-plugin-zustand`       | 🟢         |
| B9  | `ALLOWED_ACRONYMS` 예외 매칭 0개(레포에 `UI`로 시작하는 파일명 없음)                                                                                        | 🟢         |

## (C) 남은 미확인 판단 항목 — 실행 중 순차적으로 물어봄

아래는 이번 라운드에서 아직 사용자에게 확인하지 못한 애매한 항목들이다(3개 에이전트가 총
40여 건의 ❓를 보고했고, 이번엔 가장 시급한 3건만 확인받았다). **1단계 실행을 진행하면서
이 중 실제로 손을 대야 하는 시점에 도달하면, 그때마다 개별적으로 물어본다** — 한 번에
40개를 다 묻지 않는다.

우선순위가 높아 보이는 것들(코드 동작에 실질적 영향, 또는 문서 신뢰도에 직결):

- FE-ARCHITECTURE.md §5: "레이어를 절대 안 건너뛴다"는데 실제로 `useSignUp.ts`·`useUpdateAccount.ts`가 Layer 3(`*.queries.ts`)를 건너뛰고 Layer 1(`*.api.ts`)을 직접 호출 — 의도된 예외인지 위반인지
- CLAUDE.md: 성공 토스트 결정표에서 `postUpdated`가 "불필요" 분류인데 실제로는 지금도 토스트가 뜨고 있음 — 표를 갱신할지, 코드에서 토스트를 뺄지
- CLAUDE.md: `.prettierignore`에 `**/` prefix가 없는 것 — 과거 사고와 같은 패턴인데 실제로 문제를 일으키는지 재현 필요
- eslint.config.js B2 관련: FSD `no-restricted-imports`가 `src/mocks/**`·`src/main.tsx`·`src/types/**`에는 적용 안 됨 — 의도된 제외인지

나머지 30여 건(주로 표 안의 사소한 항목, 링크 상대경로, ❓ 사유가 "확실히 알 수 없다"류)은
1단계 작업이 그 파일에 닿을 때 맥락과 함께 물어보는 것으로 미룬다.

## 실행 순서

1. **(C1~C3) 확정 항목 실행** — FSD 공식 문서 조사 후 entities/features UI 배치 규칙 재검토
   (재검토 중 발견되는 추가 불일치는 즉시 질문), raw button → Button 컴포넌트 교체(20여곳),
   `.npmrc`에 `engine-strict=true` 추가
2. **(A) 문서 정정 10건** — 리스크 낮음, 순차 진행. 각 항목은 "문서 vs 코드"만 비교하는
   기계적 수정이라 판단 여지가 적다
3. **(B) 설정 정리** — 🔴 2건(B1, B2)부터 사용자에게 "고칠지/제거할지/그대로 둘지" 확인 후
   진행. 🟡·🟢는 (A)·(B1·B2) 완료 후 이어서
4. **(C) 나머지 항목** — 1~3단계 작업 중 자연스럽게 마주치는 순서대로 확인하며 처리

## Critical Files

- `docs/FE-ARCHITECTURE.md` — (A5~A10), (C1) 대상
- `.claude/CLAUDE.md` — (A1~A4, A10), (C1, C3) 대상
- `eslint.config.js` — (B1~B10) 대상
- `.npmrc` — (C3) 대상
- `src/widgets/bookmark/folder-tree/ui/FolderTree.tsx`, `MobileFolderList.tsx` 등 raw button
  20여 곳 — (C2) 대상(정확한 전체 목록은 실행 단계에서 `grep -rn "<button" src --include="*.tsx" | grep -v shared/ui`로 재추출)

## 검증 방법

- (A) 각 정정 후 `pnpm check:docs` 통과 확인
- (B1, B2) 결정된 수정 후 의도적으로 위반 코드를 넣어 규칙이 잡는지 확인(화살표 함수 훅에서
  getState 호출, 디렉터리 배럴 import) → 원복
- (C2) 전체 교체 후 `pnpm lint`·`pnpm test`·`pnpm type-check` 통과, Storybook에서 시각적
  회귀 없는지 확인
- (C3) `.npmrc` 수정 후 실제로 Node 20 등 다른 버전에서 `pnpm install`이 에러로 중단되는지
  실측(가능하면 nvm으로 재현, 어려우면 문서만이라도 "미검증, 설정상 강제되어야 함"으로 정직하게 표시)
