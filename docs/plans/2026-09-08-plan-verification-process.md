# 배포 전 "계획 대비 구현" 검증 프로세스 수립

## Context

이번 세션에서 두 레포(FE #31, BE #7)에 대해 plan mode로 계획을 세우고 승인받은 뒤
구현·PR까지 진행했다. 그 직후 사용자가 물은 것은 "배포가 잘 됐는지 확인하는 문서"가
아니라 더 근본적인 질문이었다: **"내가 세운 계획대로 실제 구현이 됐는지를, 지금까지
배포 전에 확인하지 않고 진행해왔다"**는 것. 이 gap을 메우는 프로세스를 수립해야 한다.

조사 결과, 이 gap은 실제로 존재한다:

- `~/.claude/plans/`에 계획 파일이 60개 쌓여 있지만(1개월치), 레포·PR 어디에도 연결되지
  않는다. 계획을 다시 열어보는 관행 자체가 없다.
- 두 레포의 기존 PR 본문(FE #24~#31, BE #2~#7)은 전부 "무엇을 했는지" 서술이지 "계획과
  대조"가 아니다. `docs/DECISIONS.md`에도 계획 대비 이탈을 명시한 항목이 사실상 없다
  (97KB 문서에서 괄호 안 부연 1건뿐).
- 기존 CLAUDE.md 규칙(FE §4·§5, "작업 후 검증" 4단계, `/code-review`, `/fix-bug`)은 전부
  (a) 구현 _전_ 사전 선언/승인, (b) 구현 _후_ 기계적 검사(type-check/test/lint), (c) 코드의
  *모양*이 규약을 따르는지 보는 리뷰 — 세 종류뿐이다. "약속한 것을 실제로 만들었는가"를
  묻는 축이 통째로 비어 있다.

이 gap은 이미 알려진 문제다. Anthropic의 공식 Claude Code 가이드가 정확히 이 상황에
대한 처방을 갖고 있다:

> "To check the diff against your plan instead, write the review prompt yourself. Name
> the work to check, the plan to check it against, and what counts as a finding... Because
> the reviewer runs as a subagent, the implementing session receives the gaps directly...
> A fresh context improves code review since Claude won't be biased toward code it just
> wrote." — [Claude Code Best Practices §Add an adversarial review step](https://code.claude.com/docs/en/best-practices)

같은 문서의 "Have Claude show evidence rather than asserting success"와 "The
trust-then-verify gap... Fix: Always provide verification"도 같은 방향을 가리킨다.
업계에서도 spec-driven development가 같은 문제를 다룬다 — "코드가 명세로 추적되지
않는" 것 자체를 실패 패턴으로 규정하고, PR 단계에서 각 승인 기준을 diff·테스트 증거에
매핑하는 "Acceptance Mapping" 템플릿(`AC-N <설명>: <근거>` 형태, [spec-coding.dev PR
checklist](https://spec-coding.dev/ai-coding-pr-review-checklist))을 쓴다.

공식 문서뿐 아니라 실제 프랙티셔너·팀들이 문서화한 워크플로우도 같은 방향으로
수렴한다:

- **Tyler Burleigh(개인 실무자)의 "Research, Plan, Implement, Review" 워크플로우** —
  실제로 쓰는 프롬프트를 그대로 공개했다: _"New session. 'Review the implementation of
  Phase 1 against PLAN.md as a senior engineer.'"_, 최종적으로는 _"'Review all changes
  on this branch as a senior engineer.' This is a holistic review"_. 복잡한 작업은
  `PLAN-CHECKLIST.md`로 단계를 쪼개 진행 상황을 추적하고, 리뷰 단계에서 **"agent가
  과설계(over-engineer)한 부분이 있는지도 함께 찾게 한다"** — 미구현뿐 아니라 계획에
  없던 과잉 구현도 이탈로 본다. ([tylerburleigh.com](https://tylerburleigh.com/blog/2026/02/22/))
- **Hartley Brody(개인 실무자)의 "Markdown is the new source code"** — 계획 파일은
  `.scratch/plan/`처럼 **임시(스크래치) 위치**에 두고 레포에 영구 커밋하지 않는다.
  대신 **PR을 만드는 시점에 계획 문서 전문을 PR 본문에 포함하되, `<details>` 태그로
  접어서** 평소엔 안 보이고 필요할 때만 펼쳐보게 한다.
  ([blog.hartleybrody.com](https://blog.hartleybrody.com/markdown-research-planning/))
- **GitHub 공식 Spec Kit** — `constitution.md`(프로젝트 원칙, 최초 1회 작성) →
  `spec.md`(무엇을 만들지, 기술 스택 배제) → `plan.md`(기술 스택·아키텍처) →
  `tasks.md`(실행 가능한 작업 목록) 4개 파일을 **레포에 커밋해 팀 전체가 리로드할 수
  있는 공유 컨텍스트**로 삼는다. ([github.blog](https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/), [spec-kit repo](https://github.com/github/spec-kit))
- **axify.io(팀 단위 운영 가이드)** — "Correctness review checks requirements"를
  보안 리뷰·스타일 리뷰와 **별도 패스**로 명시. 이 레포의 `/code-review`(스타일·아키텍처
  준수)와 이번에 만들 "계획 대비 구현" 대조(요구사항 충족 여부)를 분리하는 설계와
  일치한다. ([axify.io](https://axify.io/blog/claude-code-best-practices))
- **Scott Logic — Spec Kit 실전 투입 후기(2025-11-26)** — 실제 프로덕션 코드베이스에
  Spec Kit 풀 파이프라인을 적용해보니 **plan 단계 하나가 마크다운 2,000줄 이상을
  뽑아냈고, 그중 406줄짜리 research 문서는 중복이었다.** 같은 작업을 일반 반복
  프롬프팅으로 했을 때보다 **체감 10배 느렸다.** 결론: "1회성 프로토타입·사소한
  수정·이미 실패하는 테스트 하나로 정의되는 작업"에는 세리머니가 과하고, 이 세리머니가
  값을 하는 지점은 **"중요한 기능, 기존 코드 위에 얹는 변경(brownfield), 여러 명이
  참여하는 팀, 규제 대상 업무"**뿐이다. ([blog.scottlogic.com](https://blog.scottlogic.com/2025/11/26/putting-spec-kit-through-its-paces-radical-idea-or-reinvented-waterfall.html))
- **git worktree 기반 병렬 AI 에이전트 운영의 일반론(3rd-party 블로그)** — 여러
  에이전트가 워크트리로 병렬 작업할 때 자리 잡은 패턴은 "모든 에이전트가 함께 읽는
  **공유 작업 문서**"이며, 각 에이전트가 작업을 집어 진행 중으로 표시하고 끝나면
  완료로 표시한다. ([augmentcode.com](https://www.augmentcode.com/guides/git-worktrees-parallel-ai-agent-execution))
  **다만 이 근거는 아래에서 Anthropic 공식 Agent Teams 문서로 재검증한 뒤 기각한다** —
  Anthropic 자신의 구현은 정반대로 하고 있었다.
- **Anthropic 공식 "Agent Teams" 문서 — 결정적 반증** — 여러 Claude Code 세션이 팀으로
  협업할 때 쓰는 공식 메커니즘(이 환경의 `Agent`/`ListAgents`/`SendMessage` 도구가 바로
  이 계열)은 공유 작업 목록·팀 상태·메일박스를 **전부 호스트 로컬**에 둔다
  (`~/.claude/teams/{team-name}/config.json`, `~/.claude/tasks/{team-name}/`,
  `~/.claude/teams/{team-name}/inboxes/*.json`) — **레포에는 전혀 커밋하지 않는다.**
  문서가 명시적으로 못 박는다: _"There is no project-level equivalent of the team
  config. A file like `.claude/teams/teams.json` in your project directory is not
  recognized as configuration; Claude treats it as an ordinary file."_
  ([code.claude.com](https://code.claude.com/docs/en/agent-teams))

**핵심 설계 원칙(수렴한 근거로 확정)**: 이 대조는 구현한 세션 스스로가 아니라 **fresh
subagent/새 세션**이 해야 한다 — Anthropic 공식 가이드와 Tyler Burleigh 둘 다 독립적으로
같은 결론("New session")에 도달했다. 검증 대상은 미구현뿐 아니라 **계획에 없던
과잉 구현(scope creep)**도 포함한다. 그리고 "코드가 올바른 모양인가"(이미
`/code-review`가 함)가 아니라 "약속한 것을 실제로 만들었는가"만 본다. (아래 Agent
Teams 조사로 다시 확인: Anthropic은 "여러 에이전트가 서로 메시지를 주고받으며
조율해야 하는 일"에만 team을 쓰고, "결과만 필요한 집중된 작업"에는 가벼운 subagent를
쓰라고 스스로 구분한다 — 이번 대조는 정확히 후자다. 팀을 새로 꾸릴 이유가 없다.)

사용자가 이미 확정한 것: 결과는 **PR 본문의 전용 섹션**에 남기고(GitHub에 영구
보존, 머지 시점에 바로 보임), **매번 자동으로**(plan mode를 거친 작업이면 예외 없이)
실행한다.

### 계획 파일을 레포에 커밋할지 — 판단

**결론: 커밋한다. 단, 앞서 든 "워크트리끼리 서로 못 본다"는 근거는 틀렸다는 걸 먼저
정정한다.** Anthropic 공식 Agent Teams 문서를 확인한 결과, 진짜 멀티에이전트
**협업**(같은 팀이 실시간으로 작업을 나눠 갖고 서로 메시지를 주고받는 것)은
Anthropic 스스로도 레포에 커밋하지 않는다 — 호스트 로컬 JSON으로만 관리하고, 세션이
끝나면 팀 설정은 지워진다. 이유를 따져보면 타당하다: 작업 클레임(pending→in
progress→completed) 같은 상태는 수 초 단위로 바뀌는데, 이런 걸 매번 커밋하면 git
히스토리가 프로세스 잡음으로 오염되고, 여러 워크트리가 그걸 보려면 매번 커밋·푸시·풀을
거쳐야 해서 오히려 협업 속도를 늦춘다. 그리고 애초에 이번에 만드는 "계획 대비 구현"
대조는 **같은 세션 안에서** fresh subagent를 부르는 것이라(Agent 도구로 스폰),
그 subagent는 워크트리 안에서도 절대경로로 `~/.claude/plans/...`를 그냥 읽을 수
있다 — 다른 워크트리·다른 세션이 실시간으로 봐야 할 이유가 원래 없었다.

**그런데도 결론이 바뀌지 않는 이유: 애초에 두 가지를 섞어서 물었던 것이다.**

- (A) **실시간 협업 상태**(누가 무슨 작업을 진행 중인가) — Anthropic의 답은 명확히
  "호스트 로컬, 커밋 안 함"이고, 이 환경에 이미 `Agent`/`ListAgents`/`SendMessage`로
  구현돼 있다. 이 프로세스가 새로 만들 이유도, 만들 것도 없다 — 있는 걸 또 만들면
  중복이다.
- (B) **완료된 작업 하나가 "무엇을 하기로 했고 실제로 뭘 했는지"의 영구 기록** — 이건
  전혀 다른 문제다. 실시간 협업이 아니라 **감사·추적 가능성(traceability)**의
  문제이고, 이 레포에 이미 있는 `docs/DECISIONS.md`가 정확히 이 역할(되돌리기 어려운
  결정을 영구히 기록)을 한다. GitHub Spec Kit의 `plan.md`/`spec.md`도 실은 이 문제를
  푸는 도구다("whole team can review", CI가 나중에 검사할 수 있는 고정된 경로).
  Agent Teams 문서가 (A)를 커밋하지 않는다고 말한 것은 (B)에 대해 아무것도 말하지
  않는다 — 서로 다른 요구를 가진 다른 아티팩트이기 때문이다.

정리하면: **"팀처럼 실시간 협업하기 위해" 커밋하는 게 아니라 — 그건 이미 이 환경의
Agent/SendMessage가 호스트 로컬로 더 잘 처리하고 있다 — "팀(미래 동료든, 몇 달 뒤의
자기 자신이든)이 나중에 이 결정을 추적할 수 있도록" 커밋하는 것이다.** 판단 근거는:

- 커밋된 파일은 `git log`/`git blame`/`grep`으로 검색·추적된다. PR 본문은 GitHub UI
  밖에서는 검색이 안 되고, "이 함수는 왜 이렇게 됐지"를 알고 싶을 때 `docs/`를
  훑어보는 이 레포의 기존 습관(README "## 문서" 색인, `check:docs` 스크립트로
  문서-코드 참조를 CI에서 검증)과도 맞지 않는다. `docs/DECISIONS.md`가 이미 증명한
  패턴을 계획에도 그대로 연장하는 것뿐이다.
- 나중에 정말 CI가 "diff가 계획과 일치하는가"를 자동 검사하게 만들고 싶어져도, 계획이
  레포의 알려진 경로에 파일로 있어야 그 위에 무엇이든 지을 수 있다. 지금 당장 CI
  conformance 검사까지 만들진 않지만(아래에서 명시적으로 보류), 그 문을 열어두는 것과
  닫아두는 것의 차이는 크다.

**Spec Kit 풀 세리머니는 채택하지 않는 이유 — Scott Logic의 실측이 정확히 여기서
멈추라고 말한다**

- Scott Logic의 실전 투입 결과(위 인용)가 이 판단의 축이다: 세리머니가 값을 하는 지점은
  "중요한 기능·brownfield 변경·여러 명이 참여하는 팀·규제 업무"뿐이고, 그 밖(1회성
  프로토타입·사소한 수정)에는 과하다 — 실측으로 마크다운 2,000줄, 체감 10배 느림.
  이 경계선은 이미 이 레포 CLAUDE.md 맨 위 트레이드오프 선언과 정확히 같은 모양이다:
  _"이 지침은 속도보다 신중함을 우선한다. 사소한 작업에는 판단력을 발휘한다."_
  즉 "계획을 세울 만큼 중요한 작업"과 "세리머니를 감수할 만큼 중요한 작업"의 경계는
  이미 하나의 필터로 충분하다 — **plan mode를 실제로 거쳤는가**. Anthropic 자신도
  "한 문장으로 diff를 설명할 수 있으면 계획을 건너뛰라"고 명시한다. 그러니 plan mode를
  거친 작업만 커밋 대상으로 삼으면, 새로운 판단 기준을 또 만들 필요 없이 기존 필터가
  세리머니 대상을 이미 걸러준다.
- `constitution.md`(프로젝트 원칙, 1회성)는 이 레포에서 이미 `.claude/CLAUDE.md`가
  하고 있는 역할과 그대로 겹친다 — 게다가 이 레포의 CLAUDE.md는 이미 활발히
  유지·정리되는 실제 사용 문서다(§1~11, 레포 전용 가이드까지). 없는 문제를 다시 푸는
  꼴이라 채택하지 않는다.
- `spec.md`/`plan.md`/`tasks.md` 3파일 분리도 이 레포에는 과하다 — plan mode가 이미
  Context/설계/실행 단계/검증을 한 파일에 담아 내는데, 이걸 3개로 쪼개는 건 이
  레포·팀 규모에서 얻는 이득보다 유지 비용이 크다(Scott Logic이 실측한 "volume이지
  fidelity가 아니다"가 정확히 이 지점).
- diff를 spec과 자동 대조하는 CI conformance 검사는 **지금은 만들지 않는다** — fresh
  subagent 리뷰(Anthropic·Tyler Burleigh 둘 다 실제로 쓰는 패턴)로 충분히 같은 목적을
  달성하고, 파싱 가능한 conformance 검사를 안정적으로 만드는 건 그 자체로 새로운
  엔지니어링 프로젝트다. 계획을 레포에 파일로 커밋해두면 이 기능은 **나중에 추가만
  하면 되는 옵션**으로 남는다 — 지금 안 만든다고 이 경로를 막는 게 아니다.

**최종 설계**: 계획 파일은 `docs/plans/<YYYY-MM-DD>-<slug>.md`에 커밋한다(plan mode를
실제로 거친 작업만 — 사소한 즉시 구현은 대상 아님). 구현이 끝나 PR을 열 때 **구현
코드와 같은 PR에** 포함해 커밋한다(계획만 먼저 커밋되고 구현이 안 따라오는 상태가
생기지 않도록). 한 번 커밋된 뒤에는 **고치지 않는다** — "무엇을 의도했는지"의 스냅샷으로
그대로 둔다(append-only, `docs/DECISIONS.md`와 같은 성격). "무엇이 실제로 됐는지"는
별도로 PR 본문의 `## 계획 대비 구현` 섹션이 이 파일을 **링크**해서 대조한다 — 계획
원문을 PR 본문에 다시 붙여넣지 않는다(그러면 같은 내용이 커밋된 파일과 PR 본문
두 곳에 중복된다 — 이 레포가 반복해서 경계하는 SSOT 위반).

### "원문이 안 바뀐다"는 건 문장으로 약속하는 게 아니라 CI로 강제한다

여기서 놓치기 쉬운 지점: "커밋한 뒤엔 고치지 않는다"를 CLAUDE.md 문장으로만 적어두면
그건 어차피 advisory다(Anthropic 공식 문서도 "CLAUDE.md instructions are advisory,
hooks are deterministic" 라고 스스로 구분한다) — 이번 세션이 CI green만 보고 배포해온
바로 그 실패 패턴을 "계획도 안 바뀌었을 거라 믿고" 반복하는 꼴이 된다. 다행히 소프트웨어
업계에 정확히 같은 문제("한 번 확정된 기록은 손대지 않는다")를 풀어온 두 개의 확립된
선례가 있고, 둘 다 **문장이 아니라 체크로** 강제한다:

- **ADR(Architecture Decision Record)의 Nygard 컨벤션** — "Immutable means: no content
  changes beyond typos or broken links. Anything that changes meaning goes in a new
  ADR." 과거 결정을 재검토하게 되면 옛 ADR을 고치지 않고 새 ADR을 쓰며 "Superseded by
  ADR-NNN"이라고만 표시한다. 그리고 이건 말로 끝나지 않는다: **"A pre-merge check that
  disallows changes to the body of Status: Accepted files... is enough."** — 즉 PR이
  기존 ADR 파일의 본문을 건드리면 CI가 막는다. ([hidekazu-konishi.com](https://hidekazu-konishi.com/entry/architecture_decision_records_templates_and_operations.html))
- **DB 마이그레이션 파일의 불변성 컨벤션** — "Applied migrations must never change...
  every environment that already ran it now disagrees with your repo (your migration
  tool's checksum validation will make this loudly clear)." Flyway 같은 실제 도구는
  체크섬으로 이걸 자동 검증하고, "In CI pipelines, this runs automatically on every
  pull request that includes a migration file." ([diffy-pick.com](https://diffy-pick.com/blog/migration-files-and-git-do-not-mix/), [khimananda.com](https://khimananda.com/blog/database-migrations-in-ci-cd-pipelines))
- **참고로 GitHub Spec Kit 자신의 답은 더 약하다** — "flag something as done... tells
  the agent to hands off that section. However, the protection isn't perfect, as a
  full re-plan can sometimes nudge or overwrite done areas, so it's still smart to
  read through the new output before merging." Spec Kit조차 완벽한 강제는 안 하고
  "사람이 머지 전에 다시 읽어보라"는 수준이다 — 그러니 우리가 CI 체크 하나로 ADR·
  마이그레이션 수준의 강제를 갖추면 오히려 Spec Kit보다 더 확실한 보장이다.

**결론: `docs/plans/`도 같은 방식으로 CI에서 강제한다.** 두 레포의 기존 CI 워크플로우에
스텝을 하나 추가한다 — PR의 base 대비 diff에서 `docs/plans/` 아래 **기존 파일이 수정**
(추가가 아니라 수정, `git diff --name-status`의 `M`)됐으면 실패시킨다:

```yaml
- name: docs/plans 불변성 확인
  run: |
    changed=$(git diff --name-status "origin/${{ github.base_ref }}...HEAD" -- docs/plans/ \
      | awk '$1 == "M" { print $2 }')
    if [ -n "$changed" ]; then
      echo "docs/plans/ 파일은 커밋된 뒤 수정하지 않습니다(append-only, ADR과 같은 규칙)."
      echo "이탈은 새 파일이 아니라 PR 본문의 '## 계획 대비 구현' 섹션에 적으세요."
      echo "$changed"
      exit 1
    fi
```

오타 수정처럼 의미가 안 바뀌는 극히 드문 예외는 **별도 우회 플래그를 만들지 않는다** —
ADR 컨벤션도 그런 예외를 인정하긴 하지만, 이 정도로 드문 케이스를 위해 우회 메커니즘을
새로 설계·유지하는 비용이 "가끔 관리자 권한으로 red CI를 무시하고 머지"하는 것보다
크다(Scott Logic이 경고한 "필요 이상의 세리머니"를 이번엔 CI 체크 자체에 들이지 않는
것). 이건 이 프로세스 전체에서 **유일하게 advisory가 아니라 deterministic한 게이트**다
— 나머지(fresh subagent 대조, PR 섹션 작성)는 여전히 CLAUDE.md 규칙에 기대는 advisory
단계라는 걸 명확히 인지하고 넘어간다.

## 수립할 프로세스

### 1. `docs/plans/` 도입 — 두 레포 문서 분류 체계에 새 카테고리 추가

**FE `.claude/CLAUDE.md`**의 "docs/ 내부 분류"(다섯 종류: 독립 기능 문서/절차/레퍼런스/
설계 결정 기록/보관)에 여섯 번째 종류를 추가한다:

```markdown
- **작업 계획**(`docs/plans/<YYYY-MM-DD>-<slug>.md`) — plan mode로 세운 계획의
  스냅샷. 구현 코드와 같은 PR에서 커밋하고, 커밋된 뒤에는 고치지 않는다(append-only,
  `DECISIONS.md`와 같은 성격 — "무엇을 의도했는지"의 기록. CI가 기존 파일 수정을
  막는다 — 아래 "docs/plans 불변성 확인" 참고). "무엇이 실제로 됐는지"는 이 파일이
  아니라 PR 본문의 `## 계획 대비 구현` 섹션이 이 파일을 링크해서 대조한다.
```

**BE `.claude/CLAUDE.md`**의 "문서 파일 위치"(넷 중 하나: 서사형/절차/레퍼런스/보관)에도
동일한 다섯 번째 종류로 추가한다(BE는 아직 "설계 결정 기록" 카테고리 자체가 없으므로,
이 프로세스가 BE에 처음 생기는 append-only 기록 카테고리가 된다 — FE의 DECISIONS.md
선례를 그대로 참고했다는 점만 문장에 남긴다).

### 2. CI에 `docs/plans/` 불변성 체크 추가 (이 프로세스의 유일한 deterministic 게이트)

FE `.github/workflows/ci.yml`, BE의 기존 `CI` 워크플로우 각각에 위에서 설계한
"docs/plans 불변성 확인" 스텝을 추가한다. 기존 job(FE는 `check` job의 다른 스텝들과
나란히, BE는 ktlint·test를 도는 `check` job과 나란히) 안에 한 스텝으로 넣어 별도
워크플로우 파일을 새로 만들지 않는다 — 이미 두 레포 다 PR마다 도는 CI가 있으므로
거기 얹는 게 최소 변경이다.

### 3. CLAUDE.md에 새 원칙 추가 (핵심 메커니즘)

두 레포 `.claude/CLAUDE.md`의 카파시(Karpathy) 스타일 번호 목록(FE는 §1~10, BE는 §1~7)에 새
섹션을 추가한다 — FE는 이미 "§8~10은 여기서 직접 추가했다"는 선례가 있어 로컬 확장이
자연스럽다. FE는 §11로, BE는 §8로 추가한다(각 파일의 "---" + 마무리 문구 앞).

**FE `.claude/CLAUDE.md`**, §10 뒤 · "---" 앞에 삽입:

```markdown
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

기준: PR을 읽는 사람이 코드를 한 줄도 안 읽고 이 섹션만 봐도 계획과 실제가 일치하는지
판단할 수 있는가?
```

**BE `.claude/CLAUDE.md`**도 동일한 내용을 `## 8. ...`로, §7 뒤 · "---" 앞에 삽입.
(두 파일이 같은 외부 출처를 확장한 미러 구조이므로 번호만 다르게, 본문은 동일하게
유지 — 이후 한쪽만 갱신되는 drift를 막기 위해서다.)

### 4. PR 템플릿에 자리 만들기 (수동 PR에도 적용되는 안전망)

두 레포 모두 `.github/pull_request_template.md`가 없다(확인 완료) — 새로 만든다.
기존 PR들이 실제로 쓰던 형태(`## Summary` / `## Test plan` / `## Notes`)에 새 섹션을
추가한 것을 템플릿으로 고정한다:

```markdown
## Summary

-

## 계획 대비 구현

<!-- plan mode를 거친 작업이면: docs/plans/<파일>.md를 구현 코드와 같은 PR로 커밋하고,
     fresh subagent(Explore)로 diff를 그 계획과 대조한 결과를 계획 항목별로
     구현됨/이탈(과잉 구현 포함)/미구현 + 근거(파일:줄)로 적는다. 원문은 붙여넣지 않고
     docs/plans/의 파일을 링크한다. plan mode 없이 구현한 사소한 수정이면 이 섹션은
     생략한다. -->

## Test plan

- [ ]

## Notes
```

이렇게 하면 Claude가 실행하는 워크플로우뿐 아니라, 사용자가 직접 만드는 PR도 GitHub이
기본으로 이 섹션을 보여줘 습관을 물리적으로 강제한다.

### 5. 메모리에 이 작업 방식을 기록

세션 메모리(`feedback` 타입)에 이번 결정을 남긴다 — "plan mode 작업은 PR 전에 fresh
subagent로 계획 대비 구현을 대조하고 PR 본문에 남긴다. 이유: CI green만 보고 배포 전
검증 없이 진행해온 gap을 메우기 위함(2026-09-08)." CLAUDE.md 커밋이 primary
mechanism이고 메모리는 보조 — 같은 프로젝트 디렉터리에서 시작한 세션이 CLAUDE.md를
놓쳤을 때의 이중 안전장치.

## 실행 시점 메커니즘 (다음 plan-mode 작업부터 실제로 어떻게 도는지)

1. Plan mode 승인 → 구현 → 테스트/lint 통과 (기존과 동일)
2. 승인된 계획을 `docs/plans/<YYYY-MM-DD>-<slug>.md`로 워크트리에 복사해 구현 코드와
   **같은 커밋 또는 같은 PR**에 포함한다(계획만 먼저 커밋되고 구현이 따로 노는 상태를
   막는다).
3. `gh pr create` 하기 **직전**, `Agent` 도구로 `Explore` 타입 fresh subagent를
   `run_in_background: false`로 호출한다. 프롬프트에 방금 커밋한 계획 파일 경로
   (`docs/plans/...`)와 "이 브랜치의 diff를 base 대비 확인하고, 계획의 각 실행 항목이
   실제로 어떻게 구현됐는지 대조해 보고하라(미구현·이탈·계획에 없던 과잉 구현 모두
   포함)"는 지시를 담는다.
4. subagent가 이탈/미구현을 발견하면: 실제 버그면 고치고 재확인, 의도된 트레이드오프
   변경이면 §7 규칙대로 사용자에게 먼저 알린다(조용히 넘어가지 않는다).
5. 확인이 끝나면 그 결과를 `## 계획 대비 구현` 표로 정리해 PR 본문에 포함하고,
   `docs/plans/`의 해당 파일을 링크한다.

## 이번 세션 결과물(FE #31, BE #7)에 소급 적용할지

이미 머지 전이므로, 새 규칙을 만든 김에 두 PR에도 소급 적용하는 것을 권장한다 —
각 워크트리에 계획 파일을 `docs/plans/2026-09-08-*.md`로 추가 커밋하고, fresh
subagent 대조 결과를 PR 본문에 `## 계획 대비 구현` 섹션으로 추가한다(계획 승인
직후 실제 구현했던 세션이 이미 있으니 지금 바로 가능). 다만 이건 사용자가 원할
때만 진행 — 이번 계획의 필수 항목은 아니다.

## 검증

- **CI 체크(유일한 deterministic 게이트)를 실제로 테스트한다**: 이미 커밋된
  `docs/plans/` 파일 하나를 일부러 수정하는 테스트 PR을 만들어, 새로 추가한 스텝이
  실제로 실패하는지(음성 확인) 확인한다. 통과해야 할 정상 PR(새 계획 파일만 추가)도
  하나 만들어 그건 안 걸리는지(위양성 없음) 함께 확인한다.
- FE·BE `.claude/CLAUDE.md`·문서 분류 절에 새 섹션이 추가된 뒤, 다음 plan-mode 작업
  완료 시 실제로 `docs/plans/`에 파일이 커밋되고 → fresh subagent 호출 → PR 본문에
  `## 계획 대비 구현` 섹션이 채워지는지로 확인한다.
- `.github/pull_request_template.md`는 `gh pr create` 시 `--body`를 명시하지 않으면
  GitHub이 자동으로 이 템플릿을 채워 넣는지 다음 수동 PR에서 확인.
- 메모리 파일은 `/memory` 또는 다음 세션에서 recall되는지로 확인.
