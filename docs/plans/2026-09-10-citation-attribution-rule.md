# 외부 인용을 "우리가 직접 겪은 것"처럼 쓰지 않기

## Context

**문제 제기**: "외부 문서에서 가져온 내용을 너와 내가 직접 경험한 것처럼 작성되는 걸 막으려는
것뿐이다." — CI 강제는 필요 없다. 링크를 다는 것과 "이건 남의 말"이라고 밝히는 것은 별개
문제이고, 지금 레포는 뒤의 것이 거의 없다.

**조사로 확인한 실태** (레포 문서 전수 조사):

- 외부 인용 총 **약 90건**. 링크가 붙은 것 49건, 무링크 약 40건.
- 큰따옴표로 감싼 **직접 인용문인데 무링크 8건**
- **구체 수치인데 무링크 9건**
- 외부 인용을 `>` blockquote로 시각 분리한 사례는 **레포 전체에 단 1건** (`.claude/CLAUDE.md:7-8`)
- 각주(`[^1]`) 형식은 **0건**

**핵심 패턴 — 출처가 사라지는 경로**:

> `docs/DECISIONS.md`에서 링크와 함께 태어난 인용이 `CHANGELOG.md`·기능 문서·`SKILL.md`로
> 재인용될 때 링크만 탈락하면서, "우리가 조사해서 아는 사실"처럼 굳어진다.

| 인용                                | 링크 있음                                    | 링크 없음                                    |
| ----------------------------------- | -------------------------------------------- | -------------------------------------------- |
| Baymard #346 (33%/42%)              | `docs/DECISIONS.md:534`, `docs/SEARCH.md:67` | `docs/SEARCH.md:74`                          |
| Material 3 Chips 가이드             | `docs/DECISIONS.md:1039`                     | `CHANGELOG.md:180`                           |
| Google Clear 버튼 관행              | `docs/DECISIONS.md:549`                      | `docs/SEARCH.md:167`, `CHANGELOG.md:27`      |
| Sears & Shneiderman split menu 논문 | **레포 전체에 없음**                         | `docs/BOOKMARK.md:149`, `CHANGELOG.md:584`   |
| WCAG 2.5.8 24px/44px                | **레포 전체에 없음**                         | `docs/DECISIONS.md:1011`, `CHANGELOG.md:217` |

**왜 지금 필요한가**: `.claude/CLAUDE.md:172-195`의 §10("외부에서 인용한 수치·주장은 원본을
남긴다")은 **링크를 남기라는 절반만** 다룬다. "이건 남의 말"이라고 밝히는 나머지 절반이
없어서, 링크가 없는 인용은 그대로 우리 주장으로 읽힌다.

**의도한 결과**: 문서를 읽는 사람이 어느 문장이 외부에서 온 것이고 어느 문장이 우리 판단인지
**본문만 보고 구분할 수 있게** 만든다. 기계 검사는 두지 않는다 — 규칙을 세우고, 지금 있는
위반을 실제로 고치는 것으로 끝낸다.

## 사용자가 확정한 것

| 항목      | 내용                                                                    |
| --------- | ----------------------------------------------------------------------- |
| 목표      | 외부 인용을 "우리가 직접 겪은 것"처럼 쓰지 않기 — 링크 + 귀속 표시      |
| 표기 형식 | 길이 기준 하이브리드 — 한 문장 이하는 인라인, 두 문장 이상은 blockquote |
| 강제 수단 | **없음.** `scripts/check-docs.js` 확장은 하지 않는다 (CI 게이트 불필요) |
| 적용 범위 | FE 레포 (BE는 후속)                                                     |

> 처음 이 작업을 "check-docs.js 확장으로 기계적으로 강제"하는 쪽으로 설계했었다. Plan
> 에이전트가 실제로 짠 설계는 새 함수 8개·정규식 10여 개·이 레포에 선례 없는 "파일별 경고
> 상한 래칫" 개념까지 필요했고, 그렇게 만들어도 검사 정밀도가 67~89%(오탐 11~33%)였다.
> 사용자가 이 복잡도를 보고 "CI까진 필요 없다"고 정정했다 — 원한 건 표기 규칙과 기존 위반
> 정리뿐이었다. `.claude/CLAUDE.md` §2("과하게 복잡하면 단순화한다")에도 맞는 결정이다.

## 근거로 삼은 외부 선례

| 선례                                                                                       | 무엇을 가져왔나                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Wikipedia:Plagiarism](https://en.wikipedia.org/wiki/Wikipedia:Plagiarism)                 | 인라인 각주(inline citation)와 문장 내 출처 표시(in-text attribution)를 **별개로** 요구. _"Naming the author in the text allows the reader to see that it relies heavily on someone else's ideas, without having to search in the footnote."_ |
| [Wikipedia:Close paraphrasing](https://en.wikipedia.org/wiki/Wikipedia:Close_paraphrasing) | 원문을 그대로 옮기지 않고 살짝 바꿔 쓴 것도 같은 취급                                                                                                                                                                                         |
| [agent-style RULE-H](https://github.com/yzhao062/agent-style/blob/main/RULES.md)           | _"Uncited claims are a trust failure; fabricated citations are worse."_ / handwavy attribution 금지 / 검증 실패 시 `[UNVERIFIED]` 마커 / 모든 규칙에 BAD·GOOD 예시 동봉                                                                       |
| Chicago Manual of Style                                                                    | 5줄 이상이면 block quotation — 길이 기준 하이브리드의 근거                                                                                                                                                                                    |
| APA·Chicago "as cited in"                                                                  | 원문을 직접 읽지 않았으면 재인용임을 밝힌다                                                                                                                                                                                                   |
| [Anthropic Citations API](https://platform.claude.com/docs/en/build-with-claude/citations) | 인용문을 생성하지 않고 원문에서 **추출**해 위조를 구조적으로 차단                                                                                                                                                                             |

찾아봤지만 **없었던 것**(정직하게 기록): [Google 개발자 문서 스타일 가이드](https://developers.google.com/style/quotation-marks)와
[Microsoft 스타일 가이드](https://learn.microsoft.com/en-us/style-guide/punctuation/quotation-marks)는
따옴표의 조판 규칙만 다루고 출처 표시 규칙은 다루지 않는다.

## 조사 중 검증한 8건 — 문제는 "거짓말"이 아니라 "검증 불가능"

무링크 인용 8건의 원본을 실제로 찾아 대조했다:

| 결과                              | 건수 | 해당 인용                                                                                           |
| --------------------------------- | ---- | --------------------------------------------------------------------------------------------------- |
| 내용이 **정확**했고 링크만 없었다 | 6건  | TanStack SSR 싱글턴, NN/g 11~15%, WCAG 24px, Sears & Shneiderman, 토스 UX 라이팅, Claude Code 200줄 |
| 뉘앙스가 **강화**됐다             | 1건  | "권장" → "상한"(`.claude/skills/*/SKILL.md:8`)                                                      |
| 서술이 **부정확**했다             | 1건  | MS Office 개인화 메뉴 폐기 시점(`CHANGELOG.md:585`)                                                 |

추가로 **네 번째 유형**이 드러났다 — `.claude/CLAUDE.md:783`의
`업계 ADR 컨벤션 기준으로 "한 엔지니어가 짧은 기간 안에 발견·수정한 것"은 애초에 대상이 아니다`.
실제 ADR 관행([Nygard 2011](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions),
[adr.github.io](https://adr.github.io/))의 기준은 "되돌리기 어렵다 / 트레이드오프가 크다 / 같은
질문이 두 번 이상 논쟁됐다"이고, **큰따옴표 안의 저 문구는 어느 ADR 컨벤션에도 없다** — 우리가
만든 기준에 외부 권위를 씌운 형태다.

기존 인용을 고칠 때 네 갈래로 분류한다:

| 유형                           | 처리                                                                       |
| ------------------------------ | -------------------------------------------------------------------------- |
| ① 내용 정확 + 무링크           | 링크만 추가                                                                |
| ② 뉘앙스 강화                  | 문구를 원문 강도로 되돌리고 링크 추가                                      |
| ③ 서술 부정확                  | 문장을 고치고 링크 추가                                                    |
| ④ 외부에 없는 문구에 권위 부여 | 따옴표·"업계 ~ 기준으로"를 제거하고 우리 판단으로 쓰거나, 진짜 근거로 교체 |

## 실행 시 쓸 원본 (이미 찾아둔 것)

| 인용 위치                                    | 원본                                                                                                                                                                                                                                                                  |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/BOOKMARK.md:149`, `CHANGELOG.md:584`   | Sears & Shneiderman (1994), "Split menus: effectively using selection frequency to organize menus", ACM TOCHI 1(1), 27–51                                                                                                                                             |
| `docs/DECISIONS.md:1011`, `CHANGELOG.md:217` | [WCAG 2.2 SC 2.5.8 Target Size (Minimum), Level AA — 24×24 CSS px](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum). **주의**: 44px은 이 조항이 아니라 SC 2.5.5(Enhanced, AAA)이므로 실행 시 재확인                                                   |
| `.claude/skills/*/SKILL.md:8`                | [Claude Code memory 문서](https://code.claude.com/docs/en/memory) — "target under 200 lines per CLAUDE.md file"                                                                                                                                                       |
| `CHANGELOG.md:1140`                          | [앱인토스 개발자센터 UX 라이팅](https://developers-apps-in-toss.toss.im/design/ux-writing.html) — 해요체·능동형·긍정형 원문 확인                                                                                                                                      |
| `CHANGELOG.md:585`                           | [The End of Personalized Menus](https://learn.microsoft.com/en-us/archive/blogs/jensenh/the-end-of-personalized-menus) (Microsoft 공식 블로그). **⚠️ 우리 서술이 부정확**: 기본값이 꺼진 건 Office 12(2007)이고 Office 2000은 도입 시점이다 — 문장을 함께 고쳐야 한다 |
| `docs/DECISIONS.md:210`                      | [TanStack Query SSR 가이드](https://tanstack.com/query/latest/docs/framework/react/guides/ssr) — 모듈 스코프 싱글턴이 "can share data between users"                                                                                                                  |
| `docs/DECISIONS.md:221`                      | tRPC 공식 문서 — client-only SPA는 모듈 스코프 싱글턴 허용 (실행 시 정확한 페이지 재확인)                                                                                                                                                                             |
| `docs/DECISIONS.md:1281`                     | [NN/g Progress Indicators](https://www.nngroup.com/articles/progress-indicators/) — "Waits with feedback feel 11–15% faster"                                                                                                                                          |
| `docs/CI-CHECK-GATE.md:92`                   | [ESLint Ignore Files 공식 문서](https://eslint.org/docs/latest/use/configure/ignore)                                                                                                                                                                                  |

## 판정 흐름

```mermaid
flowchart TD
    A[문서에 문장을 쓴다] --> B{내용이 외부에서 왔나?}
    B -->|아니오| C[그냥 쓴다 — 우리 주장]
    B -->|예| D{원문을 직접 확인했나?}
    D -->|아니오| E["[출처 미상] 이라고 밝히거나<br/>주장을 뺀다"]
    D -->|예| F{남이 인용한 걸 옮긴 건가?}
    F -->|예| G["재인용임을 밝힌다<br/>(A가 인용한 B에 따르면)"]
    F -->|아니오| H{길이가 두 문장 이상인가?}
    H -->|아니오| I["인라인: _\"원문\"_ + 링크<br/>+ 누구 말인지 문장 안에"]
    H -->|예| J["blockquote + — 출처명, URL"]
    G --> K{번역·생략했나?}
    I --> K
    J --> K
    K -->|예| L[그 사실도 함께 표시]
    K -->|아니오| M[완료]
    L --> M
```

## 구현 단계

### 1. `.claude/CLAUDE.md` §10을 확장한다 (새 섹션·검사 도구 없음)

§10의 현재 제목은 "외부에서 인용한 수치·주장은 원본을 남긴다"(`:172`)로 **검증 가능성**만
다룬다. 여기에 **귀속 표시**(이건 남의 말이다)를 사람이 지킬 규칙으로 더한다. 기계 검사는
언급하지 않는다.

`:191`("기준:" 문장 앞)에 다음을 추가:

- **길이 기준 표기**: 한 문장 이하는 인라인 `_"원문"_`(이탤릭) + 링크 + 누구의 말인지 문장
  안에서 밝힌다. 두 문장 이상은 blockquote로 떼어내고 `— 출처명, URL` 줄을 붙인다.
- **링크만으로 끝내지 않기**: 링크를 달아도 문장을 우리 주장처럼 쓰면 그대로 남의 생각에
  기댄 게 안 보인다(Wikipedia:Plagiarism의 in-text attribution 요건).
- **번역·생략 표시**: 한글로 옮겼거나 줄였으면 그 사실을 적는다.
- **재인용 표시**: 원문을 직접 안 읽었으면 "A가 인용한 B" 형태로 밝힌다.
- **권위 부여 금지**: 외부에 없는 문구를 `"..."` + "업계 ~ 기준으로"로 포장하지 않는다
  (유형 ④, `.claude/CLAUDE.md:783`이 실제 사례).
- **BAD/GOOD 예시 한 쌍**을 코드 펜스로 추가.

기존 CLAUDE.md 스타일(굵은 한 줄 요약 → 배경 서사 → bullet → "기준:")을 따른다.

### 2. `.claude/CLAUDE.md:7-8`의 낡은 인용 경계 표기를 고친다

"§8~10은 여기서 직접 추가했다" → 실제 §13까지 반영. 이 규칙을 만드는 김에 **자기 자신이
위반하고 있는 것부터** 고친다.

### 3. 기존 위반을 네 갈래 분류에 따라 고친다

**§10 도입(2026-09-08) 이후에도 재발했다는 것이 드러난 무출처 인용**부터 고친다:

- 큰따옴표 직접 인용 무링크 8건: `.claude/CLAUDE.md:766`, `:783`, `docs/DECISIONS.md:210`,
  `:212`, `:221`, `:1276`, `:1295`, `:1457-1463`
- 구체 수치 무링크: `docs/DECISIONS.md:1281`, `:1331`, `:1011`, `CHANGELOG.md:175`, `:180`,
  `:585`, `:1183`, `docs/BOOKMARK.md:149`, `.claude/skills/{changelog-release,design-tokens,
texts-conventions}/SKILL.md:8`
- 링크가 DECISIONS.md에만 있고 재인용 시 탈락한 것: `docs/SEARCH.md:74`, `:167`,
  `CHANGELOG.md:27`, `:180`, `:584`, `:217`

각 건은 위 "네 갈래 분류"로 처리한다. 유형 ③(`CHANGELOG.md:585`)과 유형 ④
(`.claude/CLAUDE.md:783`)는 링크 추가만으로 끝나지 않으므로 문장도 고친다.

> `CHANGELOG.md`는 과거 릴리즈 이력이라 **사실 오류 정정에 한정**하고 문구 다듬기는 하지
> 않는다.

### 4. `docs/DECISIONS.md`에 결정 기록을 남긴다

맨 위에 prepend(현재 9줄 위치). 제목 초안:
`## 2026-09-10 — 외부 인용을 "우리가 직접 겪은 것"처럼 쓰지 않기 (CLAUDE.md §10 확장)`

담을 것: 조사 실태(90건 중 절반 무링크), 출처가 사라지는 경로(DECISIONS → CHANGELOG 재인용
시 링크 탈락), 검증 8건의 네 갈래 분류, 웹 선례, **채택하지 않은 대안**(check-docs.js 기계
검사 — 오탐 11~33%에 새 개념까지 필요해 복잡도 대비 이득이 적어 기각)과 그 이유.

### 5. 문서 갱신 확인

`.claude/CLAUDE.md`를 고쳤으므로 `pnpm check:docs` 실행(기존 검사가 여전히 통과하는지만
확인 — 이번 작업으로 그 스크립트를 건드리지 않는다).

## 검증

1. `.claude/CLAUDE.md` §10을 다시 읽어 BAD/GOOD 예시가 코드 펜스 안에 있는지, 기존 스타일과
   맞는지 확인한다.
2. 고친 8+9건을 하나씩 열어 링크가 살아있는지(404 아닌지), 귀속 표시가 문장 안에 있는지
   확인한다.
3. `pnpm check:docs` — 경로·줄 번호 참조가 여전히 유효한지(문장을 고치며 줄 번호가 밀렸을
   수 있음).
4. `pnpm check` (type-check + lint + format:check) — 문서만 바꿨지만 회귀 없는지 확인.

## 계획 대비 구현 (구현 후)

`.claude/CLAUDE.md` §11에 따라:

- 이 파일을 `docs/plans/2026-09-10-citation-attribution-rule.md`로 구현과 같은 PR에 커밋
- fresh subagent(Explore)에게 커밋된 계획과 실제 diff를 대조시켜, PR 본문에
  `## 계획 대비 구현` 섹션으로 항목별 "구현됨(파일:줄) / 이탈(이유) / 미구현"을 남긴다
