---
name: changelog-release
description: Link-Sphere FE `CHANGELOG.md` 작성 포맷(Keep a Changelog 기반)과 릴리즈 절차. feat/fix/perf 커밋 시 Unreleased 항목을 추가하거나 버전을 확정할 때 사용.
when_to_use: feat/fix/perf/동작이 바뀌는 refactor 커밋을 만들 때, CHANGELOG.md의 Unreleased 섹션에 항목을 추가할 때, 버전을 릴리즈할 때.
paths: CHANGELOG.md
---

2026-09-09, `.claude/CLAUDE.md`가 984줄로 길어져 [공식 권장 목표치(~200줄)](https://code.claude.com/docs/en/memory)를
크게 넘긴 것을
계기로 CLAUDE.md 본문에서 이 절을 옮겼다 — 매 세션 로드할 필요 없이 CHANGELOG 작성·릴리즈
시점에만 불러오면 된다.

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
  (`features/post/create/ui/PostCreateBookmarkFolderField.tsx`(신규),
  [PR #21](https://github.com/BAECHAN/link-sphere_FE_NEW/pull/21))

  </details>
```

- 요약 줄: `` `스코프` `` + 공백 + 한 줄(72자 이내, 줄바꿈·마침표 없음). 굵게(`**`) 쓰지 않는다.
  스코프는 `post` `comment` `auth` `user` `bookmark` `common` `shared` `infra` 중 하나
  (2026-09-10 정정: FSD 레이어가 아니라 CHANGELOG 독자가 체감하는 변경 영역 기준이다 —
  실측 결과 `post`~`common`은 단일 엔티티에 갇힌 변경, `shared`는 여러 도메인에 걸치거나
  특정 엔티티 소유가 아닌 cross-cutting 변경, `infra`는 배포·CI·빌드처럼 FSD 레이어
  밖의 관심사에 쓰이고 있었다).
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

- 버전 체계 기준점: `0.1.0`부터 시작(정식 릴리즈 전 개발 단계 = `0.x`). 현재 버전은
  `CHANGELOG.md` 최상단(가장 최근 `## [X.Y.Z]` 섹션 또는 하단 compare 링크)에서 확인한다 —
  이 값은 릴리즈마다 바뀌므로 여기 고정된 숫자로 적지 않는다
