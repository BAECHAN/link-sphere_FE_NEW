# 떠난 뒤 실패 토스트를 구조 이름의 안내 토스트(`showNoticeToast`)로 일반화

<!-- plan-result:start — 이 블록만 병합 뒤에도 고칠 수 있다(.claude/CLAUDE.md "계획과 PR 본문"). 아래는 승인된 계획 원문 -->

## 구현 결과

> #643 · 2026-11-18 대조 · 이탈 3 · 미구현 0 — 판정 근거(파일:줄)는 PR 본문 "계획 대비 구현"

- 이탈(의도): 옛 이름이 현행 문서에서 0건이 되지 않음 — `DECISIONS.md` 새 항목과 `UNSAVED-CHANGES-GUARD.md` §5에 "`showLeftPageFailureToast`를 일반화했다"는 경위 문장을 일부러 남겼고, #641의 과거 결정 항목은 덧붙이기만 하는 기록이라 그대로 둠. `src`·`e2e`·`eslint.config.js`는 0건
- 이탈(절차) → 보완함: `NoticeLeftPageFailure`의 어두운 테마 화면을 첫 커밋 전에 보여 주지 않음. PR을 열기 전에 찍어 보여 줌
- 이탈(절차) → 보완함: 구현 전에 `pnpm graph:focus`로 사용처를 뽑지 않음. 대조 뒤에 돌렸고 결과는 계획의 훅 5개와 같음
- 계획에 없던 변경: 계획이 #641 병합 전 코드 기준이라, 같은 날 #641의 "함수 이름은 그대로" 결정을 뒤집는 `DECISIONS.md` 항목 "안내 토스트"를 새로 씀
- 계획에 없던 변경: 결정 색인 주제 파일에 새 항목과 주제가 빠져 있던 #641 항목을 "오버레이·대화상자"로 등록
- 계획에 없던 변경: 새 테스트에 배치·글자 클래스 단언 추가
- 문서 동기화: 결정·계획 색인 재생성(#641 행 포함), 두 문서의 "마지막 검토" 날짜
- 후속: "남은 것"의 색 판단은 사용자가 디자인 토큰으로 맞추기로 정했고, 앱의 모든 토스트 색이 바뀌어 별도 PR로 함

<!-- plan-result:end -->

> `showLeftPageFailureToast`(에러·`!` 아이콘·무한 지속 고정)를 종류·아이콘·지속 시간·id를 옵션으로 받는
> `showNoticeToast` 하나로 바꾼다. 지금 화면 동작은 그대로다.

## Context

- `src/shared/lib/toast/LeftPageFailureToast.tsx`의 `showLeftPageFailureToast`는 모양(아이콘 · 색 제목 · 본문색 설명 ·
  아래 버튼, 설명은 문장마다 줄바꿈)과 "떠난 뒤 실패" 전용 동작(`toast.error` 고정, `duration: Infinity` 고정,
  id `left-page-failure:<key>` 고정)을 한 몸에 갖고 있다.
- 사용자 요청(2026-11-18): 이 모양은 다른 곳에서도 쓸 수 있으니 이름을 구조 기준으로 바꾸고, 에러에만 묶이지 않게
  하고, 아이콘도 `!` 하나로 고정되지 않게 한다.
- 사용처는 훅 5개의 6곳이다: `useSignUp.ts`(2곳), `useCreatePost.ts`, `useUpdatePost.ts`, `useCreateComment.ts`,
  `useUpdateComment.ts`. 스토리는 `src/shared/ui/atoms/sonner.stories.tsx`의 `LeftPageFailure`.
- 설치본 sonner 2.0.8의 `ExternalToast`는 `icon?: React.ReactNode`, `duration?: number`, `id?: number | string`을
  받는다(`node_modules/sonner/dist/index.d.ts:53,60,126`).
- 업계 조사(조사 에이전트 보고, 원문 재인용):
  - Ant Design notification(`icon`·`duration`·`key`), Mantine notifications(`icon`·`autoClose`·`id`), Atlassian
    Flag(`appearance`·`icon`·`autoDismissSeconds`·`id`) 모두 종류·아이콘·지속 시간·식별자를 호출하는 쪽 옵션으로 받는다
    ([Ant Design](https://ant.design/components/notification), [Mantine](https://mantine.dev/x/notifications/),
    [Atlassian Flag](https://atlassian.design/components/flag/code)).
  - Atlassian은 _"에러 플래그는 절대 자동으로 닫히게 하지 마세요."_ (번역,
    [Atlassian Flag examples](https://atlassian.design/components/flag/examples))라고 쓰고 경고 플래그에도 같은 지침을 둔다.

## 판단이 필요했던 항목

| 항목 | 결정 | 근거·기각한 대안 |
| --- | --- | --- |
| 이름 | `showNoticeToast`, 파일 `NoticeToast.tsx` | 사용자 선택(질문). 기각: `showDetailToast`, `showTitledToast` |
| 아이콘·색 | `variant`(`error`·`success`·`warning`·`info`)가 기본 아이콘과 제목 색을 정하고 `icon`으로 아이콘만 교체 | 사용자 선택(질문). 기각: 종류만 받기(아이콘이 sonner 기본 4종으로 한정) |
| 전용 동작(무한 지속·교체 id) | 함수 하나. `error`·`warning`은 기본으로 닫을 때까지 남고 `duration`으로 바꿀 수 있다. `id`는 호출부가 넘긴다 | 사용자 선택(질문, C안). 근거는 Context의 Atlassian 지침. 기각 A: `showLeftPageFailureToast`를 얇은 함수로 남김(사용자: 이름이 무관해 보이고 갇혀 있다). 기각 A': `showLeftPageFailureNoticeToast`로 이름을 물려받음. 기각 B: 기본값 없이 호출부가 `duration`까지 넘김(빠뜨리면 4초 뒤 사라지고 검사로 못 잡는다) |
| `variant` 기본값 | 두지 않고 필수 | 종류를 조용히 추측하지 않게 한다 |
| id 값 | 지금 값(`left-page-failure:<폼 키>`) 그대로, 호출부가 전체 문자열을 넘긴다 | 기존 테스트 단언(`id`, `duration: Infinity`)을 바꾸지 않는다 |
| 문구 키 | `TEXTS.messages.error.leftPageFailure.*` 그대로 | 구조가 아니라 "떠난 뒤 실패"라는 내용의 문구다 |
| 스토리 | `Notice`(종류 4개 + 아이콘 교체 + 버튼 없음)를 새로 두고, 기존 실제 문구 7개는 `NoticeLeftPageFailure`로 이름만 바꿔 남긴다 | `docs/UNSAVED-CHANGES-GUARD.md`가 7개 경우를 참고본으로 가리킨다 |
| 위치 정책 | `toast.ts` 래퍼를 그대로 거친다(`success`는 하단, 나머지는 상단) | 기존 카테고리별 위치 정책(`toast.ts:3-10`)을 따른다 |
| CHANGELOG | 항목 없음 | 화면 동작이 바뀌지 않는 리팩터링이다 |

## 세부 계획

| 위치 | 변경 내용 |
| --- | --- |
| `src/shared/lib/toast/NoticeToast.test.tsx` (신규) | 먼저 쓴다. `error`·`warning`은 `duration: Infinity`, `success`·`info`는 `duration` 미지정, `duration`을 넘기면 그 값, `icon`·`id`·`action`이 그대로 전달, `variant`별로 `toast`의 해당 메서드 호출, 설명이 문장마다 나뉨. 구현 전 실패 출력을 남긴다 |
| `src/shared/lib/toast/LeftPageFailureToast.tsx` → `NoticeToast.tsx` (`git mv`) | `showNoticeToast({ variant, title, description, icon?, duration?, id?, action? })`로 바꾼다. `toast[variant](...)` 호출, `key` → `id`(접두어 없음), `duration`은 넘긴 값 또는 종류별 기본값, `icon`은 넘겼을 때만 전달. `CLASS_NAMES`와 문장 나누기는 그대로. 주석은 구조 설명으로 고치고 "떠난 뒤 실패" 설명은 문서 링크만 남긴다 |
| `src/features/auth/signup/hooks/useSignUp.ts`, `post/create/hooks/useCreatePost.ts`, `post/update/hooks/useUpdatePost.ts`, `comment/create/hooks/useCreateComment.ts`, `comment/update/hooks/useUpdateComment.ts` (6곳) | import와 호출을 `showNoticeToast`로 바꾸고 `variant: 'error'`, `` id: `left-page-failure:${기존 key}` ``를 넘긴다. `duration`은 넘기지 않는다 |
| 위 훅들의 테스트 5개 | 단언은 바꾸지 않는다. 모듈 경로·함수 이름을 직접 가리키는 곳이 있으면 이름만 맞춘다 |
| `src/shared/ui/atoms/sonner.stories.tsx` | `Notice` 스토리 추가, `LeftPageFailure` → `NoticeLeftPageFailure`(호출을 `showNoticeToast`로) |
| `eslint.config.js:149` | 안내 문구의 `LeftPageFailureToast.tsx` → `NoticeToast.tsx` |
| `docs/FE-ARCHITECTURE.md:1312-1313`, `docs/UNSAVED-CHANGES-GUARD.md`(함수·파일·스토리 이름과 `파일:줄` 10곳 남짓) | 새 이름·경로·줄 번호로 고치고, UNSAVED-CHANGES-GUARD §5에 "에러·경고 안내 토스트는 기본으로 닫을 때까지 남는다"를 한 줄 적는다 |
| `docs/plans/2026-11-18-notice-toast.md` (신규) | 이 계획을 복사해 같은 PR에 커밋한다 |

고치지 않는 것: `docs/plans/`의 과거 계획, `CHANGELOG.md`의 과거 항목, `texts.ts`, `.claude/skills/texts-conventions/SKILL.md`.

## 영향 범위

- 화면: 떠난 뒤 실패 토스트 6곳의 모양·지속·교체 동작은 그대로다. 새로 생기는 것은 이 모양의
  `success`·`warning`·`info` 변형인데 앱에서 쓰는 곳은 아직 없고 스토리에만 보인다.
- 깨질 수 있는 것
  - 호출부가 `id`를 빠뜨리면 같은 폼의 실패 토스트가 쌓인다 → 기존 테스트 5개가 `id` 값을 단언한다.
  - `success`·`warning`·`info`의 제목 색은 sonner `richColors`에서 온다. 밝은·어두운 테마에서 읽히는지는 스토리
    화면으로 확인하고, 어색하면 고치기 전에 화면과 함께 사용자에게 묻는다.
  - `LeftPageFailureToast`를 이름으로 가리키는 문서 링크 → `pnpm check:docs`.
- 사용처는 구현 전에 `pnpm graph:focus "src/shared/lib/toast/LeftPageFailureToast.tsx" --text`로 다시 뽑는다.

## 검증 방법

완료 조건: `showLeftPageFailureToast`·`LeftPageFailureToast`가 `src`·`e2e`·`eslint.config.js`·현행 문서에 남지 않고,
떠난 뒤 실패 토스트가 전과 같이 보이며, 새 변형이 스토리에 보인다.

1. 새 테스트의 구현 전 실패 출력 → 구현 뒤 통과. 구현을 일부러 깨서(기본 지속 시간 제거) 실패하는지 한 번 확인
2. `pnpm type-check` → `pnpm test` → `pnpm lint` → `pnpm check:deps` → `pnpm check:docs`
3. e2e: `pnpm test:e2e e2e/post-create.spec.ts e2e/signup-unsaved-changes.spec.ts`
4. 남은 이름 확인: `src`·`e2e`·`eslint.config.js`·`docs`(plans 제외)에서 `LeftPageFailureToast` 검색 결과 0건
5. Storybook에서 `Notice`·`NoticeLeftPageFailure`를 밝은·어두운 테마로 띄워 스크린샷을 사용자에게 보여 준다
   (`browser-verification` skill). 커밋 전에 한다
6. 절차: 워크트리에서 작업 → 커밋(`.gitmessage` 형식, `refactor(shared)`) → `plan-verifier` 대조 → PR →
   CI 확인 → 병합은 사용자 승인 뒤 → 배포 워크플로 확인 → 워크트리 정리

## 남은 것

- `success`·`warning`·`info` 변형의 색이 디자인 토큰과 어긋나 보이면 토큰으로 맞출지 5번 화면을 보고 정한다.
