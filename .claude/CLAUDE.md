# CLAUDE.md

흔한 LLM 코딩 실수를 줄이기 위한 행동 지침이다. 프로젝트별 지침과 병합해서 사용한다.

**트레이드오프:** 이 지침은 속도보다 신중함을 우선한다. 사소한 작업에는 판단력을 발휘한다.

> 원문 출처: [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills)의
> `CLAUDE.md`. §1~7은 그 문서를 옮기고 이 레포 사정에 맞게 확장한 것이고, §8~10은 여기서 직접 추가했다.

## 1. 코딩 전에 먼저 생각한다

**추측하지 않는다. 혼란을 숨기지 않는다. 트레이드오프를 드러낸다.**

구현하기 전에:

- 가정을 명시적으로 밝힌다. 확신이 없으면 묻는다.
- 여러 해석이 가능하면 모두 제시한다 — 조용히 하나를 고르지 않는다.
- 더 단순한 접근이 있으면 그렇게 말한다. 타당하면 반대 의견을 낸다.
- 무언가 불분명하면 멈춘다. 무엇이 헷갈리는지 명시한다. 묻는다.
- 기존 시스템이 지금 어떻게 동작하는지 주장할 때("우리는 X 패턴을 따른다", "이건 Y
  프레임워크를 그대로 따른 것이다") 먼저 실제 코드 경로를 추적한다 — 비슷하게 생긴
  유틸리티나 외부 프레임워크의 동작 방식으로부터 아키텍처를 추측하지 않는다. 그 주장이
  추적한 사실인지 추측인지 명확히 밝힌다.

## 2. 단순함이 우선이다

**문제를 해결하는 최소한의 코드. 추측성 코드는 없다.**

- 요청받지 않은 기능은 넣지 않는다.
- 한 번만 쓰이는 코드에 추상화를 두지 않는다.
- 요청받지 않은 "유연성"이나 "설정 가능성"을 넣지 않는다.
- 일어날 수 없는 상황에 대한 에러 처리를 하지 않는다.
- 200줄을 썼는데 50줄로 줄일 수 있다면 다시 쓴다.

스스로에게 묻는다: "시니어 엔지니어가 보면 과하게 복잡하다고 할까?" 그렇다면 단순화한다.

## 3. 최소 범위만 수정한다

**꼭 필요한 것만 건드린다. 자신이 만든 것만 정리한다.**

기존 코드를 수정할 때:

- 인접한 코드·주석·포맷을 "개선"하지 않는다.
- 고장 나지 않은 것을 리팩터링하지 않는다.
- 자신의 취향과 다르더라도 기존 스타일을 그대로 따른다.
- 무관한 죽은 코드를 발견하면 언급만 하고 지우지 않는다.

내 변경으로 고아가 생기면:

- 내 변경으로 인해 쓰이지 않게 된 import/변수/함수는 제거한다.
- 원래 있던 죽은 코드는 요청이 없으면 지우지 않는다.

기준: 변경한 모든 줄이 사용자의 요청으로 바로 설명돼야 한다.

## 4. 목표 기반으로 실행한다

**성공 기준을 정의한다. 검증될 때까지 반복한다.**

작업을 검증 가능한 목표로 바꾼다:

- "검증 추가" → "잘못된 입력에 대한 테스트를 작성하고, 통과시킨다"
- "버그 수정" → "버그를 재현하는 테스트를 작성하고, 통과시킨다"
- "X 리팩터링" → "리팩터링 전후로 테스트가 통과하는지 확인한다"

여러 단계로 이뤄진 작업이면 짧은 계획을 먼저 밝힌다:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

강한 성공 기준이 있으면 혼자서도 반복 작업이 가능하다. 약한 기준("일단 되게 만들기")은 계속 확인을 요구하게 만든다.

## 5. 수정 전에 영향 범위를 점검한다

**코드를 쓰기 전에 무엇이 깨질 수 있는지 나열한다. 새로 만드는 것과 이미 동작하는 것, 양쪽 다.**

구현하기 전에 다음을 점검하고 보고한다:

- **CRUD 실패 지점** — 이 변경이 건드리는 데이터에 대해 등록(create) / 수정(update) /
  읽기(read) / 삭제(delete)를 하나씩 짚는다. 각 단계에서 무엇이 깨지는지 명시한다:
  누락된 행, 중복/멱등성, 소유권·가시성 체크, cascade 동작, count/페이지네이션 정확성,
  동시 요청.
- **기존 기능의 회귀** — 깨질 수 있는 모든 기존 동작을 그 동작을 소유한 파일과 함께
  나열한다. 공유 쿼리와 캐시/무효화 경로, 파생 카운트, 이전 계약을 담고 있는 기존
  테스트, 이전 동작을 단정하는 문서·사용자 노출 문구, 여전히 컴파일되는 죽은/미사용
  코드 경로를 포함한다.

두 목록 모두 첫 수정 전에 보고한다, 수정 후가 아니라. 변경이 데이터 계약(스키마, DTO,
API 형태)을 바꾼다면 배포 순서와 그 사이에 무엇이 깨지는지 명시적으로 밝힌다.

## 6. 새로 만들기 전에 선례를 찾는다

**이 코드베이스가 이미 어떻게 풀었는지 찾는다. 그 형태를 그대로 따른다.**

새로운 것을 설계하기 전에:

- 같은 부류의 문제를 푼 기존 기능을 찾아 읽는다.
- 코드를 쓰기 전에 그 선례를 파일 경로로 명시한다.
- 그 형태를 따른다: 레이어링, 네이밍, 캐시/롤백 전략, 에러 소유권.
- 명시한 이유가 있을 때만 벗어난다 — 그리고 그 이유를 밝힌다.

이건 기존 함수를 확장하는 게 아니라 이미 자리 잡은 *형태*를 재사용하는 것이다.
선례를 따르는 새 hook/util을 작성하는 것이 기대되는 결과다.

기준: "어떤 기존 파일을 본떠 만들었는가?"에 항상 답할 수 있어야 한다.

## 7. 사용자가 체감하는 트레이드오프는 승인을 받는다

**기술적 제약의 부수 효과도 UX 결정일 수 있다. 조용히 떠안지 않는다.**

어떤 결정은 순전히 기술적으로 보이지만("Y 때문에 X를 히스토리에 묶을 수 없다")
사용자가 실제로 체감하는 결과를 낳는다("그래서 뒤로가기를 누르면 모달만 닫히는 게
아니라 페이지가 이동한다"). 그 결과는 논리적으로 제약에서 나왔더라도 기술적으로
불가피한 게 아니라 UX 결정이다. 확정된 것으로 취급하기 전에 드러내고 확인받는다.

- 근거가 뒷받침하는 것보다 리서치/선례를 더 강하게 인용하지 않는다. 어떤 출처가
  관련은 있지만 다른 상황을 다룬다면 그렇게 그대로 말한다("X 출처는 Y에 관한 것이지
  정확히 이 케이스는 아니다") — 지금 결정을 뒷받침하는 것처럼 암시하지 않는다.
- 과거 결정에 이의가 제기되면, 방어하기 전에 근거를 다시 검증한다. 더 확신에 찬
  말투로 되풀이하기보다 원래 주장이 실제로 성립하는지 확인한다.
- 사용자에게 묻고 동의를 받은 순간을 짚을 수 없다면, 대신 결정해버린 것이다 —
  뒤늦게라도 그 사실을 알리고 확인받는다.

기준: 내가 전달한 내용만 보고도 사용자가 "이건 내가 관여하지 못한 판단이었다"는 걸
알아챌 수 있는가? 그렇지 않다면 사용자 대신 결정한 것이다.

## 8. UI/UX 결정은 리서치와 선례에 근거한다

**취향만으로 UI/UX를 설계하지 않는다. 근거를 인용한다.**

작업이 UI/UX 판단(레이아웃, 순서, 인터랙션 패턴, 정보 구조 — 단순 시각적 다듬기가
아닌)을 포함한다면, 직관이 아니라 근거가 필요한 다른 모든 엔지니어링 결정과 동일하게
다룬다:

- 관련 HCI/심리학 리서치를 찾아 실제로 무엇을 발견했는지 인용한다 — 기억에 그럴듯하게
  남아있는 것에 의존하지 않는다.
- 이미 자리 잡은 제품들이 같은 문제를 어떻게 풀었는지, 문서화된 실패 사례를 포함해서
  살펴본다(출시했다가 없앤 기능이 성공 사례보다 더 강한 근거인 경우가 많다).
- 대안을 명시적으로 비교하고(표가 잘 맞는다) 채택되지 않은 선택지가 왜 졌는지도
  같이 기록한다 — 무엇이 이겼는지만 남기지 않는다.
- 근거를 프로젝트의 설계 결정 기록(`docs/DECISIONS.md` 또는 해당 기능 문서, 예:
  `docs/BOOKMARK.md`)에 남겨 이 대화가 끝난 뒤에도 그 근거가 남게 한다.

기준: 나중에 이 결정에 이의가 제기되면, 구체적인 연구나 제품 선례를 짚을 수 있는가
— 아니면 그냥 "이게 더 나아 보인다"고만 말했는가?

## 9. 시각적 변경은 반영 전에 먼저 보여준다

**간격, 정렬, 구분선, 색 — 화면을 보여준다, 설명하지 않는다.**

어떤 변경은 기능적으로는 맞지만 시각적으로는 취향의 문제다: 간격 크기, 구분선이
도움이 되는지 방해가 되는지, 정렬 방식. 이런 것에 대한 텍스트 설명은 양방향으로
믿을 수 없다 — 읽는 사람은 설명만으로 실제 모습을 예측하기 어렵고, 쓰는 사람도 그
설명이 어떻게 읽힐지 예측하기 어렵다. 코드부터 반영하고 배포 후에야 알아채는 것
("이 간격 너무 넓다")이 이 규칙이 막으려는 실패 패턴이다(이 규칙을 만들게 된 사건은
`docs/DECISIONS.md`, 2026-09-06 참고).

- 실제 변경을 작성하기 전에, 정적 미리보기를 먼저 만든다 — 실제로 동작 중인
  컴포넌트의 스크린샷이거나, 실제 Tailwind 클래스와 `globals.css` 색 토큰을 그대로
  재사용한 가벼운 목업이어야 한다 — 근사치가 아니라 실물처럼 보여야 한다.
- 합리적인 옵션이 둘 이상이면, 사용자가 설명만으로 각각을 상상하게 하지 말고 한
  자리에 나란히 배치해서 만든다(Artifact 페이지 하나면 충분하다). 나란히 비교하면
  하나씩 순서대로 보는 것보다 더 나은 선택이 나온다(parallel prototyping 리서치 —
  `docs/DECISIONS.md`, 2026-09-06 참고).
- 사용자가 미리보기를 보고 옵션을 고르거나 승인한 뒤에만 실제 컴포넌트에 반영한다.

이건 시각/레이아웃 다듬기에 적용되는 것이지, 정답이 하나뿐인 기능적 변경에는
적용하지 않는다 — 정답이 명백한 버그 수정에는 미리보기를 만들지 않는다.

## 10. 외부에서 인용한 수치·주장은 원본을 남긴다

**성능 수치든 업계 통계든, 검증 가능해 보이는 구체적인 숫자를 인용할 때는 그 자리에 원본을 함께 남긴다. 링크가 없으면 "출처 미상"이라고 명시한다.**

§8(UI/UX 리서치 근거)이 UI/UX 판단에 국한되는 것과 달리, 이 규칙은 코드 주석·커밋
메시지·문서를 가리지 않고 아키텍처·성능·라이브러리 선택 등 모든 종류의 외부 인용에
적용된다. "배럴 파일은 dev 부팅 15-70%·빌드 28%·콜드스타트 40% 지연을 유발한다"처럼
출처 없이 떠도는 구체적인 수치가 `eslint.config.js`와 `docs/FE-ARCHITECTURE.md`에
그대로 박제된 채 몇 달간 아무도 그 근거를 확인할 수 없었던 사례(2026-09-08 발견)가
이 규칙을 만들게 된 계기다.

- 직접 측정한 값이면 "직접 측정"이라고 밝히고 측정 방법(스크립트, 재현 절차, 실행
  결과)을 남긴다.
- 외부 자료를 인용한 값이면 그 URL을 코드 주석·커밋 메시지·문서 중 인용이 등장하는
  자리에 함께 적는다. 주석에 넣기엔 길면 짧은 근거만 남기고 `docs/DECISIONS.md`나
  해당 기능 문서에 원본 링크와 함께 상세 근거를 적은 뒤 그 문서를 가리킨다.
- 둘 다 아니면(기억에 의존한 값, 어디선가 본 것 같은 수치) "출처 미상, 재검증 필요"
  라고 명시한다 — 검증된 값처럼 단정적으로 쓰지 않는다.
- 레포에서 출처 없는 기존 인용을 발견하면, 새로 조사해 확정하기 전까지는 그 자리에
  "출처 미상"이라고 표시해 둔다.

기준: 이 수치는 어디서 왔냐고 나중에 물었을 때, 클릭 가능한 링크나 "내가 이렇게
측정했다"는 재현 절차로 바로 답할 수 있는가? 둘 다 안 되면 애초에 그 수치를 확정된
사실처럼 쓰지 않는다.

## 11. 계획을 세웠으면 배포 전에 계획과 실제 구현을 대조한다

**"계획대로 됐다"는 스스로 판단하지 않는다. fresh subagent에게 diff를 계획과 대조시켜
증거로 보여준다.**

Plan mode로 계획을 세우고 구현한 작업은, PR을 열기 전에:

- 계획 파일을 `docs/plans/<YYYY-MM-DD>-<slug>.md`로 구현 코드와 같은 PR에 커밋한다.
  plan mode를 거치지 않은 사소한 즉시 구현에는 적용하지 않는다(계획을 세울 만큼
  중요한 작업만 이 절차의 대상이다).
- 구현한 세션 스스로 "계획대로 됐다"고 결론 내리지 않는다 — 방금 쓴 코드에 편향되기
  쉽다. 대신 fresh subagent(Explore 타입)에게 커밋한 계획 파일과 실제 diff를 함께
  주고 대조를 맡긴다: 계획의 각 항목이 실제로 구현됐는가, **계획에 없던 변경(과잉
  구현 포함)이 섞였는가**, 계획과 다르게 구현된 부분이 있다면 왜인가.
- 대조 결과를 계획 항목별로 "구현됨(파일:줄)/이탈(이유)/미구현" 형태로 정리해 PR
  본문에 `## 계획 대비 구현` 섹션으로 남기고, `docs/plans/`의 해당 파일을 링크한다
  (원문을 PR 본문에 다시 붙여넣지 않는다 — 커밋된 파일과 중복되면 SSOT가 깨진다).
  CI green만 보고 머지하는 게 아니라, 계획이 실제로 지켜졌는지 그 자리에서 확인할
  수 있어야 한다.
- 이 대조는 "올바른 모양인가"(→ `/code-review`가 이미 다룬다)가 아니라 "약속한 것을
  만들었는가"만 본다. 포맷팅·린트 수정처럼 구현 중 자연스럽게 필요했던 세부 조정은
  이탈로 꼽지 않는다 — 계획에 명시된 설계 결정(트레이드오프 선택, 트리거 조건 등)이
  실제로 다르게 구현된 경우만 이탈로 표시한다.
- `docs/plans/*.md`는 커밋된 뒤 수정하지 않는다(append-only, ADR·DB 마이그레이션
  파일과 같은 컨벤션). CI가 기존 파일의 수정을 막는다(`ci.yml`의 "docs/plans 불변성
  확인" 스텝) — 이탈은 새 파일이 아니라 PR 본문에 적는다.

기준: PR을 읽는 사람이 코드를 한 줄도 안 읽고 이 섹션만 봐도 계획과 실제가 일치하는지
판단할 수 있는가?

## 12. 여러 단계를 거치는 흐름은 다이어그램으로도 보여준다

**텍스트만으로 설명하지 않는다. 단계·분기·실패 지점이 여러 개면 그림을 곁들인다.**

**Plan 모드로 Final Plan을 작성하는 시점에 이 규칙이 적용된다** — 파일 경로가 아니라
이 행위 자체가 대상이다. Plan 모드 Phase 4("Final Plan 작성")는 Claude Code 하네스에
내장된 고정 틀(Context 섹션·핵심 파일·검증 방법을 요구)이고, 이 틀 자체는 `.claude/`
설정으로 편집할 수 없다 — **그 틀이 다이어그램을 요구하지 않는다고 이 규칙이 면제되지
않는다.** 계획에 단계·분기·실패 지점이 여럿이면, 하네스가 요구하는 섹션들과 나란히
전체 흐름을 보여주는 Mermaid 섹션을 넣는다.

같은 기준이 계획 이외의 설명에도 적용된다: 여러 단계를 거치는 흐름(요청→처리→저장),
실패 지점이 여러 곳인 진단, 분기가 있는 설계 대안, 작업 순서를 설명할 때는 산문만으로
끝내지 않는다.

- 파일(Plan 모드가 실제로 쓰는 `~/.claude/plans/<slug>.md`, 구현 후 커밋되는
  `docs/plans/*.md`, 독립 기능 문서, PR 본문)에는 **Mermaid**를 쓴다 — GitHub과 대부분의
  에디터가 도형으로 렌더한다.
- 터미널 대화 답변에는 **ASCII 다이어그램**을 쓴다 — 터미널은 Mermaid 코드 펜스를 그림이
  아니라 텍스트 그대로 보여주므로 목적을 이루지 못한다.
- 단일 파일 한 줄 수정처럼 흐름이랄 게 없는 작업에는 적용하지 않는다.

독립 기능 문서(`docs/<기능명>.md`)에 대한 "장 끝에 전체 흐름 Mermaid 순서도 필수" 규칙은
이미 "독립 기능 문서 내부 순서" §1에 있다 — 이 절은 그 범위를 Plan 모드 계획 작성·PR
본문·대화 답변까지 넓힌 것이다(2026-09-04 BE 세션에서 같은 요청이 있었는데 그때는 독립
기능 문서 규칙으로만 반영돼, 2026-09-09 계획 설명 때 같은 지적을 다시 받았다 — 원인
조사 결과 CLAUDE.md는 세션 시작 시 스냅샷되므로 이 규칙이 생긴 이후 시작된 세션에서만
자동으로 적용된다).

**안전망(2차 수단)**: `.claude/hooks/plan-diagram-reminder.sh`가 `PostToolUse` 훅으로
등록돼 있다. 계획 파일(경로에 `/plans/`가 들어가는 `.md`)을 Write/Edit/MultiEdit한 직후,
150줄(`wc -l` 기준, `PLAN_DIAGRAM_MIN_LINES` 환경변수로 조정 가능) 이상인데 Mermaid
펜스가 없으면 이 규칙을 상기시키는 메시지를 그 자리에서 띄운다. 정말 흐름이 없는
계획이면 파일 안에 `<!-- no-diagram: (이유) -->` 한 줄을 남기면 확인이 멈춘다. 이 훅은
**한계가 있다**: `~/.claude/plans/` 저장 시점만 잡는다 — `docs/plans/`로의 스냅샷 복사는
Write가 아니라 `cp`로 이뤄지고, git 추적 파일은 §11 append-only 보호 때문에 훅이
건드리지 않는다. 즉 이 훅은 Plan 모드 작성 시점에 이 규칙을 놓쳤을 때의 보완책이지,
1차 수단은 여전히 Final Plan을 쓸 때 이 절을 직접 따르는 것이다.

기준: 이 설명을 읽는 사람이 글을 한 줄도 안 읽고 그림만 봐도 전체 흐름을 따라올 수 있는가?

---

**이 지침들이 잘 작동하고 있다는 신호:** diff에 불필요한 변경이 줄어들고, 과하게
복잡하게 만들어 다시 쓰는 일이 줄어들고, 구현 후가 아니라 구현 전에 확인 질문이
나온다.

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
- **Never** 날짜 처리에 `new Date()` / `.getTime()` 직접 사용 → 항상 `dayjs` 사용 (`dayjs(value).valueOf()`, `dayjs().format()` 등). ESLint `no-restricted-syntax`로 강제된다(`eslint.config.js`) — 2026-03-15에 이 규칙이 추가된 뒤로도 문서 규칙에만 의존해 5개월간 위반이 안 잡혔던 사례(`entities/folder/model/useRecentFolders.ts`, 2026-08-12 작성 — 이후 `entities/bookmark/folder/hooks/`로 이동)가 있어 2026-09-08 ESLint로 승격
- **Never** 대상 파일 양식 무시하고 코드 생성 → 항상 붙여넣을 파일(및 인접 코드)을 **먼저 읽고** 들여쓰기·네이밍·import 순서·따옴표·주석 밀도·정렬을 그대로 맞춘다. 본인 스타일을 강요하거나 기존 코드를 재포맷하지 않는다
- **Never** raw HTML 요소로 UI를 일회성 구현 → 항상 공통 컴포넌트(`shared/ui/atoms`·`elements`·`widgets`) 우선. 반복되는 UI는 공통 컴포넌트를 만들거나 기존 것을 사용해 디자인을 단일 관리한다 (예: 버튼은 raw `<button>` 대신 `Button` 컴포넌트). 신규 코드 기준
- **Never** `shared/ui/atoms`·`elements`에 컴포넌트를 추가하거나 시각적으로 변경하고 스토리 없이 커밋 → 항상 같은 커밋에 `<Component>.stories.tsx`를 함께 만들거나 갱신한다. `.storybook/main.ts`의 글롭이 `src/**/*.stories.tsx`를 자동 인식하므로 파일만 만들면 된다 (예시: `checkbox.tsx`+`checkbox.stories.tsx`, `switch.tsx`+`switch.stories.tsx`)
- **Never** `if`문을 인라인으로 작성 (`if (x) return;`) → 항상 중괄호 블록으로 감싼다 (`if (x) {\n  return;\n}`). 한 줄짜리 본문도 예외 없음 (ESLint `curly: ['error', 'all']` 규칙으로 강제 중)
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
4. `npm run check:docs` — README/docs/CLAUDE.md가 가리키는 경로·줄 번호가 실제와
   맞는지 확인 (`README.md`, `docs/*.md`, `.claude/CLAUDE.md`를 수정한 경우)

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

## 패턴 레퍼런스

아래 패턴들은 코드 예제와 함께 [`docs/FE-ARCHITECTURE.md`](../docs/FE-ARCHITECTURE.md)에
정본으로 있다 — 여기 복사해두지 않는다(두 곳에 같은 코드를 유지하면 한쪽만 갱신되고 다른
쪽이 낡는 문제가 실제로 있었다, 2026-09-07). 패턴을 쓸 때는 해당 절을 **먼저 읽는다**.

| 패턴                                                                               | 정본 | 한 줄 요약                                                                                     |
| ---------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------- |
| 3-Layer API (`*.api.ts` → `*.keys.ts` → `*.queries.ts`) + 크로스 엔티티 무효화     | §5   | 레이어를 건너뛰거나 합치지 않는다. 다른 엔티티 캐시는 그 엔티티의 `InvalidateQueries` 래퍼로만 |
| Feature Hook (`hooks/`에 로직 전부, `ui/`는 JSX만)                                 | §6   | UI 파일은 훅 호출 + 렌더링만                                                                   |
| Widget Hook (entity query 조합 + 파생 상태, mutation 없음)                         | §8   | query 1개 + trivial 파생만이면 컴포넌트에서 직접 사용                                          |
| Zod Schema (`z.infer`로 타입 파생)                                                 | §9   | `nullable()`=null 허용, `optional()`=undefined 허용                                            |
| Delete with Confirm                                                                | §10  | native `confirm()` 금지, 항상 `useAlert` + `openConfirm`                                       |
| Optimistic Update (`onMutate` → `cancelQueries` → `setQueryData` → 롤백)           | §11  | 참조 구현: `entities/interaction/api/interaction.queries.ts`                                   |
| Util Class (`*.util.ts`는 바레 함수 대신 `export class <Name>Util { static ... }`) | §23  | 함수 하나뿐이어도 클래스로 감싼다 — `shared/utils/`의 7/8 파일이 이 형태                       |

---

## 에러 핸들링 전략

### 토스트 단일 소유 원칙 (중복 방지)

**에러 토스트의 유일한 기본 소유자는 React Query 전역 핸들러(`queryClient.ts`)다.**

- transport 레이어(`shared/api/client.ts`)는 UI 토스트를 띄우지 않는다 — 인증 정리·throw만.
- mutation 에러는 전부 `mutationErrorHandler`를 지나가며, `meta.manualErrorHandling`이 없으면 거기서 토스트 1개가 자동으로 뜬다 ([queryClient.ts](src/shared/lib/react-query/config/queryClient.ts) `if (meta?.manualErrorHandling) return;`).

> ⚠️ **Never** mutation `onError`나 그 mutation을 쓰는 컴포넌트 `catch`에서 `toast.`를 직접 부르면서 `meta.manualErrorHandling`을 빼먹지 말 것 → 전역 토스트와 겹쳐 **두 번 뜬다**. 직접 토스트를 띄우면 반드시 `manualErrorHandling: true`.

### 새 mutation 만들 때 토스트 결정표

| 원하는 동작                           | 설정                                  | 결과                     |
| ------------------------------------- | ------------------------------------- | ------------------------ |
| 일반 에러 토스트면 충분               | (없음)                                | 전역이 `serverError` 1개 |
| 메시지만 커스텀                       | `meta: { errorMessage }`              | 전역이 그 메시지 1개     |
| `onError`/컴포넌트에서 **직접** toast | `meta: { manualErrorHandling: true }` | 내 토스트만 1개          |
| 옵티미스틱 토글(실패 시 롤백만)       | `meta: { manualErrorHandling: true }` | 토스트 없이 롤백         |

전역 자동 처리 규칙 상세와 `manualErrorHandling` 코드 예제는
[`docs/FE-ARCHITECTURE.md`](../docs/FE-ARCHITECTURE.md) §13을 먼저 읽는다.

---

## React Query 설정 / 핵심 설정 파일

값과 경로 목록은 [`docs/FE-ARCHITECTURE.md`](../docs/FE-ARCHITECTURE.md) §12·§17이 정본이다 —
값이 필요할 때 먼저 읽는다.

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

| 위치                          | 규칙                                                                                                 | ✅                                                 | ❌                                |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------- |
| `features/<domain>/` 슬라이스 | **원칙적으로 동사(액션)만.** 단, 슬라이스 자체가 완결된 사용자 액션/flow일 때는 명사 허용(아래 각주) | `create/`, `like/`, `delete/`, `login/`, `signup/` | `create-post/`, `createPost/`     |
| `widgets/<domain>/` 슬라이스  | **`<entity>-<role>`** kebab-case 명사                                                                | `post-card/`, `post-list/`                         | `postCard/`, `PostCard/`          |
| `app/layouts/`                | **`<name>-layout`**                                                                                  | `app-layout/`, `auth-layout/`                      | `appLayout/`, `AppLayout/`        |
| 슬라이스 내부                 | **역할명 단수 소문자**                                                                               | `hooks/`, `ui/`, `utils/`                          | `hook/`, `UI/`, `utils-fn/`       |
| 도메인 폴더                   | **단수 소문자**                                                                                      | `post/`, `comment/`, `user/`                       | `posts/`, `Post/`, `user-domain/` |
| 내부 전용 폴더                | **`_` 접두사**                                                                                       | `_base/`                                           | `base/`, `__base__/`              |
| `shared/lib/`                 | **라이브러리명 그대로**                                                                              | `react-query/`, `firebase/`                        | `reactQuery/`, `query/`           |
| 에러 페이지                   | **HTTP 상태코드**                                                                                    | `404/`, `500/`                                     | `not-found/`, `error/`            |
| `pages/` 복합어               | **붙여쓰기**                                                                                         | `mypage/`                                          | `my-page/`, `myPage/`             |

**`features/<domain>/` 슬라이스의 명사 허용 각주** (2026-09-08 정정) — 이 규칙은
FSD가 강제하는 게 아니다. FSD 공식 정의([FAQ](https://feature-sliced.design/docs/get-started/faq)):
"An _entity_ is a real-life concept that your app is working with. A _feature_ is
an interaction ... **the thing people want to do** with your entities" — 즉 feature
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

| 레이어                | 허용 세그먼트                                          | 규칙                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `entities`            | `api/`, `hooks/`, `model/`, `ui/`, `config/`, `utils/` | `model/`은 스키마·타입 정의 전용(`*.schema.ts`). 훅·비즈니스 로직은 `hooks/`, 상수는 `config/`, 순수 함수는 `<entity>.util.ts`로 `utils/`에(선례: `shared/utils/date.util.ts`·`common.util.ts` — 파일 접미사는 단수 `.util.ts`, 파일명은 함수명이 아니라 엔티티명). `ui/`에는 그 엔티티의 **시각적 표현**만 둔다 — 폼·버튼처럼 사용자가 무언가를 _하는_ 인터랙션 UI는 `features`에 둔다(출처: [FSD 공식 레이어 정의](https://feature-sliced.design/docs/reference/layers) — entities UI는 _"the visual representation... reused across several pages"_, features UI는 _"the UI to perform the interaction like a form"_) |
| `widgets`, `features` | `hooks/`, `ui/`, `utils/`, `config/`                   | 컴포넌트가 하나라도 있으면 반드시 `ui/` 아래에 둔다 — 슬라이스 루트에 직접 두지 않는다                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `pages`               | 세그먼트 없음                                          | 페이지 컴포넌트를 슬라이스 폴더에 바로 둔다                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

### entities의 그룹 폴더

도메인 이름 하나만으로 맥락이 안 드러날 때(예: `folder`가 북마크 폴더인지 다른 폴더인지
불분명했던 사례), `features`·`widgets`가 이미 쓰는 그룹 폴더 패턴(`features/bookmark/toggle/`,
`widgets/bookmark/folder-tree/`)을 entities에도 쓸 수 있다 — 예: `entities/bookmark/folder/`.
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

| 항목          | 내용                                                                      |
| ------------- | ------------------------------------------------------------------------- |
| 테스트 러너   | Vitest 4.x + jsdom                                                        |
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

전체 목록은 [`docs/FE-ARCHITECTURE.md`](../docs/FE-ARCHITECTURE.md) §19를 먼저 읽는다. `/api` 프록시
대상은 하드코딩된 포트가 아니라 `VITE_API_BASE_URL` 환경변수(`.env`)다.

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

## 체크리스트

기존 엔티티에 새 기능을 추가할 때, 새 도메인을 추가할 때의 체크리스트는
[`docs/FE-ARCHITECTURE.md`](../docs/FE-ARCHITECTURE.md) §21·§22이 정본이다 —
작업 시작 전 먼저 읽는다.

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
  (`features/post/create/ui/BookmarkFolderPicker.tsx`(신규),
  [PR #21](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/21))

  </details>
```

- 요약 줄: `` `스코프` `` + 공백 + 한 줄(72자 이내, 줄바꿈·마침표 없음). 굵게(`**`) 쓰지 않는다.
  스코프는 `post` `comment` `auth` `user` `bookmark` `shared` 중 하나.
- 상세 블록: `<summary>`는 `배경·구현`으로 통일. `<summary>` 다음과 `</details>` 앞에 빈 줄을
  반드시 넣는다(없으면 GitHub이 안의 마크다운을 파싱하지 않는다). 배경·트레이드오프·영향
  파일 목록을 요약 없이 그대로 적는다 — 짧은 항목은 상세 블록을 생략해도 된다.
- **PR이 만들어지면 그 항목의 파일 목록 끝에 PR 링크를 추가한다.** 처음 커밋 시점엔 PR 번호를 아직 모르므로 `[Unreleased]` 항목 추가 커밋에는 포함하지 못한다 — `gh pr create`로 PR을 만든 직후 그 URL을 `[PR #NN](URL)` 형식으로 파일 목록 괄호 끝에 덧붙이고, 이 한 줄만 고치는 작은 후속 커밋(`docs(changelog): PR 링크 추가` 등, amend 아님 — Git Safety Protocol)을 머지 전에 같은 브랜치에 push한다. 커밋 해시가 아니라 PR을 가리키는 이유: 이 레포는 항상 워크트리+PR을 거쳐 머지되어 PR이 늘 존재하고, PR 번호는 생성 시점에 고정돼 이후 같은 브랜치에 커밋이 늘거나 rebase가 일어나도 바뀌지 않는 반면 커밋 해시는 amend·force-push로 쉽게 깨진다. PR 없이 직접 머지하는 예외 상황이면 커밋 해시 링크로 대체한다. 이 규칙은 지금부터의 새 항목에만 적용하고 기존 항목은 소급 적용하지 않는다(전체 기록: `docs/DECISIONS.md` "CHANGELOG 항목에서 커밋/PR 상세로 연결되는 링크 추가" 참고).
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

새 문서를 쓰기 전에 아래 여섯 종류 중 어느 것인지 먼저 정하고, 한 문서에 여러 목적을
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
- **작업 계획**(`docs/plans/<YYYY-MM-DD>-<slug>.md`) — plan mode로 세운 계획의
  스냅샷. 구현 코드와 같은 PR에서 커밋하고, 커밋된 뒤에는 고치지 않는다(append-only,
  `DECISIONS.md`와 같은 성격 — "무엇을 의도했는지"의 기록. CI가 기존 파일 수정을
  막는다). "무엇이 실제로 됐는지"는 이 파일이 아니라 PR 본문의 `## 계획 대비 구현`
  섹션이 이 파일을 링크해서 대조한다.

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
