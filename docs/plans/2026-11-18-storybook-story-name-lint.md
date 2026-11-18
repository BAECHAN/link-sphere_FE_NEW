# Storybook 스토리 이름 린트: 공식 recommended 도입 + `name` 금지

<!-- plan-result:start — 이 블록만 병합 뒤에도 고칠 수 있다(.claude/CLAUDE.md "계획과 PR 본문"). 아래는 승인된 계획 원문 -->

## 구현 결과

> #644 · 2026-11-18 대조 · 이탈 2 · 미구현 0 — 판정 근거(파일:줄)는 PR 본문 "계획 대비 구현"

- 이탈 → 보완함(사용자 결정): 공식 `flat/recommended`가 스토리 파일에서 `react-hooks/rules-of-hooks`를 꺼서 "기존 린트 규칙의 동작은 바꾸지 않는다"에 어긋났다. 사전 측정은 위반 건수만 봐서 이를 놓쳤다. 묶음 바로 뒤에 스토리 파일용 블록을 두어 다시 켰고, §18에 스토리의 훅은 PascalCase 컴포넌트 안에서 쓴다고 적었다
- 이탈(절차): 깨 보기 ①은 테스트 케이스를 옮기지 않고 구현을 깨서(문자열 키 판정을 끔) 그 케이스가 실패하는지 봤다

<!-- plan-result:end -->

> 스토리 사이드바 이름을 export 이름 하나로 정하고, 이를 린트로 막는다. 공식 `eslint-plugin-storybook`의 `flat/recommended`도 함께 켠다.

<!-- no-diagram: 단계가 한 줄로 이어지는 설정 변경이라 흐름 그림이 필요 없다 -->

## Context

- **요청(2026-11-18)**: `dropdown-menu.stories.tsx`의 `비제어형 — click으로 열림`을 `Uncontrolled`로 바꾸고, 한글 수식어나 설명 수식어가 스토리 이름에 다시 들어오지 않게 린트로 막는다. 업계의 Storybook 린트 관행을 확인한다.
- **현재**
  - `ClickToOpen` export에 `name: '비제어형 — click으로 열림'`(`src/shared/ui/atoms/dropdown-menu.stories.tsx:203-204`)이 있다. 짝인 `Controlled`(`:237`)는 `name` 없이 "Controlled"로 보인다. 둘은 #152 계획(`docs/plans/2026-09-21-dropdown-trigger-click.md:141`)이 "제어형/비제어형 두 가지"로 함께 넣은 짝이다.
  - 저장소 전체에서 스토리 `name:`은 이 1곳뿐이다(grep). 스토리 id(`…--click-to-open`)를 가리키는 코드·문서는 없다.
  - Storybook 린트는 직접 만든 `custom-storybook/title-matches-path` 하나뿐이다(`eslint.config.js` "Storybook 스토리 title" 블록). `eslint-plugin-storybook`은 설치돼 있지 않다.
- **업계 조사**
  - 공식 플러그인 `eslint-plugin-storybook`은 Storybook 9부터 모노레포 안에서 관리된다. 버전은 Storybook과 함께 나온다(npm 10.6.6/10.6.7, peer `eslint >=8`, 레지스트리에서 확인).
  - 이름의 언어를 제한하거나 `name` 자체를 금지하는 공식 규칙은 없다. `no-redundant-story-name`은 export에서 자동으로 만든 이름과 같은 `name`만 잡는다. 공식 문서는 `name`을 "더 설명적인 이름"용으로 허용한다(조사 에이전트 보고, [규칙 문서](https://github.com/storybookjs/storybook/blob/next/code/lib/eslint-plugin/docs/rules/no-redundant-story-name.md)·[Writing stories](https://storybook.js.org/docs/writing-stories)). 그래서 `name` 금지는 우리가 정한 더 엄격한 규칙이다.
  - 실제 사례(설정 파일을 직접 받아 확인): [primer/react](https://github.com/primer/react/blob/main/eslint.config.mjs)는 `flat/recommended`, [Shopify/polaris-react](https://github.com/Shopify/polaris-react/blob/main/.eslintrc.js)는 `recommended`·`csf`·`csf-strict`를 켠다.
- **사전 측정(워크트리, 미커밋)**
  - `eslint-plugin-storybook@10.6.6`을 설치하고 임시 설정에 `flat/recommended`를 더해 `src/**/*.stories.tsx`와 `.storybook`을 검사했다. 위반은 0건이었다. `--print-config`로 확인하니 스토리에 10개 규칙, `.storybook/main.ts`에 `no-uninstalled-addons`가 켜져 있었다.
  - 심각도는 warn 3개(`hierarchy-separator`·`no-redundant-story-name`·`prefer-pascal-case`), 나머지는 error다. `pnpm lint`가 `--max-warnings 0`이라 경고도 막힌다.
  - `prefer-pascal-case`는 suggest로만 고친다. 그래서 pre-commit `--fix`가 export 이름(=스토리 URL)을 조용히 바꾸지 않는다(설치본 `dist/index.js` `prefer-pascal-case` 절).

## 판단이 필요했던 항목

| 항목 | 결정 | 근거·기각한 대안 |
| --- | --- | --- |
| 린트 범위 | 공식 `flat/recommended` + 직접 규칙 `custom-storybook/no-story-name` | 2026-11-18 질문에 사용자가 B를 골랐다. 기각: A(직접 규칙만)는 업계 표준 규칙이 빠진다. C(`name`에 한글만 금지)는 영어 수식어를 막지 못한다 |
| 직접 규칙이 막는 것 | 내보낸 스토리 객체(`export const X = {…}`, `satisfies`/`as` 포함)의 **최상위 `name` 속성** | `args.name`처럼 컴포넌트 prop으로 쓰는 `name`(`FormInput.stories.tsx` 등)은 막지 않는다. CSF2의 `X.storyName = …`은 저장소에 쓰는 곳이 없어 다루지 않는다 |
| 자동 수정 | 두지 않는다 | `title-matches-path`와 같은 방침이다. 메시지로 "export 이름을 바꾸라"고만 안내한다 |
| 규칙 파일 위치 | `scripts/lib/no-story-name-rule.js` + `.d.ts`, RuleTester 테스트 | 선례: `no-literal-jsx-text-rule.js`와 `src/test/scripts/no-literal-jsx-text-rule.test.ts` |
| 플러그인 버전 | `^10.6.6`(설치된 `storybook` 10.6.6과 같은 줄) | 다른 Storybook 패키지가 모두 `^10.6.6`이다. 측정 때 `-E`로 넣은 정확 고정은 캐럿으로 바꾼다 |
| 새 export 이름 | `ClickToOpen` → `Uncontrolled`, `name` 삭제 | 사용자 요청이다. `Controlled`와 짝이 맞는다. 공개 Storybook URL `…--click-to-open`이 `…--uncontrolled`로 바뀌지만, 이를 가리키는 곳은 없다 |
| CHANGELOG | 넣지 않는다 | 앱 동작이 바뀌지 않는다. 선례: `title-matches-path` 도입도 CHANGELOG에 없다 |

## 세부 계획

| 위치 | 변경 내용 |
| --- | --- |
| `package.json`, `pnpm-lock.yaml` | devDependency `eslint-plugin-storybook` `^10.6.6` |
| `eslint.config.js` (import, 설정 배열) | `import storybook from 'eslint-plugin-storybook'`, Storybook 블록 근처에 `...storybook.configs['flat/recommended']` |
| `eslint.config.js` "Storybook 스토리 title" 블록 | `custom-storybook` 플러그인에 `no-story-name` 등록, `'error'`. 블록 주석에 한 줄 추가 |
| `scripts/lib/no-story-name-rule.js` (신규), `.d.ts` (신규) | 위 "직접 규칙이 막는 것"의 규칙. 메시지: 스토리 이름은 export 이름에서 나오니 `name`을 지우고 export 이름을 바꾸라 |
| `src/test/scripts/no-story-name-rule.test.ts` (신규) | valid: `name` 없음, `args: { name }`, meta의 속성들. invalid: `name: '…'`, `satisfies Story`로 감싼 경우 |
| `src/shared/ui/atoms/dropdown-menu.stories.tsx:203-204` | `export const Uncontrolled`, `name` 줄 삭제 |
| `docs/FE-ARCHITECTURE.md` §18 "Storybook 스토리" | **이름** 문단 추가: 사이드바 이름은 export 이름(PascalCase)만 쓰고, `name`은 쓰지 않으며, 두 규칙이 강제한다 |
| `docs/FE-ARCHITECTURE.md` 린트 규칙 표(`custom-storybook/title-matches-path` 행 아래) | `custom-storybook/no-story-name`, `storybook/*`(flat/recommended) 행 추가 |
| `.claude/CLAUDE.md` 스토리 Never 줄(116행 근처) | "스토리 이름은 export 이름만(`name` 금지, `custom-storybook/no-story-name`)" 한 구절 추가 |
| `docs/plans/2026-11-18-storybook-story-name-lint.md` (신규) | 이 계획의 스냅샷 |

## 영향 범위

- 앱 런타임 코드는 바뀌지 않는다. 바뀌는 것은 린트 설정, 스토리 1개, 문서다.
- `eslint.config.js`를 쓰는 pre-commit(lint-staged)·`pnpm check`·CI·배포 게이트가 새 규칙을 따른다. 지금 위반은 0건이라(측정) 막히는 PR은 없다.
- 공개 Storybook에서 해당 스토리의 이름이 "Uncontrolled"로, URL이 `…--uncontrolled`로 바뀐다.

## 검증 방법

- `pnpm check`(type-check·lint·format:check·check:deps), `pnpm test`(새 RuleTester 포함), `pnpm test:storybook`, `pnpm check:docs`
- 일부러 깨 보기(커밋하지 않고 되돌린다)
  - ① RuleTester invalid 케이스를 valid로 옮겨 테스트가 실패하는지 본다.
  - ② 스토리에 `name: 'x'`를 넣고 lint-staged와 같은 `eslint --max-warnings 0 <파일>`이 `custom-storybook/no-story-name`으로 실패하는지 본다.
  - ③ export를 `uncontrolled`로 바꾸고 `storybook/prefer-pascal-case`가 실패하는지 본다.
- 로컬 Storybook에서 사이드바가 "Uncontrolled / Controlled"로 보이는 화면을 확인한다.
- PR CI가 통과하고 영향 그래프 댓글이 붙는지 확인한다.

**완료 조건**: 위 명령이 모두 통과하고, 깨 보기 ①②③이 실패로 잡히고, 사이드바 화면을 확인하고, PR CI가 녹색이다. **바꾸면 안 되는 것**: 다른 스토리의 export 이름·title, 기존 린트 규칙의 동작.

## 남은 것

- 병합은 사용자 승인 뒤에 한다.
- `.storybook/`은 지금도 `flat/recommended`의 `no-uninstalled-addons` 대상이다. 앞으로 addon을 지우거나 바꿀 때 이 규칙이 함께 걸린다.
