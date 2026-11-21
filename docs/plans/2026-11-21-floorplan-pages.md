# 코드 지도(floorplan) 공개와 Claude Code 안내 이전

<!-- plan-result:start — 이 블록만 병합 뒤에도 고칠 수 있다(.claude/CLAUDE.md "계획과 PR 본문"). 아래는 승인된 계획 원문 -->

## 구현 결과

> #671(Phase 1) · 2026-11-21 대조 · 이탈 2 · 미구현 0 — 이탈 1건은 보완함. 판정 근거(파일:줄)는 각 PR 본문 "계획 대비 구현"
> Phase 2: BE #226 · 2026-11-21 대조 · 이탈 0 · 미구현 0 · Phase 3: 2026-11-21 확인(PR 없음)

- 이탈(절차) → 보완함: 공개본 재검사를 대조 전에 커밋한 파일로 하지 않았다. PR 전에 다시 검사해 infra 파일 경로·로컬 경로·실제 이메일·`127.0.0.1` 0건을 확인했다
- 이탈(사용자 요청): Pages 첫 화면 카드 설명에 "손으로 다시 올려 최신 코드보다 늦을 수 있어요"를 더했다. 머리글이 "main 코드로 자동으로 만들어 올리는 문서"라 어긋나서다. BE 카드도 같은 문구를 쓴다
- 계획에 없던 변경: 문서 동기화 — `docs/PLANS-INDEX.md` 재생성(이 계획 행 추가, 늦게 반영된 2026-11-20 계획의 대조 칸 채움)
- 계획에 없던 변경(Phase 2): 문서 동기화 — BE `docs/DEPLOY.md`의 Pages 첫 화면 카드 목록 문장에 FE 코드 지도를 더했다
- Phase 3: 상위 폴더 `CLAUDE.local.md`는 사용자가 지웠고, floorplan 빌드를 다시 돌려도 생기지 않았다(`CLAUDE.LOCAL.MD not added`)

<!-- plan-result:end -->

> FE·BE 코드를 그린 지도(infra 제외)를 FE GitHub Pages `/floorplan/`에 올리고, FE README·Pages 첫 화면(FE·BE)에서
> 가리키며, 지도 조회 안내를 상위 폴더 `CLAUDE.local.md`에서 FE `.claude/CLAUDE.md`로 옮긴다.

## Context

- 이 세션에서 floorplan 플러그인으로 FE·BE·infra 코드 지도를 만들었다. 지도는 세 저장소의 상위 폴더
  `link-sphere/floorplan/`에 있고 git에 들어가지 않는다(스스로 `.gitignore`).
- 사용자 요청: ① 이 지도를 GitHub README에서 링크하거나 바로 보이게 ② Claude Code 안내를 `CLAUDE.local.md`가 아니라
  FE `CLAUDE.md`에 두고 git으로 관리.
- 확인한 사실
  - FE·BE 저장소는 공개, infra 저장소는 비공개(`gh repo view`). infra 이름은 FE 문서 5곳에 이미 공개돼 있다.
  - FE Pages는 `deploy-storybook.yml`이 `pages-site/`를 `_site/`로 복사해 올린다(78행). `pages-site/**` 변경이 트리거(25행).
  - `docs/DEPLOY.md:270-272`: 문서를 더하면 FE·BE 두 저장소의 `pages-site/index.html` 카드를 같이 고친다.
  - GitHub README는 스크립트를 돌리지 않아 움직이는 지도를 넣을 수 없다 → 스크린샷 + 링크가 최대치.
  - `lint-staged`·`format:check`(`prettier --check .`)가 HTML도 검사·재작성한다 → 생성된 3.6MB 지도 파일은
    `.prettierignore`에 넣어야 한다.
  - FE 폴더에서 연 세션도 상위 폴더 `CLAUDE.local.md`를 읽는다(`claude -p`로 확인, YES).
- 공개용 내보내기본은 이미 만들어 확인했다: infra 파일·설명 0건, 로컬 경로·이메일·`127.0.0.1` 0건. 남는 흔적은
  저장소 목록의 infra 이름과 커밋 SHA 하나다(내보낸 파일을 손으로 고치면 지도 데이터가 깨져 "No data"가 떴다).

```mermaid
flowchart LR
  A["로컬 지도 (infra 포함)"] -->|infra 뺀 설정으로 빌드·내보내기| B["pages-site/floorplan/index.html + preview.png"]
  B -->|FE PR 병합| C["Storybook Deploy → Pages /floorplan/"]
  C --> D["FE README 스크린샷·링크"]
  C --> E["FE·BE Pages 첫 화면 카드"]
```

## 판단이 필요했던 항목

| 항목 | 결정 | 근거·기각한 대안 |
| --- | --- | --- |
| 올릴 곳 | FE Pages 공개, infra 제외 | 사용자 결정. 기각: infra 포함 공개(비공개 저장소 내용 노출), claude.ai 비공개 페이지(README 링크를 남이 못 엶) |
| README 표시 | 스크린샷 + 링크, FE README만 | 사용자 결정. 기각: 링크 한 줄만 |
| Pages 첫 화면 카드 | FE·BE 둘 다 추가 | 사용자 결정, `docs/DEPLOY.md` 규칙. 기각: 카드 없이 README만 |
| 지도 안내 위치 | FE `.claude/CLAUDE.md`로 옮기고 상위 `CLAUDE.local.md` 삭제 | 사용자 결정. 감수하는 것: BE·infra 세션은 안내를 잃고, floorplan 빌드의 자동 갱신이 끊긴다. 기각: 지금처럼 `CLAUDE.local.md` 유지(추천했으나 사용자가 옮기기 선택) |
| 안내 속 경로 | `git rev-parse --path-format=absolute --git-common-dir` 기준 `../../floorplan` | 메인 체크아웃·워크트리 둘 다 같은 곳을 가리킨다(직접 실행해 확인). 기각: `/Users/...` 절대경로(공개 저장소에 로컬 경로 노출), `../floorplan`(워크트리에서 틀림) |
| 안내가 없는 환경 | "파일이 없으면 이 절을 건너뛴다"를 명시 | 클라우드 세션·다른 기계에는 지도가 없다 |
| infra 흔적(이름·SHA) | 그대로 둔다 | 이름은 이미 공개 문서에 있고 SHA로는 내용을 볼 수 없다. 기각: 내보낸 파일 손질(데이터가 깨짐) |
| 이미지 위치 | `pages-site/floorplan/preview.png` | 지도와 한 폴더라 함께 갱신되고 Pages에서도 열린다. `docs/`에 이미지 선례 없음 |
| CHANGELOG | 넣지 않는다 | 앱 동작이 아니라 문서 사이트 변경(`changelog-release` skill: feat/fix/perf·동작이 바뀌는 refactor 대상) |
| 지도 갱신 | 수동(이 기계에서 다시 내보내 PR). 지도 상단에 "Exported <날짜>"가 보인다 | 지도 설명은 사람이 쓴 파일이라 CI가 만들 수 없다 |

## 세부 계획

### Phase 1 — FE PR (워크트리 `floorplan-pages`)

| 위치 | 변경 내용 |
| --- | --- |
| `pages-site/floorplan/index.html` | 공개용 내보내기본(infra 제외) |
| `pages-site/floorplan/preview.png` | 지도 첫 화면 스크린샷(1440×860, 2배, 안내 투어 닫음) |
| `.prettierignore` | `pages-site/floorplan/` 한 줄과 이유 주석 |
| `README.md` | "# API 문서" 뒤에 "# 코드 지도" 절: 스크린샷 이미지를 누르면 Pages 지도로 가는 링크 + 무엇인지·infra 제외·수동 갱신이라 늦을 수 있음 한두 줄(합니다체) |
| `pages-site/index.html` | 카드 추가: 이름 "코드 지도", 배지 "이 저장소", 설명 "화면·서버의 모듈·파일·API가 무엇이고 서로 어떻게 이어지는지 쉬운 말로 보여 주는 지도예요. AWS 설정 저장소는 빠져 있어요.", 쓰임 "코드가 어디 있고 무엇이 무엇을 쓰는지 알고 싶을 때", 경로 `/floorplan/` |
| `docs/DEPLOY.md` "Storybook 공개 배포" | 하위 경로에 `floorplan/`이 더해졌다는 것, 생성물이라 Prettier에서 뺀 이유, 갱신 방법(이 기계에서 infra 뺀 설정으로 다시 내보내 PR) |
| `.claude/CLAUDE.md` | "## 코드 지도 (floorplan)" 절: 이 기계에만 있고 없으면 건너뜀, 위 경로 식으로 `query.mjs find/show/path/overview`, 고치기 전 코드로 확인, 갱신은 floorplan skill |
| `docs/plans/2026-11-21-floorplan-pages.md` | 이 계획 원문 |

### Phase 2 — BE PR (FE 배포 확인 뒤)

| 위치 | 변경 내용 |
| --- | --- |
| `pages-site/index.html` | 카드 추가: 같은 문구, 배지 "FE 저장소", 링크 `https://baechan.github.io/link-sphere_FE_NEW/floorplan/` |

### Phase 3 — 로컬 정리

| 위치 | 변경 내용 |
| --- | --- |
| `link-sphere/CLAUDE.local.md` | 삭제. `rm`이 이 환경에서 막혀 있어 사용자가 실행할 명령을 준다. 그 뒤 floorplan 빌드가 다시 만들지 않는지 확인 |

## 영향 범위

- 앱 코드·빌드 산출물(`dist`)에는 변화가 없다. `deploy.yml`(앱 배포)은 경로 필터상 돌지 않고 `Storybook Deploy`만 돈다.
- Pages는 배포 때 사이트 전체를 바꾸므로, 같은 워크플로가 Storybook과 지도를 함께 올린다(워크플로 수정 없음).
- FE `CLAUDE.md`는 모든 FE 세션이 읽는다 → 지도가 있는 이 기계에서는 조회 습관이 바뀌고, 없는 곳에서는 건너뛴다.
- BE·infra 세션은 지도 안내를 더 이상 받지 않는다(사용자가 감수하기로 함).

## 검증 방법

1. 워크트리에서 `pnpm check`(type-check·lint·format:check·check:deps), `pnpm check:docs` 통과
2. 공개본 재검사: `grep`으로 infra 파일 경로·`/Users/`·이메일·`127.0.0.1` 0건
3. 새 CLAUDE.md 명령을 워크트리 안에서 실행해 결과가 나오는지 확인
4. plan-verifier 대조 → PR(본문 `## 계획 대비 구현`, `pnpm check:pr-body`) → CI 통과 확인
5. 병합(사용자 승인 후) → `Storybook Deploy` 실행이 그 SHA에서 success인지 확인
6. `curl`로 `…/link-sphere_FE_NEW/floorplan/`·`preview.png` 200, Playwright로 실제 주소 화면 캡처해 지도가 뜨는지
   확인, GitHub README에 이미지가 보이는지 확인
7. BE PR → CI → 병합(승인 후) → BE Pages 배포 success, 첫 화면 카드 링크가 열리는지 확인
8. `CLAUDE.local.md` 삭제 뒤 `build.mjs` 실행 → 파일이 다시 생기지 않음(`ls`)

완료 조건: 위 6·7의 실제 주소가 열리고, README에 스크린샷이 보이고, FE 세션에 안내가 남아 있다.
바꾸면 안 되는 것: 앱 코드, 배포 워크플로, 로컬 지도(infra 포함) 설정.

## 남은 것

- 지도는 자동 갱신되지 않는다. 다시 올리는 건 이 기계에서 요청할 때마다 한다(DEPLOY.md에 순서).
