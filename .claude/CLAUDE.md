# Link-Sphere FE — Claude Code Guide

> **행동 원칙은 공통 지침에 있다.** 확인하고 말하기·범위·사용자가 정할 것·전달, 개발 절차(계획·완료의 정의·사람 승인),
> 테스트, 안전·권한, 기록은 `~/project/claude-base/CLAUDE.md`가 정본이고 `~/.claude/CLAUDE.md`가 import한다. 이 파일은
> 이 레포의 사실·명령·컨벤션만 담는다. 공통 지침은 원격이 없는 로컬 저장소라 이 기계 밖 세션에는 로드되지 않는다.
>
> **문서 형식 규칙은 [`.claude/rules/docs-format.md`](rules/docs-format.md)에 있다.** `docs/**/*.md`·`README.md`·
> `CHANGELOG.md`를 읽거나 쓸 때 붙는다. 새 문서를 만들기 전에 같은 폴더의 문서를 하나 읽는다(그래야 첫 초안 전에 규칙이 보인다).

---

## 모르는 것은 세 갈래로 다룬다

조용히 하나를 고르지 않는다. "첫 수정 전에 묻는다" 항목은 작업이 사소해도 묻는다.

- **확인한다**: 코드·문서·설치본 소스로 알 수 있는 것, 선례가 하나인 이름·위치·스타일. 읽고 그대로 따른다.
- **첫 수정 전에 묻는다**: ① 요청이 둘 이상으로 읽히고 해석에 따라 건드리는 파일·동작이 달라질 때(해석을 모두 내놓는다)
  ② 요청에 없는데 사용자가 체감하는 동작이 바뀔 때 ③ 색·간격·문구 톤처럼 정답이 없는 선택 ④ 요청 범위를 넘어
  내 제안을 얹을 때 ⑤ 데이터 계약, 인증·세션, 운영 데이터, 배포 순서 ⑥ 키처럼 보이는 값 ⑦ 선례가 없거나 둘 이상인데
  사용자에게 보이는 결과(화면·문구·API 응답·문서 구조)가 달라지는 선택. 무엇이 헷갈리는지 밝히고 공통 지침
  "사용자가 정할 것"대로 묻는다.
- **가정을 밝히고 진행한다**: 사용자에게 보이지 않고 그 변경 안에서 되돌릴 수 있는 구현 세부(지역 이름, 내부 함수 분리,
  테스트 케이스 구성)와 승인된 계획 안의 절차뿐이다. 작업한 턴의 판정 줄 위 `**가정**` 줄에 적고, 없으면 "없음"이라 쓴다.
  어느 갈래인지 모르겠으면 묻는다.

## 공통 지침을 이 레포에서 따르는 법

- **설치본 확인** — 라이브러리 버전은 `package.json`의 범위가 아니라 설치본 `node_modules/<패키지>/package.json`으로 확인한다.
  미니파이돼 읽기 어려우면 같은 패키지의 development 빌드(예: `react-dom/cjs/react-dom.development.js`)나
  `build/modern/*.js`를 읽는다(추적 사례: `docs/SEARCH.md` §10).
- **지역 함수 추출은 추상화 금지의 예외다** — 조건식이 한눈에 안 들어와 이름을 붙이면 의도가 분명해지는 경우, 재사용
  목적이 아니어도 같은 파일 안에서 지역 함수로 추출한다. 공통 유틸로의 승격은 실제로 다른 곳에서도 필요해질 때 한다(근거·선례:
  `docs/DECISIONS.md` 2026-09-27 항목, `TooltipWrapper.tsx`의 `isHoverSuppressed()`).
- **영향 범위** — 여러 곳에서 import하는 파일(공용 훅·컴포넌트, entity api 등)을 고칠 때는 사용처를 기억이나 부분 grep으로
  짐작하지 않는다. `pnpm graph:focus "<경로>" --text`(바로 이웃)나 `pnpm graph "<경로>" --text`(거슬러 올라가 전체)로 실제
  import 사용처를 뽑는다. PR을 열면 CI가 같은 영향 그림을 PR 댓글로 붙이므로(`ci.yml` "PR 영향 그래프"), PR 본문에는
  영향 범위를 한두 줄로 요약한다.
- **시각 변경 미리보기** — 실제로 동작 중인 컴포넌트의 스크린샷이거나, 실제 Tailwind 클래스와 `globals.css` 색 토큰을
  그대로 쓴 목업으로 만든다(근거: `docs/DECISIONS.md` 2026-09-06 "화면 먼저, 그다음 반영").

### 계획과 PR 본문

- **계획 파일** — plan mode로 세운 계획은 `docs/plans/<YYYY-MM-DD>-<slug>.md`로 구현 코드와 같은 PR에 커밋한다. plan mode를
  거치지 않은 사소한 즉시 구현에는 적용하지 않는다. 섹션 구조는 `plan-doc-structure` skill.
- **대조** — PR을 열기 전에 `plan-verifier`(사용자 범위 에이전트, 정본은 `~/project/claude-base/agents/plan-verifier.md`)에
  계획 파일·diff 파일·대화 요약 파일의 경로를 넘긴다. 이 에이전트는 도구가 Read·Grep·Glob뿐이라 `git diff origin/main...HEAD`를
  스크래치패드 파일로 떨궈 넘기고, 대화 요약은 `node ~/project/claude-base/scripts/session-digest.mjs --out <스크래치패드 파일>`로
  만든다(대화가 그대로 들어 있어 커밋하지 않는다). 쓸 수 없으면 general-purpose에 맡긴다 — 내장 Explore·Plan은 CLAUDE.md를
  로드하지 않는다([sub-agents 문서](https://code.claude.com/docs/en/sub-agents)). 평가 방법과 결과는
  `.claude/workflows/plan-verifier-eval.js`와 claude-base `docs/METRICS.md` "실험: 계획 대조 에이전트 평가".
- **PR 본문 `## 계획 대비 구현`** — 대조 결과를 계획 항목별로 "구현됨(파일:줄)/이탈(이유)/미구현"으로 정리하고
  `docs/plans/`의 해당 파일을 링크한다(원문을 PR 본문에 다시 붙이지 않는다). 포맷팅·린트 수정처럼 구현 중 필요했던 세부
  조정은 이탈이 아니다. 계획에 명시된 설계 결정이 다르게 구현된 경우만 이탈이다.
- **구현 결과 블록** — `docs/plans/*.md`는 커밋된 뒤 H1 바로 아래 `구현 결과` 블록(`plan-result:start`~`end`)만 고친다.
  plan-verifier가 낸 초안을 같은 PR에서 붙이고, `파일:줄` 근거는 PR 본문에만 둔다. 다른 계획이 뒤집으면 그 PR에서 이 블록에
  `대체됨: <새 계획>(#PR)`을 덧붙인다. CI(`ci.yml` "docs/plans 불변성 확인")가 블록과 빈 줄을 뺀 나머지의 수정, 계획 파일의
  삭제·개명을 막는다. 블록 형식은 `plan-doc-structure` skill.
- **PR 본문 `## 의도 대비 결과`** — plan mode를 거치지 않은 작업은 원래 요청과 의도를 항목별로 적고, 한 일·결과와 증거·판정
  ("됐음"/"이탈(이유)"/"아직 모름(언제 어떻게 확인하나)")을 단다. 리뷰나 후속 요청으로 바뀌었으면 병합 전에 본문을 PR 전체
  기준으로 다시 쓰고, 병합 뒤에 확인할 약속은 GitHub 이슈로 열어 링크한다. `gh pr create --body-file`로 열기 전에
  `pnpm check:pr-body <본문 파일>`을 돌린다(검사 규칙·근거: `docs/PR-BODY-CHECK.md`).
- **다이어그램 안전망** — 사용자 범위 훅 `~/project/claude-base/hooks/plan-diagram-reminder.sh`가 경로에 `/plans/`가 든 `.md`를
  쓰거나 고친 직후, 150줄(`PLAN_DIAGRAM_MIN_LINES`로 조정) 이상인데 Mermaid 펜스가 없으면 알린다. 흐름이 없는 계획이면
  파일에 `<!-- no-diagram: (이유) -->` 한 줄을 둔다. `docs/plans/`로의 `cp` 복사는 잡지 못하고, git이 추적하는 파일은
  건드리지 않는다.

---

## Critical Rules

- **Never** Node 20으로 작업 진행 → 이 레포는 Node 24(`.nvmrc`) 고정이다. 작업 전 `node -v`가
  `v24`가 아니면 `nvm use`로 맞춘다. `package.json`의 `engines.node`(`>=24`)와 `.npmrc`의
  `engine-strict=true`(2026-09-10 추가)가 함께 있어 다른 버전이면 `pnpm install` 자체가
  에러로 막힌다 — 다만 이 세션은 워크트리 격리(`source` 명령 차단) 때문에 Node 20을 실제로
  깔아 재현 검증은 못 했다(engine-strict의 표준 동작 자체는 npm/pnpm 공식 문서 근거)
- **Never** 운영 DB 임시 조회에 BE 앱 계정·트랜잭션 풀러 6543을 쓰거나 세션 수준 `SET`을 건다 → 항상 읽기 전용 계정으로
  `/opt/homebrew/opt/libpq/bin/psql "service=linksphere-ro" -c "…"`. 쓰기는 사용자가 직접 한다. 계정·접속 설정·사건 경위는 BE
  [`docs/DEPLOY.md` 12장](https://github.com/BAECHAN/link-sphere_BE_NEW/blob/main/docs/DEPLOY.md#12-운영-db-임시-조회-전용-읽기-계정-supabase--적용-완료-2026-10-20)
- **Never** 키처럼 보이는 값을 묻지 않고 파일에 넣는다(공통 지침 "안전·권한") → 이 레포에서는 `.env.example`에 빈 값만 두고,
  값은 `gh secret set` 프롬프트나 파일에서 stdin으로 넘겨 대화에 노출하지 않는다(사고 경위: `docs/FCM-PUSH-NOTIFICATION.md` 시행착오)
- **Never** native `confirm()` → 항상 `useAlertDialog` + `openConfirm` 사용
- **Never** API 레이어 건너뛰기 → API 호출은 반드시 `.api.ts` 에서만. transport(`shared/api/client.ts`)를 빼면 `.api.ts` 밖의
  `fetch`는 정적 파일을 읽는 `version.util.ts`(`/index.html`)·`build-info.util.ts`(`/version.json`) 2곳뿐이다
- **Never** 인라인 쿼리 키 → 항상 `<entity>Keys.*` 사용
- **Never** 인라인 한글 UI 문자열 → 항상 `TEXTS.*` 사용. ESLint `custom-i18n/no-hardcoded-hangul`가 pre-commit(lint-staged)과
  CI·배포의 `pnpm check`에서 막는다(`pnpm build` 자체는 ESLint를 돌리지 않는다). 보간은 `texts.ts`의 함수형 키를 쓴다(예:
  `messages.success.bookmarkSavedTo(folderName)`). 화면 읽기 프로그램이 읽는 문구(`aria-label`, `alt`, `sr-only` 요소 안 글자)는
  영어도 직접 쓰지 않는다(`custom-i18n/no-literal-a11y-name`). JSX 요소 사이에 직접 적은 글자도 언어와 상관없이 막힌다
  (`custom-i18n/no-literal-jsx-text`). 화면 글자는 한국어로 쓰고, 예외 목록(`LinkSphere`, `URL`, 단축키 등)은 `texts-conventions` skill을 본다.
  범용 공용 UI 부품 안에서는 `TEXTS` 대신 `useUiTexts()`를 쓴다(다음 항목)
- **Never** 범용 공용 UI 부품(`src/shared/ui`에서 앱 전용 예외 목록 밖의 파일)과 그 보조 모듈에서 앱 문구(`TEXTS`)·라우터
  (`react-router-dom`)·앱 상태를 import → 부품이 스스로 넣는 글자는 `useUiTexts()`로 읽고(값은 `src/app/providers/UiTextsProvider.tsx`가
  `TEXTS`에서 뽑아 넘긴다), 링크·이동은 쓰는 쪽이 속성으로 넘긴다(`ErrorLayout`의 `homeAction`, `GlobalAlertDialogs`의
  `dismissKey`). ESLint `custom-design-system/no-app-import-in-generic-ui`가 허용 목록 밖 import를 막는다. 이 앱에서만 쓰는
  부품이면 `eslint.config.js`의 그 규칙 블록 예외 목록에 더하고 `docs/DESIGN-SYSTEM-PRINCIPLES.md` §5 분류표에 "앱 전용"으로
  적는다. 글자를 더하는 순서는 `texts-conventions` skill "공용 UI 부품이 스스로 보여 주는 글자", 배경은 같은 문서 §1.1·§1.2
- **Never** 공용 UI 부품(`src/shared/ui`)에서 종류를 고르는 속성에 `variant` 밖의 이름을 붙이거나, `className`을 `cn()`의 맨 뒤가
  아닌 자리에서 합친다 → 종류는 `variant`, 크기는 `size`다. 모양과 뜻을 따로 골라야 하는 부품에서만 뜻 축을 `tone`으로 더한다.
  `className`은 `cn(자기 클래스, className)`으로 합치고 cva로 만든 함수에는 넘기지 않는다. ESLint
  `custom-design-system/cva-variant-keys`·`custom-design-system/classname-last`가 막는다(cva 없이 직접 받는 속성 이름은 못 잡는다).
  정한 이유와 선례는 `docs/DESIGN-SYSTEM-PRINCIPLES.md` §1.4
- **Never** 하드코딩 색상 (`text-red-500`, `bg-green-500` 등) → 항상 `globals.css` 디자인 토큰 기반 Tailwind 클래스 사용
  (`text-destructive`, `bg-success`, `text-warning` 등). ESLint `custom-tailwind/no-raw-color`가 black/white/gray/zinc 등 명명 팔레트
  리터럴 클래스를 pre-commit과 `pnpm check`에서 막는다(도입 경위: `docs/DESIGN-SYSTEM.md`)
- **Never** 문자열을 이어 붙인 API 경로·손으로 적은 응답 타입(``apiClient.get<Post>(`${API_ENDPOINTS.post.base}/${id}`)``)
  → `*.api.ts`는 항상 `specClient`에 스펙 경로 템플릿을 쓴다(`specClient.get('/post/{id}', { path: { id } })`).
  없는 경로·메서드, 빠뜨린 경로 변수, 스펙과 다른 본문·응답 타입을 생성 스펙(`openapi.gen.ts`)이 컴파일 단계에서 막아
  예전 `API_ENDPOINTS` 규칙의 목적(오타·흩어짐 방지)을 대신한다. 스펙 타입 MSW(`src/mocks/http.ts`) 핸들러도 같은
  템플릿을 쓴다. `apiClient` 값 import는 ESLint `custom-api-rules/no-raw-api-client-import`가 막는다(허용: `spec-client.ts`·
  테스트). `API_ENDPOINTS`는 `client.ts`의 인증 경로 판별과 테스트·e2e 목에만 남아 있다(2026-10-30,
  `docs/OPENAPI-CODEGEN.md` §5-2·§5-5)
- **Never** feature hook에서 직접 `queryClient.invalidateQueries` → 항상 `.keys.ts` success handlers 사용
- **Never** 다른 엔티티의 raw 쿼리 키를 재구성해 `queryClient.invalidateQueries`를 직접 호출 → 그 엔티티가 공개한 `<entity>InvalidateQueries.xxx()` 래퍼만 사용. 크로스 엔티티 무효화가 필요하면 자기 엔티티의 `.keys.ts`에 `handle<Event>Success` 함수를 만들어 그 안에서 호출한다 (`docs/FE-ARCHITECTURE.md` §5의 "크로스 엔티티 무효화" 참고)
- **Never** 하위 레이어에서 상위 레이어 import → ESLint 강제 (레이어 방향 위반)
- **Never** 날짜 처리에 `new Date()` / `.getTime()` 직접 사용 → 항상 `dayjs` 사용 (`dayjs(value).valueOf()`, `dayjs().format()` 등).
  ESLint `no-restricted-syntax`가 막는다(`eslint.config.js`)
- **Never** `features/**`·`pages/**`의 `hooks/` 밖(주로 `ui/`)에서 entity 쿼리 훅(`*.queries`) 직접 import → 조회는 자기 슬라이스의
  `hooks/` 커스텀 훅이나 `entities/<entity>/hooks/`의 공용 훅(예: `useCategoryOptions`)에서 한다. ESLint
  `custom-query-rules/no-entity-query-import-outside-hooks`가 막는다(widgets는 FE-ARCHITECTURE §8 예외라 대상 아님. 경위:
  `docs/DECISIONS.md` 2026-09-09)
- **Never** React API(`memo`·`useCallback`·`useMemo`·`useEffect`·ref 등)를 학습한 일반론만으로 넣거나 빼지 않는다 → 판단 전에
  react.dev 해당 문서를 조회하고(context7 또는 WebFetch) 링크를 주석·PR에 남긴다. 성능 최적화를 넣는 근거는 실제 코드 추적(자식이
  `memo`인가, context·라우터를 구독하는가)과 측정이다 — react.dev는 `memo`를 _"같은 props로 자주 리렌더되고 렌더가 무거울 때만
  가치가 있다"_ (번역, [memo](https://react.dev/reference/react/memo))고 쓴다. 공식 hooks 규칙(`eslint-plugin-react-hooks` v7
  recommended)이 error로 켜져 있다 — 새 위반을 `eslint-suppressions.json`에 넣지 않는다(`--suppress-all`·`--suppress-rule` 금지).
  정당한 예외만 그 줄에 `eslint-disable-next-line <규칙> -- <이유>`를 단다(예: `useWindowGridVirtualizer.ts`의 인스턴스 속성 대입)
- **Never** raw HTML 요소로 UI를 일회성 구현 → 항상 공통 컴포넌트(`shared/ui/atoms`·`elements`·`layouts`) 우선. 반복되는 UI는 공통 컴포넌트를 만들거나 기존 것을 사용해 디자인을 단일 관리한다 (예: 버튼은 raw `<button>` 대신 `Button` 컴포넌트). 신규 코드 기준
- **Never** `shared/ui/atoms`·`elements`에 컴포넌트를 추가하거나 시각적으로 변경하고 스토리 없이 커밋 → 항상 같은 커밋에 `<Component>.stories.tsx`를 함께 만들거나 갱신한다. `.storybook/main.ts`의 글롭이 `src/**/*.stories.tsx`를 자동 인식하므로 파일만 만들면 된다 (예시: `checkbox.tsx`+`checkbox.stories.tsx`, `switch.tsx`+`switch.stories.tsx`). 스토리 `title`은 파일 경로에서 계산한 값이어야 한다(ESLint `custom-storybook/title-matches-path`가 차단). 스토리 이름은 export 이름(PascalCase)만 쓰고 `name`을 달지 않는다(`custom-storybook/no-story-name`·공식 `eslint-plugin-storybook` `flat/recommended`가 차단). 형식과 다른 레이어에 스토리를 둘 수 있는 기준은 `docs/FE-ARCHITECTURE.md` §18 "Storybook 스토리"를 먼저 읽는다
- **Never** `if`문을 인라인으로 작성 (`if (x) return;`) → 항상 중괄호 블록으로 감싼다 (`if (x) {\n  return;\n}`). 한 줄짜리 본문도 예외 없음 (ESLint `curly: ['error', 'all']` 규칙으로 강제 중)
- **Never** 문장을 다닥다닥 붙여 논리 그룹을 뭉개지 않는다 → 가드절(`if (...) { return; }`) 뒤, 그리고 `if`/`try` 같은 제어 블록 **앞뒤**에 **빈 줄 1줄**을 넣어 논리 단위를 분리한다 (Prettier가 아닌 컨벤션 — 아래 예시 참고)
- **Never** 클릭 가능한 요소에 `cursor-pointer`를 개별로 붙인다 → `globals.css`의 `@layer base` 규칙이 `button`/ARIA role 전체를 전역으로 처리한다(`design-tokens` skill의 "인터랙션 커서" 참고). `div`/`span`에 `onClick`만 다는 것도 금지 — `Button`/`<button>`을 쓰거나, 불가피하면 `role="button"`을 함께 지정한다 (ESLint `custom-a11y/clickable-needs-interactive-element`가 차단)
- **Never** `main`에 push한 뒤 워크플로 결과를 확인하지 않고 "배포됨"이라 보고 → `gh run list --branch main --workflow
"Frontend Deploy (S3 + CloudFront)"`(또는 `gh run watch <id>`)로 그 커밋 SHA가 success인지 확인한 뒤에 보고한다. 후속 커밋이
  `docs/`나 `CHANGELOG.md`처럼 `deploy.yml`의 경로 필터에 안 걸리는 파일만 건드렸다면 워크플로가 돌지 않으므로
  `gh workflow run "Frontend Deploy (S3 + CloudFront)" --ref main`으로 수동 실행한다. 사용자 설정 훅 `deploy-verify.mjs`
  (claude-base `hooks/`)가 push·PR 생성·병합한 SHA의 워크플로를 감시하다 실패하면 세션을 깨운다(경위: `docs/CI-CHECK-GATE.md` §9.3,
  `docs/DEPLOY.md` "Trigger")
- **Never** CloudFront WAF의 바디 크기 제한 룰(`SizeRestrictions_BODY` 등)을 "왜 있는지" 확인 없이 완화·비활성화하지 않는다 →
  이 룰은 지금 8,192바이트 초과 요청을 막고 있다. 대체 크기 제한 룰(`SizeConstraintStatement`)은 CloudFront Pro 플랜(월 $15 정액제)
  전용이라 이 계정(Free 플랜)에서는 만들 수 없다. Pro 업그레이드 없이는 이 8KB 벽을 건드리지 않고, 앱이 자체 상한(BE
  `CommentLimits.MAX_CONTENT_BYTES`)을 둔다(근거: `docs/DEPLOY.md` "CloudFront WAF (수동 관리)", `docs/DECISIONS.md` 2026-09-06 항목)
- **Never** 폼 검증 실패를 버튼 `disabled`만으로 처리하지 않는다(사용자에게 이유를 알려야 하는 경우) → `disabled` 버튼은 클릭
  이벤트가 발생하지 않아 `handleSubmit`의 검증 실패 콜백이 실행될 기회가 없다. 진짜 "할 게 없음"(빈 입력) 상태만 `disabled`로
  막고, 그 외 검증 실패(길이 초과 등)는 버튼을 눌러지게 둔 채 zod resolver + `onInvalid` 콜백으로 차단하면서 상시 보이는 인라인
  안내 문구를 함께 둔다(`useCreateComment.ts`, `CommentForm.tsx`). 조건은 "사용자가 이유를 알 방법이 아예 없는가"다 — 이유가 이미
  호버 없이 상시 보이면(`mode: 'onChange'` 필드 검증이 인풋 아래에 이유를 띄우는 `CreatePostForm.tsx`의 URL 필드) `disabled` +
  `TooltipWrapper`로 충분하다(경위: `docs/COMMENT.md` 시행착오)
- **Never** 멱등한 버튼(초기화·지우기·해제 등 "특정 상태로 만든다"는 뜻의 버튼)을 "할 게 없음"이라는 이유만으로 `disabled`
  처리하지 않는다 → `disabled`는 탭 순서에서도 빠져 키보드 사용자는 버튼도 이유도 볼 수 없다. 항상 활성 상태로 두고 클릭
  핸들러에서 조용히 early return한다(`usePostListFilter.ts`의 `handleClearSearch`). 단, 저장·등록처럼 "눌렀으면 반영됐다"는
  피드백을 기대하는 버튼에는 확장하지 않는다 — 기존 `disabled`와 이유 안내(`UpdatePostForm.tsx` 등)를 유지한다(근거:
  `docs/DECISIONS.md` 2026-09-06 항목)

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

### 워크트리

코드 수정은 워크트리에서만 하고 메인 체크아웃에서는 스테이징하지 않는다. 이 규칙은 공통 지침 "안전·권한"과 가드 훅
(`~/project/claude-base/hooks/`의 edit-guard·bash-guard, 레포별 사실은 `.claude/repo-policy.json`)이 맡는다 — 막히면 안내하는
명령으로 바꾸고 우회하지 않는다. 아래는 이 레포의 사실이다.

- **Never** 워크트리 진입 후 부트스트랩 생략 → gitignore된 `.env`는 루트의 `.worktreeinclude`가 맡는다. `EnterWorktree`가 워크트리를
  만들 때 Claude Code가 메인 체크아웃의 `.env`를 복사한다([worktrees 문서](https://code.claude.com/docs/en/worktrees)). 진입 직후 반드시 실행:
  ```bash
  test -s .env
  pnpm install
  ```
  `.env`가 없으면 `cp`로 복사하지 않고 사용자에게 알린다 — 사용자 설정의 `.env` 읽기·편집 거부 규칙이 `cp ../../../.env .`를 막고
  (2026-11-12부터, 허용 규칙으로 풀 수 없다), 메인 체크아웃이 `.worktreeinclude`가 들어오기 전 커밋이면 복사가 일어나지 않는다
- **Never** 여러 워크트리에서 동시에 `pnpm dev` → 포트(31119)는 `strictPort` 미설정이라 겹치면
  다음 빈 포트로 조용히 넘어가 헷갈리고, BE가 보는 DB(원격 Postgres)는 워크트리로 격리되지
  않는다. dev 서버는 한 번에 한 워크트리에서만 띄운다
- **Never** `EnterWorktree` 기본값(`fresh` = `origin/main` 기준)을 확인 없이 사용 → 작업 시작 전 `git log origin/main..main`으로
  미푸시 커밋이 있는지 먼저 확인한다
- **Never** 병합·배포까지 확인된 워크트리를 남겨 두지 않는다 → 병합과 그 병합으로 도는 배포 성공까지 확인했으면(배포가
  트리거되지 않는 변경이면 병합 확인까지) `ExitWorktree(action: "remove")`로 워크트리와 로컬 브랜치를 지운다. 배포가 실패하면
  원인을 다 볼 때까지 남기고, 병합 전에 세션을 떠날 때는 `ExitWorktree(action: "keep")`으로 나온다. `ExitWorktree(remove)`가
  거부되면 손으로 지우되, squash 병합이라 `git branch -d`가 안 되므로 먼저 ① `gh pr view <번호> --json state,headRefOid`가
  `MERGED`이고 ② `headRefOid`가 `git -C <경로> rev-parse HEAD`와 같고 ③ `git -C <경로> status --porcelain`이 비어 있는지 확인한 뒤
  `git worktree remove <경로>`(`--force` 없이) + `git branch -D <브랜치>`. 새 워크트리를 만들기 전 `git worktree list`로 목록을 훑고,
  디렉토리는 있는데 목록엔 없는 경우(비정상 종료로 등록이 깨진 경우)만 `git worktree prune`으로 정리한다
- **Never** `EnterWorktree({ path })`로 재진입한 워크트리를 `ExitWorktree(remove)`가 지워줄
  거라 가정한다 → 한 세션 안에서 `EnterWorktree({ name })`으로 만든 뒤 `action: "keep"`으로
  나왔다가, 나중에 같은 세션에서 `EnterWorktree({ path })`로 그 워크트리에 다시 들어가면
  harness가 더 이상 이 세션을 owner로 인식하지 않아 `ExitWorktree(remove)`가 거부한다
  (2026-09-27 실제 발견, 에러 메시지: "This session is not the owner of the worktree..."). 이
  경우 `ExitWorktree(action: "keep")`으로 원래 디렉토리로 돌아온 뒤, 루트에서 위 규칙의 ①②③을
  확인하고 수동 정리한다. 이전에 쓰던 `git diff origin/main -- <경로>` 확인은 워크트리 경로가 git
  추적 대상이 아니라 항상 비어 나와 병합 여부를 가려내지 못했다(2026-10-14 발견) — 그래서
  `--force`와 함께 쓰지 않는다
- **Never** `eslint.config.js`의 ignore 패턴을 루트 상대 경로로만 작성 →
  `.claude/worktrees/`처럼 중첩된 경로가 새서 워크트리 안 빌드 산출물(`dist/`)이 그대로
  검사 대상에 걸린다. `.gitignore`에 있어도 ESLint는 자동으로 읽지 않으므로
  `dist/**/*`가 아니라 `**/dist/**`처럼 `**/` prefix를 붙여야 한다(2026-09-03, `pnpm check`
  2,370건 중 2,366건이 이 문제였다 — `pnpm check`가 CI에 걸려 있지 않아 몇 달째 발견도
  못 됐다. 지금은 PR CI(`ci.yml`)와 `deploy.yml`에 게이트로 걸려 있다). **`.prettierignore`는
  이 문제가 없다** — gitignore 문법을 그대로 쓰므로 슬래시 없는 패턴(`dist`)이 이미 모든
  깊이에서 매칭된다(ESLint의 glob 문법과 다름). 2026-09-09 감사에서 `.prettierignore`가
  `**/` prefix 없이 `node_modules`/`dist`/`build`/`coverage`로만 돼 있어 위 사고와 같은
  패턴인지 의심했으나, 중첩 `dist/` 디렉터리를 실제로 만들어 `prettier --check`가 걸러내는지
  재현 검증한 결과 문제없음을 확인했다 — ESLint 규칙을 Prettier에도 그대로 적용하지 않는다

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

- **기존 함수 시그니처 변경 금지** — 인자 추가/제거/변경, 반환 타입 변경은 명시적 요청 없이 불가
- **새 기능은 새 코드로** — 기존 함수/훅 확장보다 새 hook/util을 별도 작성
- **레이어 계약 유지** — entities 레이어 hook의 인터페이스를 features 요구에 맞춰 바꾸지 않는다
  → features 레이어에서 해결 방법을 찾는다

---

## 작업 후 검증

모든 코드 수정 후 반드시 순서대로 실행:

1. `pnpm type-check` — TypeScript 컴파일 에러 확인 (필수)
2. `pnpm test` — 관련 테스트 실행 (테스트 파일이 존재하는 경우)
3. `pnpm lint`·`pnpm check:deps` — ESLint 레이어 경계, entities `@x` 경유·features·widgets의 같은 레이어
   슬라이스 import·미선언 패키지·production 코드의 devDependency 위반 확인 (import 변경 시)
4. `pnpm check:docs` — README/docs/CLAUDE.md/skill·커맨드가 가리키는 경로·줄 번호가 실제와
   맞는지, `<details>` 짝이 맞는지 확인 (`README.md`, `docs/*.md`, `.claude/CLAUDE.md`,
   `.claude/skills/**`, `.claude/commands/**`, `.claude/rules/**`, `CHANGELOG.md`를 수정한 경우 — push 때
   `pre-push` 훅도 같은 검사를 돈다)

에러가 있으면 진행 전 반드시 수정.

> **⚠️ 타입체크는 반드시 `pnpm type-check`(= `tsc -b --noEmit`)로.** 루트 `tsconfig.json`은
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

## 패턴 레퍼런스

아래 패턴들은 코드 예제와 함께 [`docs/FE-ARCHITECTURE.md`](../docs/FE-ARCHITECTURE.md)에
정본으로 있다 — 여기 복사해두지 않는다(두 곳에 같은 코드를 유지하면 한쪽만 갱신되고 다른
쪽이 낡는 문제가 실제로 있었다, 2026-09-07). 패턴을 쓸 때는 해당 절을 **먼저 읽는다**.

| 패턴                                                                               | 정본  | 한 줄 요약                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3-Layer API (`*.api.ts` → `*.keys.ts` → `*.queries.ts`) + 크로스 엔티티 무효화     | §5    | 레이어를 건너뛰거나 합치지 않는다. Layer 1은 `specClient`(스펙 경로)로만, 다른 엔티티 캐시는 그 엔티티의 `InvalidateQueries` 래퍼로만                                                                                                  |
| Feature Hook (`hooks/`에 로직 전부, `ui/`는 JSX만)                                 | §6    | UI 파일은 훅 호출 + 렌더링만                                                                                                                                                                                                           |
| Widget Hook (entity query 조합 + 파생 상태, 원칙적으로 mutation 없음)              | §8    | query 1개 + trivial 파생만이면 컴포넌트에서 직접 사용 (widgets 한정, features는 §6 예외 없음). 단, 그 widget 전용이라 재사용되지 않는 CRUD는 widget hook에서 직접 mutation을 써도 된다 — `usePostCard.ts`(아래 레퍼런스)가 실제 예시   |
| Zod Schema (`z.infer`로 타입 파생)                                                 | §9    | `nullable()`=null 허용, `optional()`=undefined 허용                                                                                                                                                                                    |
| Delete with Confirm                                                                | §10   | native `confirm()` 금지, 항상 `useAlertDialog` + `openConfirm`                                                                                                                                                                         |
| 토글 버튼 (`ToggleButton`)                                                         | §10-A | 상태를 뒤집는 버튼은 `Button` 대신 `ToggleButton` — 더블클릭 가드(400ms) 내장. 닫기·지우기처럼 항상 같은 상태로 만드는 버튼은 대상 아님                                                                                                |
| Optimistic Update (`onMutate` → `cancelQueries` → `setQueryData` → 롤백)           | §11   | 참조 구현: `entities/interaction/api/interaction.queries.ts`                                                                                                                                                                           |
| Util Class (`*.util.ts`는 바레 함수 대신 `export class <Name>Util { static ... }`) | §23   | 함수 하나뿐이어도 클래스로 감싼다 — `shared/utils/`의 모든 `*.util.ts`가 이 형태                                                                                                                                                       |
| 모바일 키보드 힌트 (`enterKeyHint`·`inputMode`)                                    | §24   | 뒤에 다른 필드 없는 단일 입력 지점에만 `enterKeyHint`(Android 회귀 위험), 자체 검증 있는 필드는 `type` 대신 `inputMode`, `type="search"`는 지양                                                                                        |
| 스크롤 규칙 (URL이 바뀌면 맨 위로)                                                 | §25   | 전역 `<ScrollRestoration />`이 처리하므로 기능마다 `window.scrollTo`를 넣지 않는다. 스크롤을 유지해야 하는 state-only push(오버레이·모달·패널)와 지금 보는 화면 안의 해시 이동(상세의 댓글 링크)만 `preventScrollReset: true`로 빠진다 |
| 위층 조립 (같은 레이어 슬라이스를 직접 import하지 않음)                            | §26   | 목록이 카드를 그리는 식이면 받는 쪽이 `render<대상>` 함수 prop을 받고 위층(페이지 등)이 넘긴다. 함수는 모듈 최상단에 선언, 인자 타입은 받는 쪽이 선언                                                                                  |
| 등록 요청 멱등 키 (`IdempotencyKeyUtil`)                                           | §27   | 같은 요청이 두 번 오면 행·메일이 둘이 되는 등록은 `mutationFn`을 `IdempotencyKeyUtil.send`로 감싸 `Idempotency-Key`를 싣는다. 폼 훅은 키를 모른다                                                                                      |
| 응답을 못 받은 쓰기 요청 (`retry` 선언)                                            | §28   | 모든 mutation은 `retry`를 `false`(이유 주석) 또는 `shouldRetryIdempotentMutation`(첫 줄 세대 확인)으로 선언한다. 끝내 모르면 `ErrorUtil.resolveFailureMessage`로 사실대로 안내하고 `.keys.ts` 핸들러로 화면을 다시 받는다              |

---

## 에러 핸들링 전략

### 토스트 단일 소유 원칙 (중복 방지)

**에러 토스트의 유일한 기본 소유자는 React Query 전역 핸들러(`queryClient.ts`)다.**

- transport 레이어(`shared/api/client.ts`)는 UI 토스트를 띄우지 않는다 — 인증 정리·throw만.
  - **예외**: 인증 상태가 바뀌어 이 탭을 정리할 때의 안내(`toast.info`) 토스트는 `AuthUtil`이 띄운다
    (`applySessionMismatch` — refresh 409 `SESSION_MISMATCH`). 그 정리가 throw보다 먼저 캐시를 취소·삭제해 전역
    핸들러에서는 이 안내가 뜰 수 없다(`docs/AUTH.md` §8-B "토스트 위치"). 로그인 만료 안내(`applySessionExpired`,
    id `session-expired`, 다시 로그인하면 `dismissSessionExpiredToast`가 닫는다)도 같은 예외다 — 로그인 창과 토스트 중
    무엇을 띄울지가 정리 전 상태로 정해진다(`docs/AUTH.md` §8-I "토스트 위치"). 중복 방지 `id`를 붙이고, 에러 토스트는
    이 예외에 들지 않는다 — 여전히 전역 핸들러만 띄운다.
- mutation 에러는 전부 `mutationErrorHandler`를 지나가며, `meta.manualErrorHandling`이 없으면 거기서 토스트 1개가 자동으로 뜬다 (mutation·query 공통 판정은 [error-toast.ts](../src/shared/lib/react-query/config/error-toast.ts)의 `resolveErrorToast()`, `if (meta?.manualErrorHandling) { return { silent: true }; }`).

> ⚠️ **Never** mutation `onError`나 그 mutation을 쓰는 컴포넌트 `catch`에서 `toast.`를 직접 부르면서 `meta.manualErrorHandling`을 빼먹지 말 것 → 전역 토스트와 겹쳐 **두 번 뜬다**. 직접 토스트를 띄우면 반드시 `manualErrorHandling: true`.
> 그리고 그 `onError`·`catch`에서 토스트를 띄우기 전에 `ErrorUtil.isSessionExpired(error)`면 조용히 return한다 — 로그인 만료로 끝난 요청(`SessionExpiredError`)의 안내는 만료 정리가 맡는다. 롤백은 만료 정리가 비운 캐시를 이전 값으로 되살리면 함께 건너뛴다(계정 수정). 근거는 `docs/AUTH.md` §8-B "만료로 끝낸 요청은 실패로 끝납니다".

### 새 mutation 만들 때 토스트 결정표

| 원하는 동작                           | 설정                                  | 결과                                                        |
| ------------------------------------- | ------------------------------------- | ----------------------------------------------------------- |
| 일반 에러 토스트면 충분               | (없음)                                | 전역이 `serverError` 1개(응답을 못 받으면 `outcomeUnknown`) |
| 메시지만 커스텀                       | `meta: { errorMessage }`              | 전역이 그 메시지 1개 (단, 429·WAF 차단은 전용 문구가 우선)  |
| `onError`/컴포넌트에서 **직접** toast | `meta: { manualErrorHandling: true }` | 내 토스트만 1개                                             |
| 옵티미스틱 토글(실패 시 롤백만)       | `meta: { manualErrorHandling: true }` | 토스트 없이 롤백                                            |

전역 자동 처리 규칙 상세와 `manualErrorHandling` 코드 예제는
[`docs/FE-ARCHITECTURE.md`](../docs/FE-ARCHITECTURE.md) §13을 먼저 읽는다.

---

## React Query 설정 / 핵심 설정 파일

값과 경로 목록은 [`docs/FE-ARCHITECTURE.md`](../docs/FE-ARCHITECTURE.md) §12·§17이 정본이다 —
값이 필요할 때 먼저 읽는다.

---

## TEXTS 구조 (`src/shared/config/texts.ts`)

모든 UI 문자열은 `TEXTS.*`로 참조하고, 새 문자열은 `texts.ts`에 먼저 키를 추가한 뒤 쓴다.
전체 네임스페이스 트리, 톤 규칙(해요체 통일, 가드 테스트 `texts.test.ts`), 성공 토스트
표시 여부 판단 기준은 `texts-conventions` skill(`.claude/skills/texts-conventions/SKILL.md`)에
있다 — TEXTS 키를 추가하거나 토스트 필요 여부를 판단할 때 그 skill을 먼저 읽는다(2026-09-09,
CLAUDE.md가 984줄까지 길어진 것을 계기로 이 절을 분리했다 — 매 세션 로드할 필요는 없는
내용이다).

---

## 디자인 토큰 (`src/app/globals.css`)

Tailwind v4 CSS 변수 기반 테마. **하드코딩 색상 클래스 사용 금지** — `globals.css` 색 토큰
기반 Tailwind 클래스(`text-destructive`, `bg-success` 등)를 쓴다. 전체 색상/반경 토큰 표,
클릭 가능 요소의 전역 커서 규칙, 다크모드·폰트는 `design-tokens` skill
(`.claude/skills/design-tokens/SKILL.md`)에 있다 — 컴포넌트를 스타일링할 때 그 skill을
먼저 읽는다(2026-09-09, CLAUDE.md 길이 감사 후 이 절을 분리했다).

---

## 반응형 UX

모바일+데스크톱 반응형 분기, 터치 UI, 하단 탭바·safe-area, 데스크톱 sticky·플로팅 버튼,
hover 컨테이너 안 드롭다운·팝오버 규약은 `responsive-ux` skill
(`.claude/skills/responsive-ux/SKILL.md`)에 있다 — 반응형 UI를 만들거나 고칠 때,
고정(fixed/sticky) 요소를 배치할 때, hover 스타일이 있는 컨테이너 안에 드롭다운·팝오버를
둘 때 그 skill을 먼저 읽는다.

---

## 모션

트랜지션·애니메이션 지속시간, easing, `prefers-reduced-motion`, exit 애니메이션
동기화 규약은 `motion-ux` skill(`.claude/skills/motion-ux/SKILL.md`)에 있다 —
애니메이션·트랜지션 클래스를 붙일 때 그 skill을 먼저 읽는다(2026-09-22 도입).

---

## 폴더 네이밍 규칙

### 폴더 네이밍 원칙

| 위치                          | 규칙                                                                                                 | ✅                                                 | ❌                                |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------- |
| `features/<domain>/` 슬라이스 | **원칙적으로 동사(액션)만.** 단, 슬라이스 자체가 완결된 사용자 액션/flow일 때는 명사 허용(아래 각주) | `create/`, `like/`, `delete/`, `login/`, `signup/` | `create-post/`, `createPost/`     |
| `widgets/<domain>/` 슬라이스  | **`<entity>-<role>`** kebab-case 명사                                                                | `post-card/`, `post-list/`                         | `postCard/`, `PostCard/`          |
| `app/layouts/`                | **`<name>-layout`**                                                                                  | `app-layout/`                                      | `appLayout/`, `AppLayout/`        |
| 슬라이스 내부                 | **역할명 단수 소문자**                                                                               | `hooks/`, `ui/`, `utils/`                          | `hook/`, `UI/`, `utils-fn/`       |
| 도메인 폴더                   | **단수 소문자**                                                                                      | `post/`, `comment/`, `user/`                       | `posts/`, `Post/`, `user-domain/` |
| 내부 전용 폴더                | **`_` 접두사**                                                                                       | `_base/`                                           | `base/`, `__base__/`              |
| `shared/lib/`                 | **라이브러리명 그대로**                                                                              | `react-query/`, `firebase/`                        | `reactQuery/`, `query/`           |
| 에러 페이지                   | **HTTP 상태코드**                                                                                    | `404/`, `500/`                                     | `not-found/`, `error/`            |
| `pages/` 복합어               | **붙여쓰기**                                                                                         | `myaccount/`, `mycomment/`                         | `my-page/`, `myPage/`             |

**`features/<domain>/` 슬라이스의 명사 허용 각주** (2026-09-08 정정) — 이 규칙은
FSD가 강제하는 게 아니다. FSD 공식 정의([FAQ](https://feature-sliced.design/docs/get-started/faq))는
_"엔티티는 앱이 다루는 현실의 개념이다. 피처는 상호작용이다 ... 사람들이 엔티티로 **하고 싶어 하는
일**이다"_ (번역, 생략은 원문 인용 그대로)라고 쓴다 — 즉 feature
슬라이스명은 "무엇을 하는가"를 담으면 되고, 그게 동사형이든 명사형(행위 자체를 가리키는
명사, 예: `login`=로그인하다/로그인)이든 공식 스펙은 구분하지 않는다. 공식
[Authentication 가이드](https://feature-sliced.design/docs/guides/examples/auth)도
`features/login/`을 그대로 쓴다. 이 레포의 `auth/login/`·`auth/signup/`가 실제로
그 형태다 — "완결된 사용자 액션/flow"(로그인, 회원가입처럼 그 자체로 하나의 흐름)일
때만 명사를 허용하고, `post/{create,update,delete,like}`처럼 한 엔티티에 걸린 개별
조작들은 계속 동사를 쓴다.

### 레이어별 허용 세그먼트

위 표가 이름 "형식"(소문자·단수 등) 규칙이라면, 아래는 레이어별로 어떤 세그먼트를
쓸지에 대한 "허용 목록" 규칙이다. 새 슬라이스를 만들 때 이 표부터 확인한다 — 암묵적으로
트리 예시만 보고 유추하면 레이어마다 다른 세그먼트가 섞이게 된다.

> **2026-09-06 `entities/user/hooks/` → `model/` 이동, 실은 근거가 틀렸었다.** 당시 커밋은
> "entities 5개 슬라이스가 훅을 `model/`에 두는데 user만 `hooks/`를 썼다"고 주장했지만,
> 그 시점 실제로 훅을 `model/`에 둔 슬라이스는 `folder`(파일 1개, 2026-08-12 작성) 하나뿐이었고
> 나머지 3개(comment·interaction·post)는 애초에 훅이 없어 비교 대상조차 아니었다. 반대편
> `user/hooks/`는 사람이 2026-01-27부터 유지해온 5개 파일이었다 — 즉 "다수 관례"는 날조였고,
> 실제로는 `hooks/`가 5:1로 우세했다. 2026-09-08 재검토 후 아래처럼 되돌렸다:
> **entities도 `hooks/`를 쓴다.** `model/`은 스키마·타입 전용으로 좁힌다.

| 레이어                | 허용 세그먼트                                                 | 규칙                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `entities`            | `api/`, `hooks/`, `model/`, `ui/`, `config/`, `utils/`, `@x/` | `model/`은 스키마·타입 정의 전용(`*.schema.ts`, `*.dto.ts`). 훅·비즈니스 로직은 `hooks/`, 상수는 `config/`, 순수 함수는 `<entity>.util.ts`로 `utils/`에(선례: `shared/utils/date.util.ts`·`common.util.ts` — 파일 접미사는 단수 `.util.ts`, 파일명은 함수명이 아니라 엔티티명). `ui/`에는 그 엔티티의 **시각적 표현**만 둔다 — 폼·버튼처럼 사용자가 무언가를 _하는_ 인터랙션 UI는 `features`에 둔다(출처: [FSD 공식 레이어 정의](https://feature-sliced.design/docs/reference/layers) — entities UI는 _"여러 페이지에서 재사용되는 시각적 표현"_ (번역), features UI는 _"폼처럼 상호작용을 수행하는 UI"_ (번역)). `@x/<참조하는-엔티티>.ts`는 다른 엔티티가 이 엔티티를 참조할 때 쓰는 교차 참조 표기(FSD 공식 관례, 2026-09-21 도입) — `docs/FE-ARCHITECTURE.md` §5 참고 |
| `widgets`, `features` | `hooks/`, `ui/`, `utils/`, `config/`                          | 컴포넌트가 하나라도 있으면 반드시 `ui/` 아래에 둔다 — 슬라이스 루트에 직접 두지 않는다                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `pages`               | `hooks/`                                                      | 페이지 컴포넌트는 슬라이스 폴더에 바로 둔다. `hooks/`는 그 페이지 전용 오케스트레이션 로직(URL 파싱, 데이터 조회 포함, 리다이렉트 effect 등)만 담는다 — entity 쿼리도 features와 동일하게 `hooks/` 안에서만 호출한다(`custom-query-rules/no-entity-query-import-outside-hooks`가 pages도 대상). 여러 페이지에서 필요해지면 entities/features로 승격한다(2026-09-29, FSD v2.1 "pages first" 원칙 채택 — `PostDetailPage.tsx`가 유일하게 pages에 로직을 인라인으로 갖고 있던 문제를 계기로 도입)                                                                                                                                                                                                                                                                            |

### entities의 그룹 폴더

도메인 이름 하나만으로 맥락이 안 드러날 때(예: `folder`가 북마크 폴더인지 다른 폴더인지
불분명했던 사례), `features`·`widgets`가 이미 쓰는 그룹 폴더 패턴(`features/bookmark/toggle/`,
`widgets/bookmark/folder-nav/`)을 entities에도 쓸 수 있다 — 예: `entities/bookmark/folder/`.
그룹을 쓰더라도 그 아래 도메인명 자체는 위 "폴더 네이밍 원칙"의 "단수 소문자" 규칙을
그대로 따른다 — `bookmark-folder/`처럼 도메인명 자체를 복합명으로 만들지 않는다.

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
    toggle/       ← 컬렉션(폴더) 도메인 그룹 — post의 액션이 아니라 bookmark의 액션
      hooks/
      ui/
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

## 네이밍 컨벤션 / Form 컴포넌트

디렉토리·파일·훅·쿼리 키 네이밍 규칙과 Form 컴포넌트 목록은
[`docs/FE-ARCHITECTURE.md`](../docs/FE-ARCHITECTURE.md) §16·§18이 정본이다 —
이름을 정할 때 먼저 읽는다.

---

## 테스트 환경

| 항목          | 내용                                                                                                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 테스트 러너   | Vitest 4.x + jsdom                                                                                                                                                                    |
| 글로벌 셋업   | `src/test/setup.ts` (MSW, jsdom stubs, toast mock)                                                                                                                                    |
| 커스텀 render | `src/test/utils.tsx` → `render()`(문구 Provider만), `renderWithProviders()`, `createTestQueryClient()` — 공용 UI 부품을 그리면 `render`도 여기서 가져온다(`docs/TESTING.md` "패턴 D") |
| MSW           | `src/mocks/server.ts` + `handlers/` + `fixtures/`                                                                                                                                     |
| API URL 전략  | Vitest는 `DEV`라 `/api` 고정 → MSW 인터셉트. `.env.test`는 e2e 전용(운영 API 차단)                                                                                                    |
| 강제 실행     | `.husky/scripts/pre-push` + GitHub Actions `ci.yml`·`deploy.yml`                                                                                                                      |
| e2e           | Playwright(`e2e/`), `page.route()` 모킹, 상세는 `docs/TESTING.md` "Playwright e2e 자동화 테스트" 절 참고                                                                              |

```bash
pnpm test            # 1회 실행 (CI / pre-push)
pnpm test:watch      # 감시 모드 (TDD)
pnpm test:coverage   # 커버리지 → coverage/index.html
pnpm test:e2e        # Playwright e2e (chromium + mobile-chrome)
```

---

## 브라우저 검증 녹화

UI 동작이 바뀌는 변경을 커밋하기 전, Playwright MCP로 실제 브라우저 확인 화면을 녹화해 사용자에게 보여주는 절차는
`browser-verification` skill(`.claude/skills/browser-verification/SKILL.md`)에 있다 — 커밋 전 검증이 필요할 때 그 skill을 먼저
읽는다. 녹화를 마치면 같은 폴더에 짧은 이름으로 복사해 `open -a Cursor <절대경로...>`로 바로 연다(상세는 skill "다 만든 뒤").

---

## 개발 커맨드

전체 목록은 [`docs/FE-ARCHITECTURE.md`](../docs/FE-ARCHITECTURE.md) §19를 먼저 읽는다. `/api` 프록시
대상은 하드코딩된 포트가 아니라 `VITE_API_BASE_URL` 환경변수(`.env`)다.

---

## 코드 스타일 레퍼런스

새 기능 구현 전 아래 파일들을 읽어 스타일을 학습한다. 위 섹션의 패턴 예시가 추상적으로 느껴질 때 이 파일들을 직접 읽으면 된다.

| 역할              | 레퍼런스 파일                                         | 핵심 패턴                                                                              |
| ----------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Feature Hook      | `src/features/post/create/hooks/useCreatePost.ts`     | `DEFAULT_VALUES` + `useForm/zodResolver` + `onSubmit` 핸들러 분리, 반환값 객체         |
| Widget Hook       | `src/widgets/post/post-card/hooks/usePostCard.ts`     | Props(엔티티+옵션) + 권한 체크 + `toast` + `openConfirm` + try-catch                   |
| API 함수          | `src/entities/post/api/post.api.ts`                   | `postApi` 객체 export, `specClient`, JSDoc 한글, 조건부 스프레드, `NProgress`          |
| Query Keys        | `src/entities/post/api/post.keys.ts`                  | `postMutationKeys` + `postKeys` + `postInvalidateQueries` 헬퍼 + `handleXxxSuccess`    |
| Query Hooks       | `src/entities/post/api/post.queries.ts`               | `useMutation(meta 메시지)` + `useSuspenseInfiniteQuery(select 변환)` + 낙관적 업데이트 |
| Optimistic Update | `src/entities/interaction/api/interaction.queries.ts` | `onMutate → cancelQueries → setQueryData → return previous`                            |
| 텍스트 상수       | `src/shared/config/texts.ts`                          | 계층적 namespace(`TEXTS.xxx.yyy`), `as const`, 한국어                                  |
| API 설정          | `src/shared/config/api.ts`                            | `API_BASES` + `API_ENDPOINTS`(함수형/상수형 혼합), DEV 분기                            |

---

## 체크리스트

기존 엔티티에 새 기능을 추가할 때, 새 도메인을 추가할 때의 체크리스트는
[`docs/FE-ARCHITECTURE.md`](../docs/FE-ARCHITECTURE.md) §21·§22이 정본이다 —
작업 시작 전 먼저 읽는다.

---

## 슬래시 커맨드 (`.claude/commands/`)

| 커맨드            | 사용법                            | 역할                                                   |
| ----------------- | --------------------------------- | ------------------------------------------------------ |
| `/new-domain`     | `/new-domain notification`        | entity 전체 생성(feature는 `/new-feature`로)           |
| `/new-feature`    | `/new-feature post pin`           | feature hook + UI 생성                                 |
| `/add-entity-api` | `/add-entity-api post tag`        | 3-layer API 파일 생성                                  |
| `/add-schema`     | `/add-schema member address`      | BE 응답 타입(dto alias) 생성, 필요하면 Zod 요청 스키마 |
| `/fix-bug`        | `/fix-bug 삭제 후 목록 갱신 안됨` | 버그 분석 + 수정                                       |
| `/code-review`    | `/code-review`                    | 아키텍처 준수 리뷰                                     |

---

## 스킬 (`.claude/skills/`)

각 절 본문에도 "그 skill을 먼저 읽는다"는 문장이 있다 — 이 표는 한눈에 보는
인덱스일 뿐, 언제 읽는지의 정본은 각 skill 파일 자신이다.

| 스킬                   | 언제 읽는가                                                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `design-tokens`        | 색상/배경/테두리·텍스트 크기·커서·다크모드·반경 클래스를 정할 때                                                        |
| `responsive-ux`        | 모바일/데스크톱 UI를 만들거나 고칠 때, 고정(fixed/sticky) 요소를 배치할 때, hover 컨테이너 안에 드롭다운·팝오버를 둘 때 |
| `motion-ux`            | 애니메이션·트랜지션 클래스를 붙이거나 exit 애니메이션이 있는 컴포넌트를 만들 때                                         |
| `texts-conventions`    | `TEXTS.*`에 새 키를 추가하거나 성공 토스트 필요 여부를 판단할 때                                                        |
| `changelog-release`    | feat/fix/perf 커밋 시, `CHANGELOG.md` 작성·릴리즈 시점                                                                  |
| `browser-verification` | 커밋 전 UI 동작을 브라우저로 직접 확인해야 할 때                                                                        |
| `plan-doc-structure`   | plan mode Final Plan 작성 시 섹션 구조를 정할 때                                                                        |

### agent-skills 플러그인

`.claude/settings.json`이 [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) 플러그인(`agent-skills:*`)을
켠다(2026-11-12). skill 25개가 모두 목록에 오르지만, 상황에 연결하는 것은 작성자가 이미 운영 중인 프로젝트에 권하는
1단계([adoption-guide](https://github.com/addyosmani/agent-skills/blob/main/docs/adoption-guide.md) "Path B" → "Phase 1")뿐이다.
1단계 첫 항목인 `context-engineering`(규칙 파일 쓰기)은 이 CLAUDE.md가 대신한다. 플러그인 skill 파일은 고칠 수 없는
캐시라서, 이 레포에 맞춘 예외는 아래 표에 둔다.

**이 레포의 규칙·skill·훅·CI와 부딪히면 항상 이 레포 쪽을 따른다.** 연결하지 않은 skill이 설명만 보고 불렸을 때도
같다. `using-agent-skills`는 길잡이로 쓰지 않는다 — Claude Code는 설명으로 skill을 고르므로 길잡이가 둘이 된다고
작성자가 안내한다([getting-started](https://github.com/addyosmani/agent-skills/blob/main/docs/getting-started.md) "4. Use the meta-skill for discovery when needed").

| 스킬                                        | 언제 읽는가                                                                                                                                                                                      | 이 레포에서는                                                                                                                                                                                                                                                                                                |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `agent-skills:code-review-and-quality`      | PR을 열기 전, 의존성을 올리는 PR에서 변경을 정확성·보안·성능 쪽으로 검토할 때                                                                                                                    | 레이어·네이밍·패턴은 `/code-review`가 정본이다. 내 변경이 만든 고아만 지우고, 원래 있던 죽은 코드·주변 정리는 언급만 한다(공통 지침 "범위"). 수치는 재거나 출처를 단다(공통 지침 "기록"). 조건을 뒤집어 보는 실험은 워크트리에서 하고 사본으로 되돌린다                                                      |
| `agent-skills:debugging-and-error-recovery` | 작업 중 테스트·빌드·린트·e2e가 예상 밖으로 실패하거나, 재현이 안 되는 버그를 조사할 때(사용자가 보고한 버그는 `/fix-bug`)                                                                        | "Safe Fallback Patterns" 절은 따르지 않는다(공통 지침 "범위"). 부하·동시 요청 재현은 운영 BE로 프록시되는 dev 서버나 운영에 하지 않고 MSW·e2e 모킹으로 한다. 실패한 테스트는 요구가 바뀌었을 때만 고친다. `git bisect`는 워크트리에서, 테스트 이름 필터는 vitest `-t`                                        |
| `agent-skills:doubt-driven-development`     | 되돌리기 어려운 판단(인증·세션, 데이터 계약과 배포 순서, 멱등성·동시 요청, 운영 데이터·인프라)을 확정하거나, 타입·테스트로 증명되지 않는 주장("중복이 안 생긴다")에 기대 다음 단계로 넘어가기 전 | 대상은 이 판단들뿐이다(skill의 "non-trivial" 정의는 쓰지 않는다). 외부 모델 검토는 추천할 때만 공통 지침 "사용자가 정할 것" 형식으로 묻는다. 검토자는 general-purpose에 맡기고, 프롬프트에 워킹트리 전체를 바꾸는 git 명령·부하 실행·외부 연결 금지를 넣는다. plan-verifier·`/code-review`를 대신하지 않는다 |

---

## 프로젝트 공통 컨텍스트

- **BE**: Spring Boot + Kotlin, port 8080, context-path `/api`
- **FE**: React + TypeScript + Vite, FSD 아키텍처, port 31119
- **배포**: CloudFront → `/api/*` Lambda(BE), `/*` S3(FE)
- **개발 프록시**: `vite.config.ts` — `/api/*` → `VITE_API_BASE_URL` 환경변수(`.env`) 값으로 프록시(하드코딩된 포트 아님). 이 값은 `/api`까지 포함한 기준 주소(`https://linksphere.click/api`, 로컬 BE면 `http://localhost:8080/api`)라 프록시가 요청 경로의 `/api`를 떼고 넘긴다(2026-10-02, Lambda Function URL은 OAC 잠금 이후 403)
- **커밋**: 작업 전 `.gitmessage` 파일 먼저 읽고 형식 준수
- **PR 머지는 항상 squash** — `gh pr merge <번호> --squash`. 저장소 설정(`allow_merge_commit`/`allow_rebase_merge`)이 꺼져 있어
  다른 방식은 API에서부터 막힌다. `main`에 PR로 병합된 커밋의 제목이 전부 `type(scope): 요약 (#PR번호)` 한 줄이라
  CHANGELOG·릴리즈 노트와 1:1로 대응한다(자동 history·release 커밋은 PR 번호가 없다. 경위: `docs/CI-CHECK-GATE.md`)
- **병합된 PR의 원격 브랜치는 GitHub이 자동으로 지운다** — FE·BE 저장소 설정
  `delete_branch_on_merge=true`(2026-10-12 사용자 결정, 그 전까지 쌓인 병합 브랜치 57개도 같은 날 정리).
  로컬 브랜치와 워크트리는 남으므로, 위 워크트리 규칙대로 병합·배포를 확인한 세션이 `ExitWorktree(action: "remove")`로 정리한다. 지워진 브랜치는
  병합된 PR 화면의 "Restore branch"로 되살릴 수 있다

---

## 릴리즈노트 (CHANGELOG) 관리

레포 루트 `CHANGELOG.md`로 변경 이력을 관리한다(Keep a Changelog + SemVer, 한글 작성).
`feat`/`fix`/`perf`/동작이 바뀌는 `refactor` 커밋 시 같은 커밋에 `[Unreleased]` 섹션 항목
추가를 포함한다. 항목 포맷(요약 줄 72자·`<details>` 블록 규칙)과 릴리즈 시점 절차(버전
승격, 태그 자동화)는 `changelog-release` skill(`.claude/skills/changelog-release/SKILL.md`)에
있다 — CHANGELOG를 쓰거나 버전을 릴리즈할 때 그 skill을 먼저 읽는다(2026-09-09, CLAUDE.md
길이 감사 후 이 절을 분리했다).

## 문서 형식

문서 위치, `docs/` 안 분류, 독립 기능 문서의 내부 순서, 인용 형식 예시는
[`.claude/rules/docs-format.md`](rules/docs-format.md)에 있다. 문서를 읽거나 쓸 때 자동으로 붙고, 새 문서를 만들기 전에는
같은 폴더의 문서를 하나 읽어 규칙이 먼저 보이게 한다.
