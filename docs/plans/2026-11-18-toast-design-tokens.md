# 토스트 종류별 색을 디자인 토큰에서 파생

<!-- plan-result:start — 이 블록만 병합 뒤에도 고칠 수 있다(.claude/CLAUDE.md "계획과 PR 본문"). 아래는 승인된 계획 원문 -->

## 구현 결과

> #646 · 2026-11-18 대조 · 이탈 1 · 미구현 0 — 판정 근거(파일:줄)는 PR 본문 "계획 대비 구현"

- 시안은 후보 2(글자 = 토큰 60 : 본문색 40)로 정해짐. 배경 8%·테두리 30%는 계획 그대로
- 이탈(절차) → 보완함: 반영 뒤 화면과 대비 표를 커밋 전에 보여 주기로 했으나, 반영 값이 후보 2와 같아 화면을 열어 둔 채 로컬 커밋을 먼저 하고 표와 화면 경로는 커밋 직후(PR 전)에 알림
- 계획에 없던 변경: sonner 기본 색의 밝은 테마 대비 측정값(네 종류 모두 4.5 미달)과 "대비는 검사로 지키지 않는다"는 대가를 `DECISIONS.md`·`CHANGELOG.md`에 실음
- 문서 동기화: `PLANS-INDEX.md`에 빠져 있던 #644 계획 행 추가, `DESIGN-SYSTEM.md` 마지막 검토 날짜 갱신과 §8 표 서식

<!-- plan-result:end -->

> 오류·경고·성공·안내 토스트의 배경·테두리·글자색을 sonner `richColors` 고정 색 대신 `globals.css` 토큰
> (`--destructive`·`--warning`·`--success`·`--info`)에서 만든다. 토큰을 바꾸면 토스트 색도 따라 바뀐다.

## Context

- 지금 토스트 색은 sonner 2.0.8이 정한 고정 색이다. `src/shared/ui/atoms/sonner.tsx:21`의 `richColors`가 켜져 있고,
  sonner CSS가 종류별 변수 12개(`--{success|error|warning|info}-{bg|border|text}`)를
  `[data-sonner-toaster][data-sonner-theme]`에 밝은·어두운 값으로 정의한다. 이 레포의 토큰과 이어져 있지 않다.
- 사용자 요청(2026-11-18): 회사들은 디자인 토큰으로 색을 관리한다. sonner 기본 색이면 토큰을 바꿔도 토스트는
  안 따라온다. 토큰으로 맞춘다. #643의 후속이고 별도 PR로 하기로 했다.
- sonner CSS는 레이어 밖이라 `@layer` 안의 Tailwind 클래스로는 못 이긴다. 같은 파일이 이미 인라인 `style`로
  글꼴을 덮고 있다(`sonner.tsx:25-27`).
- 미리보기에서 잰 값(Storybook, `getComputedStyle`로 글자·배경색을 읽어 대비 계산):

  | 방식 | 밝은 테마 안내 · 경고 · 오류 · 성공 | 어두운 테마 |
  | --- | --- | --- |
  | A(옅은 배경) + 글자 = 토큰 색 그대로 | 4.16 · 1.98 · 4.28 · 4.15 | 6.2~8.8 |

  토큰 색을 글자에 그대로 쓰면 밝은 테마 네 종류 모두 4.5에 못 미친다.
- 기준: WCAG 1.4.3은 일반 글자 4.5:1, 큰 글자(18pt 또는 14pt 굵게) 3:1을 요구한다
  ([WCAG 2.2 1.4.3](https://www.w3.org/TR/WCAG22/#contrast-minimum)). 토스트 제목은 14px·굵기 600이라 큰 글자에
  들지 않는다고 보고 4.5를 적용한다(제 계산: 14px ≈ 10.5pt).
- 선례(조사 에이전트 보고, 재인용)
  - Radix Colors는 한 색을 12단계로 나눠 배경용과 글자용을 따로 둔다. _"9·10단계는 채운 배경용"_, _"11단계는
    낮은 대비 글자, 12단계는 높은 대비 글자"_ (번역, [Radix Colors](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale)).
  - shadcn/ui의 sonner 컴포넌트는 인라인 `style`로 sonner 변수(`--normal-bg` 등)를 토큰에 잇는다
    ([shadcn/ui sonner](https://ui.shadcn.com/docs/components/sonner)). 종류별 색은 잇지 않고 `richColors`도 안 쓴다.
- 브라우저: `color-mix()`는 2023년 5월부터 주요 브라우저에서 쓸 수 있다(재인용,
  [MDN color-mix](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/color-mix)). 이 레포 지원 범위
  (Chrome 111·Safari 16.4·Firefox 128, `docs/VERSION-COMPATIBILITY.md:64`)의 빌드 CSS에 이미 `color-mix`가 있다.

## 판단이 필요했던 항목

| 항목 | 결정 | 근거·기각한 대안 |
| --- | --- | --- |
| 배경 방식 | A안: 종류별 옅은 배경·테두리를 유지하되 토큰에서 만든다 | 사용자 선택("A로 진행"). 기각 B: 배경은 기본 바탕색, 제목·아이콘만 색(대비는 조금 높지만 종류가 한눈에 덜 구분된다) |
| 글자색 | 토큰 색에 본문색(`--foreground`)을 섞은 글자용 색. 네 종류 모두 4.5:1 이상 | 사용자 선택(질문 2번). 기각: 토큰 색 그대로(위 표, 4.5 미달) · 경고만 본문색(경고만 제목 색이 없어 틀이 어긋난다) |
| 섞는 비율 | 시안을 화면으로 보고 사용자가 고른다(아래 "시안 후보") | 취향이 갈리는 값이다 |
| 구현 위치 | `sonner.tsx`의 인라인 `style`에서 sonner 변수 12개를 덮는다 | 레이어 문제를 피하는 기존 방식(`fontFamily`)과 shadcn 선례. 기각: `unstyled` + `classNames`로 전부 다시 그리기(배치·닫기 버튼까지 다시 만들어야 한다) · 안내 토스트(`showNoticeToast`)에만 색 입히기(한 줄 토스트와 색이 달라진다) |
| 새 토큰을 `globals.css`에 둘지 | 두지 않는다. 기존 토큰 4개에서 바로 섞는다 | 쓰는 곳이 토스트 하나다. 다른 곳에서도 글자용 색이 필요해지면 그때 토큰으로 올린다 |
| 위험 | sonner가 문서화하지 않은 변수에 기댄다 | sonner를 올릴 때 변수 이름이 바뀌면 조용히 기본 색으로 돌아간다. `docs/DESIGN-SYSTEM.md`에 "sonner를 올리면 토스트 색 확인"을 적는다 |
| 커밋 종류·CHANGELOG | `feat(shared)`, CHANGELOG `[Unreleased]`에 항목 | 앱의 모든 토스트 색이 바뀐다 |

### 시안 후보

구현 전에 Storybook에서 CSS만 주입해 세 후보를 밝은·어두운 테마로 찍고, 후보마다 네 종류의 대비 값을 함께
보여 준다. 고른 뒤에 파일에 반영한다. 4.5에 못 미치는 종류가 있는 후보는 그렇게 표시한다.

| 후보 | 배경 (토큰 : `--background`) | 테두리 | 글자 (토큰 : `--foreground`) |
| --- | --- | --- | --- |
| 1 | 8 : 92 | 30 : 70 | 70 : 30 |
| 2 | 8 : 92 | 30 : 70 | 60 : 40 |
| 3 | 8 : 92 | 30 : 70 | 50 : 50 |

배경 8%·테두리 30%는 사용자가 고른 A안 미리보기의 값이다. 경고가 어느 후보로도 4.5를 못 넘으면 경고만 다른
비율을 쓰는 안을 화면과 함께 다시 묻는다.

## 세부 계획

| 위치 | 변경 내용 |
| --- | --- |
| `src/shared/ui/atoms/sonner.tsx` | `style`에 변수 12개를 더한다. `--error-*`는 `--destructive`, `--success-*`는 `--success`, `--warning-*`는 `--warning`, `--info-*`는 `--info`에서 `color-mix(in oklab, …)`로 만든다. 종류 4개 × 역할 3개를 모듈 상수 하나로 만들고 주석에 이유(레이어, 문서화 안 된 변수)를 적는다. `richColors`는 그대로 둔다 |
| `src/shared/ui/atoms/sonner.stories.tsx` | 바꾸지 않는다(기존 `Kinds`·`Notice`가 새 색을 그대로 보여 준다). 스토리 설명에 색 출처를 적은 문장이 있으면 그 문장만 고친다 |
| `docs/DESIGN-SYSTEM.md`(토스트 행, 196행 부근), `.claude/skills/design-tokens/SKILL.md` | 토스트 색이 토큰에서 나온다는 것, 고른 비율, sonner를 올릴 때 확인할 것 |
| `docs/FE-ARCHITECTURE.md` §14 | 토스트 색 한 줄 |
| `docs/DECISIONS.md` + `scripts/lib/decision-topics.json` + `pnpm docs:index` | 새 항목: A안·글자용 색·기각한 대안·정해진 경로(질문) |
| `CHANGELOG.md` | `[Unreleased]` 항목(`changelog-release` skill 형식) |
| `docs/UNSAVED-CHANGES-GUARD.md` | `toast-layout.ts:16-22` → 실제 줄 번호(#642 뒤로 밀려 있다) |
| `docs/plans/2026-11-18-toast-design-tokens.md` (신규) | 이 계획을 복사해 같은 PR에 커밋 |

## 영향 범위

- 화면: 앱의 모든 오류·경고·성공·안내 토스트(한 줄 토스트와 안내 토스트)의 배경·테두리·글자·아이콘·닫기 버튼 색이
  바뀐다. 종류 없는 기본 토스트와 로딩 토스트, 위치·지속 시간·문구는 그대로다.
- 깨질 수 있는 것
  - `sonner.tsx`는 앱 루트에서 한 번 쓰인다. 사용처는 구현 전에 `pnpm graph:focus "src/shared/ui/atoms/sonner.tsx" --text`로 뽑는다.
  - 안내 토스트의 설명은 `!text-foreground`, 한 줄 토스트의 설명은 `text-muted-foreground`다. 새 배경 위에서 읽히는지
    함께 잰다.
  - 버튼(`bg-primary`)과 닫기 버튼(`text-muted-foreground`)이 새 배경 위에서 보이는지 화면으로 확인한다.
  - 색을 단정하는 테스트·e2e가 있는지 검색한다(단위 테스트는 sonner를 모킹해 색을 보지 않는다, `src/test/setup.ts:73-75`).
- 데이터 계약·API 변경 없음. 되돌리기는 `style`의 변수를 지우면 된다.

## 검증 방법

완료 조건: 네 종류 토스트의 배경·테두리·글자색이 토큰에서 계산되고, 밝은·어두운 테마 모두 제목·설명 대비가
4.5:1 이상이며, 사용자가 고른 시안과 같은 화면이 Storybook에 보인다. 토스트의 위치·지속·문구는 바뀌지 않는다.

1. 시안 3개를 찍어 보여 주고 고르기(파일 수정 전)
2. 반영 뒤 Storybook `Kinds`·`Notice`·`NoticeLeftPageFailure`를 밝은·어두운 테마로 찍고, 종류마다
   `getComputedStyle`로 제목·설명·배경색을 읽어 대비를 계산한 표를 낸다. 커밋 전에 사용자에게 보여 준다
3. 토큰을 따라가는지: Storybook에서 `--destructive`를 다른 색으로 잠깐 바꿔 오류 토스트 색이 따라 바뀌는지 확인
4. `pnpm type-check` → `pnpm test` → `pnpm lint` → `pnpm check:deps` → `pnpm check:docs` → `pnpm docs:index`
5. e2e: 토스트가 나오는 `e2e/post-create.spec.ts`
6. 자동 테스트를 새로 쓰지 않는 이유: 색 변경이고 jsdom은 `color-mix` 계산값을 주지 않는다. 증거는 2·3번이다
7. 절차: 워크트리 → 커밋 → `plan-verifier` 대조 → PR(`pnpm check:pr-body`) → CI → 병합은 사용자 승인 뒤 →
   배포 워크플로 확인 → 운영에서 토스트 색 확인 → 워크트리 정리

## 남은 것

- 대비 4.5를 Storybook 브라우저 테스트(`pnpm test:storybook`)로 계속 지키게 할지는 이 PR에 넣지 않았다. 원하면
  따로 묻는다.
