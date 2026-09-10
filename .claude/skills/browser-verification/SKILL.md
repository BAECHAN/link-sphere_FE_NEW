---
name: browser-verification
description: Link-Sphere FE에서 UI 동작이 바뀌는 변경을 커밋하기 전, Playwright MCP로 실제 브라우저 확인 화면을 녹화해 사용자에게 보여주는 절차. 컴포넌트·훅·라우팅·스타일 변경을 반영하기 전에 사용.
when_to_use: 커밋하기 전 UI 동작이 바뀐 것을 브라우저로 직접 확인해야 할 때, 사용자가 "확인해줘" "보여줘"라고 요청할 때.
---

2026-09-10, "코드를 반영하기 전에 브라우저 검증 화면을 보고 싶다"는 요청을 계기로 도입했다.
`docs/DECISIONS.md`의 여러 항목이 "Playwright로 실측했다"는 기록을 남기지만, 그 검증은
세션이 끝나면 사라지고 코드로도 영상으로도 남지 않았다 — 이 skill은 그 검증을 녹화본으로
남겨 사용자가 직접 보고 승인할 수 있게 한다.

이 절차는 e2e 자동화(`@playwright/test`)와 무관하다. 세션이 방금 만든 변경을 세션 스스로
확인하는 수동 검증이며, 회귀 테스트를 대체하지 않는다.

## 설정

레포 루트 `.mcp.json`이 `--caps=devtools --headless`로 Playwright MCP 서버를 띄운다.
이게 `browser_start_video`류 도구를 연다. `--headless`라서 별도 Chrome 창이 뜨지 않는다
— 대신 녹화가 끝난 뒤 파일을 열어서 보여준다("브라우저 창이 따로 뜨면 정신없다"는
피드백에 따른 선택, 2026-09-10).

## 언제 녹화하는가

- 컴포넌트·훅·라우팅·스타일 등 **UI 동작이 바뀌는 변경**을 커밋하기 전
- 사용자가 명시적으로 "확인해줘"라고 요청할 때

**녹화하지 않는 것**: 문서·타입·설정·백엔드 전용 변경처럼 브라우저 화면에 드러나지
않는 변경.

## 호출 순서

1. `pnpm dev`가 안 떠 있으면 먼저 기동 (`https://localhost:31119`, mkcert HTTPS)
2. `browser_video_show_actions` — 클릭·입력 지점에 오버레이 표시 켜기
3. `browser_start_video` — 파일명 `verify-<YYYY-MM-DD>-<slug>.webm`,
   `--output-dir`(`.claude/browser-artifacts/`) 기준 상대경로로 지정
4. 확인할 흐름을 실제로 조작. 단계가 바뀔 때마다 `browser_video_chapter`로 구간 표시
   (예: "1. 로그인", "2. 게시글 작성", "3. 결과 확인")
5. `browser_stop_video`

## 다 만든 뒤

- 결과 파일 경로를 `cursor <경로>`로 열어 IDE 탭에서 재생되게 한다
- 사용자가 보고 승인한 뒤에만 커밋으로 넘어간다 — 승인 없이 먼저 커밋하지 않는다
- 이상이 보이면 코드를 고치고 처음부터 다시 녹화한다. 실패 지점만 잘라 보여주지 않는다
  — 영상은 검증의 증거이지 검증 자체를 대체하지 않는다

## 파일 관리

- `.claude/browser-artifacts/`는 `.gitignore`에 있다 — 레포에 커밋하지 않는다
- PR 본문에 남길 가치가 있는 영상만 직접 첨부한다(GitHub은 `.webm`을 PR에 그대로
  임베드한다, 무료 플랜 기준 파일당 10MB 한도)

## 알려진 제약

Playwright는 VP8 코덱 webm으로만 녹화한다. 에디터에서 이 파일이 재생되지 않으면(빈
화면이거나 재생 버튼이 안 뜨면) 아래 중 하나를 사용자에게 확인받고 진행한다 — 임의로
정하지 않는다:

- `ffmpeg`(시스템 설치, Playwright 번들 ffmpeg는 VP8/webm 전용이라 변환 불가)로 mp4
  변환 후 다시 열기
- 영상 대신 `browser_start_tracing`/스크린샷으로 대체
