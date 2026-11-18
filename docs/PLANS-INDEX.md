# 작업 계획 색인

> `pnpm docs:index`가 [`docs/plans/`](./plans/)에서 만든 파일이다. 직접 고치지 않는다.

계획 224개. "대조"는 계획 파일의 구현 결과 블록에서 읽은 PR 번호와 이탈·미구현 건수다.
블록 규칙(2026-11-03) 전의 계획은 비어 있다.

## 2026-11 (60)

| 날짜       | 계획                                                                                                                                                         | 대조                          | 대체         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- | ------------ |
| 2026-11-18 | [디자인 시스템 로드맵 문서 만들기](./plans/2026-11-18-design-system-roadmap.md)                                                                              | #647 · 이탈 2 · 미구현 0      |              |
| 2026-11-18 | [문서 찾기 구조와 계획·변경 이력 무게 줄이기](./plans/2026-11-18-doc-index-plan-weight.md)                                                                   | #639 · 이탈 1 · 미구현 1      |              |
| 2026-11-18 | [떠난 뒤 실패 토스트를 구조 이름의 안내 토스트(`showNoticeToast`)로 일반화](./plans/2026-11-18-notice-toast.md)                                              | #643 · 이탈 3 · 미구현 0      |              |
| 2026-11-18 | [Storybook 스토리 이름 린트: 공식 recommended 도입 + `name` 금지](./plans/2026-11-18-storybook-story-name-lint.md)                                           | #644 · 이탈 2 · 미구현 0      |              |
| 2026-11-18 | [토스트 종류별 색을 디자인 토큰에서 파생](./plans/2026-11-18-toast-design-tokens.md)                                                                         | #646 · 이탈 1 · 미구현 0      |              |
| 2026-11-18 | [토스트 버튼 배치를 래퍼가 정하게 — 여러 줄이면 아래 줄 오른쪽(stackedAction)](./plans/2026-11-18-toast-stacked-action.md)                                   |                               |              |
| 2026-11-17 | [북마크 내 검색: 입력을 다 지우면 엔터 없이 전체 목록 복원](./plans/2026-11-17-bookmark-search-restore-on-empty.md)                                          | #635 · 이탈 1 · 미구현 0      |              |
| 2026-11-17 | [검색 X 버튼: 누른 직후 친 글자가 사라지지 않게](./plans/2026-11-17-search-clear-typing-race.md)                                                             | #637 · 이탈 3 · 미구현 1      |              |
| 2026-11-17 | [모달이 떠 있을 때 토스트 버튼이 눌리지 않는 문제](./plans/2026-11-17-toast-over-modal.md)                                                                   | #636 · 이탈 2 · 미구현 1      |              |
| 2026-11-16 | [묻기와 가정의 경계 — §1을 세 갈래 목록으로 바꾸고 턴 끝 가정 줄을 훅으로 강제한다](./plans/2026-11-16-ask-or-assume.md)                                     |                               |              |
| 2026-11-16 | [CloudFront Function 배포를 FE 배포 워크플로로 자동화](./plans/2026-11-16-cloudfront-function-deploy.md)                                                     | #632 · 이탈 1 · 미구현 1      |              |
| 2026-11-16 | [개발 의존성 Dependabot 알림 28건 정리](./plans/2026-11-16-dev-dependency-alerts.md)                                                                         |                               |              |
| 2026-11-16 | [해시 자산 사전 brotli 압축 (원본 + `.br` 함께 올리고 CloudFront Function이 골라 주기)](./plans/2026-11-16-precompressed-brotli-assets.md)                   | #630 · 이탈 2 · 미구현 1      |              |
| 2026-11-16 | [6라운드: 공통 지침 연결과 FE·BE 지침·메모리 축소](./plans/2026-11-16-round6-connect.md)                                                                     |                               |              |
| 2026-11-15 | [zod 4 업그레이드와 의존성 무시 목록 정리](./plans/2026-11-15-zod-4-upgrade.md)                                                                              |                               |              |
| 2026-11-15 | [zod 4 classic → zod/mini 전환 (PR #624 후속)](./plans/2026-11-15-zod-mini-migration.md)                                                                     |                               |              |
| 2026-11-13 | [`moduleSideEffects`를 우리 `src`에만 적용되게 좁히기](./plans/2026-11-13-module-side-effects-src-only.md)                                                   |                               |              |
| 2026-11-13 | [완료 보고 항목 검사 — 턴 끝 판정 훅에 요청·결과·증거 목록 검사를 더한다](./plans/2026-11-13-report-items-check.md)                                          |                               |              |
| 2026-11-13 | [5라운드 2단계 — 규칙 위반 측정기를 claude-base로 옮기고 정책 기반으로 바꾼다](./plans/2026-11-13-round5-stage2.md)                                          |                               |              |
| 2026-11-12 | [침묵 감지 훅과 계획 대조의 대화 요약 입력](./plans/2026-11-12-silence-guard-session-digest.md)                                                              |                               |              |
| 2026-11-12 | [dev 서버 비밀 파일 노출과 운영 번들의 dayjs 한국어 로케일 누락 수정](./plans/2026-11-12-vite-env-deny-dayjs-locale.md)                                      |                               | 대체됨       |
| 2026-11-11 | [같은 사람의 조회는 24시간에 한 번만 센다](./plans/2026-11-11-post-view-dedupe.md)                                                                           | #596 · 이탈 1 · 미구현 0      |              |
| 2026-11-11 | [다른 탭 로그인을 받아들이는 사이 첫 로딩 중이던 조회가 오류 화면으로 남는 문제](./plans/2026-11-11-session-adopt-first-load-recovery.md)                    | #598 · 이탈 3 · 미구현 0      |              |
| 2026-11-10 | [뒤로가기로 닫히는 화면 요소를 한 방식으로 맞춘다 — 북마크 시트부터](./plans/2026-11-10-back-navigation-standard.md)                                         | #592 · 이탈 4 · 미구현 1      |              |
| 2026-11-07 | [배럴 파일 비용을 이 레포에서 직접 재고, 그 결과로 금지 규칙을 정하기](./plans/2026-11-07-barrel-measurement.md)                                             | #586 · 이탈 3 · 미구현 1      |              |
| 2026-11-07 | [orval 제거: 계약 테스트가 openapi.json을 직접 읽는다](./plans/2026-11-07-remove-orval.md)                                                                   | #584 · 이탈 0 · 미구현 0      |              |
| 2026-11-07 | [서비스 용어 사전 문서 만들기](./plans/2026-11-07-service-glossary.md)                                                                                       | #581 · 이탈 3 · 미구현 0      |              |
| 2026-11-07 | [모바일 메뉴에서 이동한 뒤 뒤로 오면 메뉴가 다시 열리는 문제](./plans/2026-11-07-sidebar-back-reopen.md)                                                     | #585 · 이탈 1 · 미구현 0      |              |
| 2026-11-06 | [접근성 후속 — 화면 읽기 프로그램이 듣는 버튼 이름과 모바일 메뉴를 바로잡기](./plans/2026-11-06-a11y-button-names.md)                                        |                               |              |
| 2026-11-06 | [접근성 후속 2 — 글 카드 댓글 링크, 이미지 이름, 화면의 영어 글자를 바로잡기](./plans/2026-11-06-a11y-card-link-korean-labels.md)                            |                               |              |
| 2026-11-06 | [AWS CDK 2단계 — AWS 설정 변경을 PR로 옮긴다](./plans/2026-11-06-aws-cdk-stage2.md)                                                                          | #577 · 이탈 7 · 미구현 2      |              |
| 2026-11-06 | [뮤테이션 테스트 자동 보강 루프: L2(draft PR까지)](./plans/2026-11-06-mutation-loop-l2.md)                                                                   | #567 #570 · 이탈 2 · 미구현 0 |              |
| 2026-11-06 | [뮤테이션 테스트 자동 보강 루프: L1(보고만)](./plans/2026-11-06-mutation-loop.md)                                                                            | #562 · 이탈 3 · 미구현 0      |              |
| 2026-11-06 | [UI 컴포넌트 이름을 업계 용어에 맞추기 — Badge·Chip 구분과 어긋난 이름 8묶음 개명](./plans/2026-11-06-ui-term-renames.md)                                    |                               |              |
| 2026-11-05 | [AWS CDK 도입 1단계 — 기존 AWS 설정을 코드로 기록하고 매일 차이를 감지한다](./plans/2026-11-05-aws-cdk-stage1.md)                                            | #551 · 이탈 16 · 미구현 3     | 대체됨       |
| 2026-11-05 | [목록 페이지네이션을 offset에서 cursor로 전환](./plans/2026-11-05-cursor-pagination.md)                                                                      |                               |              |
| 2026-11-05 | [이메일 보호 정책 확정과 유출 지점 보완 (2026-11-05)](./plans/2026-11-05-email-data-protection.md)                                                           | #547 · 이탈 0 · 미구현 0      |              |
| 2026-11-05 | [응답을 못 받은 쓰기 요청의 전역 처리](./plans/2026-11-05-global-outcome-unknown.md)                                                                         |                               |              |
| 2026-11-05 | [조회수와 열람 기록을 상세 진입 때만 남긴다](./plans/2026-11-05-post-view-record.md)                                                                         | #539 · 이탈 1 · 미구현 0      | 대체됨       |
| 2026-11-04 | [길이 상한이 있는 입력에 글자 수(0 / N)를 늘 보인다](./plans/2026-11-04-character-count.md)                                                                  | #521 #526 · 이탈 0 · 미구현 1 |              |
| 2026-11-04 | [댓글 없는 글은 카드 hover 때 댓글을 요청하지 않는다](./plans/2026-11-04-comment-hover-seed-empty.md)                                                        | #536 · 이탈 1 · 미구현 0      |              |
| 2026-11-04 | [글·댓글·메일 요청 중복 방지: `Idempotency-Key` 필수화](./plans/2026-11-04-idempotent-create.md)                                                             |                               |              |
| 2026-11-03 | [북마크 폴더 모달: 뒤로가기가 "닫기 요청"인 기기는 히스토리 없이 연다 (D안 + 카드 밖 스토어)](./plans/2026-11-03-bookmark-dialog-close-watcher.md)           | #504 · 이탈 1 · 미구현 0      | 대체됨(일부) |
| 2026-11-03 | [북마크 폴더 창: Android 뒤로가기로 새 폴더 입력만 취소](./plans/2026-11-03-bookmark-new-folder-back-cancel.md)                                              | #517 · 이탈 2 · 미구현 0      | 대체됨       |
| 2026-11-03 | [모바일 북마크 폴더 시트 닫힘 깜빡임: 딤·닫힘 맞추기(①②) + 시트를 카드 밖 호스트로(③)](./plans/2026-11-03-bookmark-sheet-close-flicker.md)                   | #509 #511 · 이탈 0 · 미구현 1 |              |
| 2026-11-03 | [#491 후속: 일부러 남겨 둔 6건 처리](./plans/2026-11-03-error-toast-followups-review.md)                                                                     | #500 #505 · 이탈 4 · 미구현 0 |              |
| 2026-11-03 | [에러 토스트 밖 문제 6건(#491) 고치기](./plans/2026-11-03-error-toast-followups.md)                                                                          |                               |              |
| 2026-11-03 | [공용 입력칸(FormInput·FormInputPassword)을 register로 연결](./plans/2026-11-03-form-input-register.md)                                                      |                               |              |
| 2026-11-03 | [계획 파일에 "구현 결과" 블록 허용 — 계획 문서만 보고도 실제로 한 일을 알 수 있게(FE·BE·claude-base)](./plans/2026-11-03-plan-result-block.md)               | #498 · 이탈 1 · 미구현 0      |              |
| 2026-11-03 | [남은 `watch()`를 `useWatch`로 바꾸고, 다시 생기지 않게 린트로 막기](./plans/2026-11-03-usewatch-remaining.md)                                               | #502 · 이탈 0 · 미구현 0      |              |
| 2026-11-02 | [#488 에러 토스트: 화면에 흔적이 남는가 조사 후 유지 시간 결정](./plans/2026-11-02-error-toast-persistence.md)                                               |                               |              |
| 2026-11-02 | [떠난 뒤 실패 토스트 — 닫을 때까지 남기고, 무엇이 실패했는지와 돌아갈 버튼을 단다(회원가입·게시글 등록·수정)](./plans/2026-11-02-left-page-failure-toast.md) |                               |              |
| 2026-11-02 | [orval zod로 BE 입력 제약 값 공유](./plans/2026-11-02-orval-zod-constraints.md)                                                                              |                               | 대체됨(일부) |
| 2026-11-02 | [비밀번호 변경 성공 토스트에 "다른 기기 재로그인" 안내 추가](./plans/2026-11-02-password-change-other-devices-notice.md)                                     |                               |              |
| 2026-11-02 | [비밀번호 칸 붙여넣기·표시 버튼 정책 — 지금 동작을 유지하는 근거를 AUTH.md에 기록](./plans/2026-11-02-password-paste-policy.md)                              |                               |              |
| 2026-11-02 | [탈퇴 후 재가입 이메일 정책 명시 (2026-11-02)](./plans/2026-11-02-resignup-email-policy.md)                                                                  |                               |              |
| 2026-11-02 | [운영 안전망 1순위 3종 — 장애 감지 · DB/Storage 백업 · 데모 계정](./plans/2026-11-02-safety-net-top3.md)                                                     |                               |              |
| 2026-11-02 | [저장 요청 중 이탈 — 회원가입 가드 적용 + 요청 중 전용 확인창(회원가입·게시글 등록·수정)](./plans/2026-11-02-signup-submit-leave-guard.md)                   |                               |              |
| 2026-11-02 | [토스트 문구를 문장 단위로 줄바꿈하고 글꼴을 Pretendard로 맞춘다](./plans/2026-11-02-toast-sentence-line-break.md)                                           |                               |              |
| 2026-11-01 | [헤더 검색: 같은 최근 검색어 재선택 시 입력창 채우기 + 닫힌 목록을 ↓로 열기](./plans/2026-11-01-navbar-recent-search-reselect-arrowdown.md)                  |                               |              |

## 2026-10 (59)

| 날짜       | 계획                                                                                                                                       | 대조 | 대체   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---- | ------ |
| 2026-10-31 | [AI 루프·멀티에이전트 도입 준비: 0·1단계 구현과 2·3단계 로드맵](./plans/2026-10-31-ai-loop-graph-readiness.md)                             |      | 대체됨 |
| 2026-10-30 | [Storybook·Swagger UI를 GitHub Pages로 — 운영 출처에서 문서 사이트 떼어내기](./plans/2026-10-30-docs-to-github-pages.md)                   |      |        |
| 2026-10-29 | [FE↔BE API 계약 자동 검사 — BE PR 스펙 비교 · MSW 스펙 타입 · 경로 타입 클라이언트](./plans/2026-10-29-api-contract-checks.md)             |      |        |
| 2026-10-28 | [북마크 폴더 화면 — 제목 옆 연필로 이름 바꾸기 + 모바일 정렬을 아이콘으로](./plans/2026-10-28-bookmark-folder-title-rename-sort-icon.md)   |      |        |
| 2026-10-28 | [로그인이 풀려도 쓰던 화면에 둔다 (Phase 2 폐기 · Phase 3 확장)](./plans/2026-10-28-keep-writing-in-place.md)                              |      |        |
| 2026-10-28 | [로그인 만료·로그아웃 때 쓰던 글 지키기](./plans/2026-10-28-session-expiry-draft-preservation.md)                                          |      |        |
| 2026-10-28 | [태블릿 대응 — 폭 축과 입력 축 나누기](./plans/2026-10-28-tablet-width-and-input-axes.md)                                                  |      |        |
| 2026-10-28 | [태블릿 대응 Phase 2 — 세로 구간을 레일로, 카드 최소 폭을 292로](./plans/2026-10-28-tablet-width-rail.md)                                  |      |        |
| 2026-10-27 | [북마크 폴더 고정 — 별도 구획 대신 "내 폴더" 맨 위로](./plans/2026-10-27-bookmark-folder-pin-in-my-folders.md)                             |      |        |
| 2026-10-27 | [첫 로딩 JS 줄이기 + 폰트 preload 운영 결과 기록](./plans/2026-10-27-first-load-js.md)                                                     |      |        |
| 2026-10-26 | [BE 아키텍처 골격: 레이어 관계 문서화 · 표준 대비 점검 · 도구로 고정](./plans/2026-10-26-be-architecture-skeleton.md)                      |      |        |
| 2026-10-26 | [BE 남은 것 정리: 보안 업데이트 · 위험 수정 · 죽은 코드·중복 정리 · 관측성](./plans/2026-10-26-be-remaining-cleanup.md)                    |      |        |
| 2026-10-26 | [북마크 폴더 고정(pin)](./plans/2026-10-26-bookmark-folder-pin.md)                                                                         |      |        |
| 2026-10-26 | [LCP 줄이기 — 데이터 요청 앞당기기 + 폰트 preload 정리](./plans/2026-10-26-lcp-prefetch-font-preload.md)                                   |      |        |
| 2026-10-26 | [Lighthouse Best Practices 77점 원인 제거 + Lighthouse CI가 회귀를 보이게 개선](./plans/2026-10-26-lighthouse-best-practices.md)           |      |        |
| 2026-10-25 | [BE 전체 점검: 파이프라인·패턴 정본화와 위반 정리](./plans/2026-10-25-be-architecture-audit.md)                                            |      |        |
| 2026-10-21 | [확인창을 거치는 삭제에 성공 토스트 복원](./plans/2026-10-21-delete-success-toast.md)                                                      |      |        |
| 2026-10-21 | [게시글 등록·수정 저장 중 이탈 — 확인창과 응답이 겹칠 때의 이동 버그 수정과 테스트](./plans/2026-10-21-post-submit-leave-guard.md)         |      |        |
| 2026-10-16 | [봇 글 숨기기 토글 시 피드가 좌우로 7.5px 흔들리는 문제](./plans/2026-10-16-hide-bots-layout-shift.md)                                     |      |        |
| 2026-10-16 | [localStorage에 쓰지 못하는 탭에서 같은 탭 로그인·로그아웃도 인증 세대로 알아채기](./plans/2026-10-16-in-tab-auth-epoch.md)                |      |        |
| 2026-10-16 | [경로 지정 커밋 뒤 인덱스가 정렬 전 내용으로 남는 문제(MM) 해소](./plans/2026-10-16-lint-staged-pathspec-index.md)                         |      |        |
| 2026-10-16 | [목록 필터 카드 카테고리 칩 레이아웃 시프트 제거 + 라이브러리 내부 동작 확인 지침](./plans/2026-10-16-post-list-category-cls.md)           |      |        |
| 2026-10-16 | [제출 페이지 진입 시 URL 칸 자동 포커스](./plans/2026-10-16-submit-url-autofocus.md)                                                       |      |        |
| 2026-10-15 | [남은 두 가지: CloudFront 차이 검사를 CI로, refresh 때 BE가 다른 계정 갱신을 거절](./plans/2026-10-15-drift-ci-and-refresh-guard.md)       |      |        |
| 2026-10-15 | [동작 줄이기 — CSS 애니메이션·트랜지션에서 움직임만 빼기](./plans/2026-10-15-reduced-motion-css.md)                                        |      |        |
| 2026-10-15 | [scope mutation의 인증 세대 확인 누락을 린트로 막기](./plans/2026-10-15-scope-mutation-auth-epoch-lint.md)                                 |      |        |
| 2026-10-15 | [refresh 회원 불일치 롤백 통합 테스트 (BE) + AUTH.md 한 문장 (FE)](./plans/2026-10-15-session-mismatch-rollback-integration-test.md)       |      |        |
| 2026-10-15 | [SESSION_MISMATCH 안내 토스트 — 토스트 단일 소유 원칙에 예외 명시](./plans/2026-10-15-session-mismatch-toast-exception.md)                 |      |        |
| 2026-10-14 | [캐시 전략 후속 — HTML no-cache(bfcache)·포커스 훅 제거·CloudFront 스냅샷](./plans/2026-10-14-cache-strategy-followups.md)                 |      |        |
| 2026-10-14 | [배포 후 옛 화면이 남는 네 군데 — 버그·배포 산출물 정리 + 개념 문서](./plans/2026-10-14-cache-strategy.md)                                 |      |        |
| 2026-10-14 | [카드 💬 아이콘 → 상세의 댓글 작성 영역으로 스크롤](./plans/2026-10-14-comment-icon-scroll-to-form.md)                                     |      |        |
| 2026-10-14 | [💬 도착 스크롤 방식 확정 + 상세 댓글 동시 요청 + 💬 hover 미리 받기](./plans/2026-10-14-comment-scroll-speed.md)                          |      |        |
| 2026-10-14 | [마지막 폴더를 빼도 다른 기기가 추가한 폴더는 지키기 — 서버가 실제 소속으로 판단](./plans/2026-10-14-last-folder-keeps-others.md)          |      |        |
| 2026-10-14 | [피드 범위 필터에 "좋아요한" 칩 추가](./plans/2026-10-14-liked-filter-chip.md)                                                             |      |        |
| 2026-10-14 | [피드 검색 필터: 정지 구간 버그 3건 수정 (에러 고착·뒤로가기 칩 고착·라벨 연속 클릭 유실)](./plans/2026-10-14-post-filter-pending-bugs.md) |      |        |
| 2026-10-14 | [계정이 바뀐 순간 진행 중이던 요청이 새 계정으로 재실행되는 문제 수정](./plans/2026-10-14-session-changed-guard.md)                        |      |        |
| 2026-10-13 | [북마크 토글을 상태 지정형(PUT/DELETE)으로 전환하고 같은 글의 북마크 요청을 한 줄로](./plans/2026-10-13-bookmark-set-state.md)             |      |        |
| 2026-10-13 | [배포 성공 시 열린 "배포 실패" 이슈 자동 종료 (#136 조치)](./plans/2026-10-13-deploy-failure-issue-autoclose.md)                           |      |        |
| 2026-10-13 | [e2e 숨은 flaky 2건 수정과 Playwright failOnFlakyTests](./plans/2026-10-13-e2e-flaky-layout-effect.md)                                     |      |        |
| 2026-10-13 | [GitHub Actions → AWS 인증을 영구 키에서 OIDC로 전환 (FE·BE)](./plans/2026-10-13-github-oidc-aws.md)                                       |      |        |
| 2026-10-13 | [좋아요 동시 요청 500 수정과 상태 지정형 API 전환](./plans/2026-10-13-like-concurrency.md)                                                 |      |        |
| 2026-10-13 | [좋아요 낙관적 업데이트 테스트 보강](./plans/2026-10-13-like-optimistic-tests.md)                                                          |      |        |
| 2026-10-13 | [FE CI 뮤테이션 비차단 보고](./plans/2026-10-13-mutation-ci-report.md)                                                                     |      |        |
| 2026-10-13 | [필수 체크 켜기 (FE check·e2e, BE check, 사람 예외 없음, 히스토리 봇은 GitHub App 토큰)](./plans/2026-10-13-required-checks.md)            |      |        |
| 2026-10-13 | [테스트 건너뛰기·단독 실행을 린트로 막고 Playwright forbidOnly 설정](./plans/2026-10-13-test-skip-only-lint.md)                            |      |        |
| 2026-10-12 | [Gemini History Updater push 경합 재시도](./plans/2026-10-12-history-push-retry.md)                                                        |      |        |
| 2026-10-12 | [좋아요 토글 응답에 likeCount 추가 및 FE 캐시 교정](./plans/2026-10-12-like-count-response.md)                                             |      |        |
| 2026-10-05 | [이미지 업로드: 실패 안내·소유권·고아 회수 (재검토판)](./plans/2026-10-05-image-upload-lifecycle.md)                                       |      |        |
| 2026-10-05 | [URL 접근별 에러 응답 정리 계획](./plans/2026-10-05-url-error-responses.md)                                                                |      |        |
| 2026-10-04 | [등록 폼 링크 미리보기로 인한 데스크톱 제출 버튼 레이아웃 밀림 해결](./plans/2026-10-04-post-preview-layout-shift.md)                      |      |        |
| 2026-10-03 | [글 등록: 응답 대기(A) + 작성 중 링크 미리보기(E) + 실패 원인 노출(F)](./plans/2026-10-03-post-create-preview.md)                          |      |        |
| 2026-10-03 | [features·widgets 슬라이스 교차 import 5건 제거 — render prop으로 위층 조립](./plans/2026-10-03-slice-cross-import.md)                     |      |        |
| 2026-10-02 | [프로젝트 전체(FE·BE) 온보딩 문서 — 길잡이(ONBOARDING.md) + 빈 기능 문서 단계별 보강](./plans/2026-10-02-onboarding-docs.md)               |      |        |
| 2026-10-02 | [온보딩 Phase 2 — 게시글(POST.md)·댓글(COMMENT.md) 독립 기능 문서 작성](./plans/2026-10-02-onboarding-phase2-feature-docs.md)              |      |        |
| 2026-10-02 | [문서화 중 발견한 게시글·댓글 문제 수정 + 댓글 알림 시연](./plans/2026-10-02-post-comment-fixes.md)                                        |      |        |
| 2026-10-02 | [Storybook 사이드바 구조 정비 — TEMP 해소·제목 규칙·허용 범위 문서화](./plans/2026-10-02-storybook-structure.md)                           |      |        |
| 2026-10-01 | [dependency-cruiser 도입 — 그래프 명령 · entities `@x` 강제 · 유령 의존성 차단 · PR 영향 그래프](./plans/2026-10-01-dependency-cruiser.md) |      |        |
| 2026-10-01 | [등록 폼 북마크 필드에도 폴더 목록 hover 프리페치](./plans/2026-10-01-post-create-folder-prefetch.md)                                      |      |        |
| 2026-10-01 | [회원가입 닉네임·이메일 확인 문구 레이아웃 시프트 제거 (B안: 안내 문구로 줄 채우기)](./plans/2026-10-01-signup-hint-text.md)               |      |        |

## 2026-09 (105)

| 날짜       | 계획                                                                                                                                                        | 대조 | 대체         |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------ |
| 2026-09-30 | [확인창(Alert)을 Radix AlertDialog로 교체 — 스크린리더에 "경고 대화상자"로 안내](./plans/2026-09-30-alert-dialog.md)                                        |      |              |
| 2026-09-30 | [북마크 폴더 모달 UX 4건 수정](./plans/2026-09-30-bookmark-modal-ux-fixes.md)                                                                               |      | 대체됨(일부) |
| 2026-09-30 | [Dialog/Modal/Alert 명칭 통일 — 식별자·경로만 개명하는 refactor](./plans/2026-09-30-dialog-naming-unification.md)                                           |      | 대체됨       |
| 2026-09-30 | [비밀번호 요구사항·확인 일치 실시간 표시](./plans/2026-09-30-password-live-feedback.md)                                                                     |      |              |
| 2026-09-30 | [게시글 카드의 카테고리 배지 클릭 → 피드 카테고리 필터](./plans/2026-09-30-post-card-category-filter.md)                                                    |      |              |
| 2026-09-30 | [게시글 카드 전체를 상세 진입 영역으로 (stretched link)](./plans/2026-09-30-post-card-stretched-link.md)                                                    |      |              |
| 2026-09-30 | [규칙 준수 강화 Phase 3 — 배포 결과 감시, 파일명 훅 워크트리·BE 세션 대응, 응답 언어 실험, hookify 끄기](./plans/2026-09-30-rule-enforcement-phase3.md)     |      |              |
| 2026-09-30 | [URL이 바뀌면 맨 위로 — 전역 규칙이 가상 스크롤 목록에서 무효가 되는 원인 제거](./plans/2026-09-30-scroll-reset-virtualizer-guard.md)                       |      |              |
| 2026-09-30 | [Storybook a11y CI 간헐 실패 — 뒤늦은 의존성 최적화 리로드 제거와 재발 감시](./plans/2026-09-30-storybook-optimize-deps.md)                                 |      |              |
| 2026-09-30 | [가상 스크롤 보정 가드(#261) 후속 — 남은 주의점 3가지](./plans/2026-09-30-virtualizer-guard-followups.md)                                                   |      |              |
| 2026-09-29 | [회원탈퇴 14일 유예기간 + 로그인 시 자동 복구 (2단계 탈퇴)](./plans/2026-09-29-account-deletion-grace-period.md)                                            |      |              |
| 2026-09-29 | [사이트 전체 버튼 규칙 재정립 + "프로필 수정" 모달을 "계정 설정" 페이지로 통합](./plans/2026-09-29-button-system-and-mypage-merge.md)                       |      |              |
| 2026-09-29 | [이탈 확인창 — "계속 작성"에 primary 강조 옮기기](./plans/2026-09-29-confirm-dialog-emphasis.md)                                                            |      |              |
| 2026-09-29 | [카드 그리드 열 수를 "실제 폭" 기준으로 전환](./plans/2026-09-29-container-width-grid.md)                                                                   |      |              |
| 2026-09-29 | [모달이 열린 직후 들어온 클릭을 무시하는 가드를 공용 DialogContent로 올리기](./plans/2026-09-29-dialog-open-click-guard.md)                                 |      |              |
| 2026-09-29 | [구분선 공통 컴포넌트(Divider) 만들기 — 폴더 사이드바·게시글 상세 댓글 영역](./plans/2026-09-29-divider-atom.md)                                            |      |              |
| 2026-09-29 | [FCM 푸시 알림 보안 강화 — 세션 바인딩 + 알림 내용 최소화](./plans/2026-09-29-fcm-session-binding.md)                                                       |      |              |
| 2026-09-29 | [회원가입 → 로그인 이동 시 이메일 값 전달](./plans/2026-09-29-login-email-prefill.md)                                                                       |      |              |
| 2026-09-29 | [BE Phase 7(OAC) + FE Phase 6(OAC 대응 + CSP) — 서버 직통 주소 완전 차단](./plans/2026-09-29-oac-lockdown.md)                                               |      |              |
| 2026-09-29 | [pages 레이어 hooks/ 세그먼트 도입 + 레이어 배치 정리 3건](./plans/2026-09-29-pages-hooks-layer-cleanup.md)                                                 |      |              |
| 2026-09-29 | [Claude 규칙 준수 강화 — 결정적 가드 우선, 환경 동작은 스파이크로 먼저 확인, CLAUDE.md 다이어트는 마지막](./plans/2026-09-29-rule-enforcement-hardening.md) |      |              |
| 2026-09-29 | [회원가입 폼 이탈 확인(Unsaved Changes Guard 확장)](./plans/2026-09-29-signup-unsaved-guard.md)                                                             |      |              |
| 2026-09-29 | [widgets/features 4곳 위젯 훅 분리](./plans/2026-09-29-widget-hook-extraction.md)                                                                           |      |              |
| 2026-09-28 | [인증 시스템 전면 강화 (비밀번호 찾기·변경·회원탈퇴·이메일인증·세션폐기·인프라 잠금)](./plans/2026-09-28-auth-hardening.md)                                 |      |              |
| 2026-09-27 | [모바일 키보드 힌트(`enterKeyHint`·`inputMode`) 도입](./plans/2026-09-27-enterkeyhint-inputmode.md)                                                         |      |              |
| 2026-09-27 | [폼 필수 항목 `*` + 선택 항목 "(선택사항)" 표시](./plans/2026-09-27-form-required-marker.md)                                                                |      |              |
| 2026-09-27 | [단일 사용 코드의 지역 함수 추출 — 규칙 정리 + TooltipWrapper 적용](./plans/2026-09-27-local-extract-for-readability.md)                                    |      |              |
| 2026-09-27 | [RUM 문서 정리 — docs/RUM.md 신설](./plans/2026-09-27-rum-docs.md)                                                                                          |      |              |
| 2026-09-27 | [/submit 모바일 등록 버튼 — 탭바 위 고정 바(A) + Enter 제출 라벨(B)](./plans/2026-09-27-submit-mobile-sticky-bar.md)                                        |      |              |
| 2026-09-27 | [TooltipWrapper 하이브리드 입력 방어 (터치 시 hover 툴팁 강제 억제)](./plans/2026-09-27-tooltip-wrapper-hybrid-input-guard.md)                              |      |              |
| 2026-09-26 | [post URL 검증 후속 정리 (규칙 문서 예외 명시 + 메시지 키 통합)](./plans/2026-09-26-post-url-message-consolidation.md)                                      |      |              |
| 2026-09-26 | [post URL 스킴 검증 추가 (file:// 등 크롤링 불가 URL을 입력 단계에서 차단)](./plans/2026-09-26-post-url-scheme-validation.md)                               |      |              |
| 2026-09-25 | [doc-drift 경량 감사가 마지막 push 1건만 검사하던 문제 수정](./plans/2026-09-25-doc-drift-audit-range.md)                                                   |      |              |
| 2026-09-25 | [Lighthouse 측정 자동화 + /post 성능 개선 계획](./plans/2026-09-25-lighthouse-perf.md)                                                                      |      |              |
| 2026-09-25 | [링크 등록 화면 "팀원들" 문구 수정](./plans/2026-09-25-post-form-audience-copy.md)                                                                          |      |              |
| 2026-09-24 | [북마크 폴더 모달 열림 직후 오탭 방지 + ⋮ 드롭다운 메뉴 재클릭 깜빡임 수정](./plans/2026-09-24-bookmark-modal-and-dropdown-trigger-click-fixes.md)          |      |              |
| 2026-09-24 | [⋮ 메뉴가 열렸다 바로 닫히는 문제: 원인 확정 후 수정](./plans/2026-09-24-dropdown-open-close-flicker.md)                                                    |      |              |
| 2026-09-24 | [드롭다운 메뉴: 스크롤 잠금 해제 + 스크롤 시 닫힘 + 바깥 첫 클릭은 닫기만](./plans/2026-09-24-dropdown-scroll-dismiss.md)                                   |      |              |
| 2026-09-24 | [PostCard·FolderTree: 포털 드롭다운을 연 동안 부모 hover 스타일 유지](./plans/2026-09-24-hover-or-open-variant.md)                                          |      |              |
| 2026-09-24 | [이슈 #163 해소 — BE OpenAPI 스펙 스냅샷 갱신](./plans/2026-09-24-openapi-drift-163.md)                                                                     |      |              |
| 2026-09-24 | [입력창 placeholder가 드래그 선택 하이라이트에 잡히지 않게 하기](./plans/2026-09-24-placeholder-select-none.md)                                             |      |              |
| 2026-09-24 | [Select: 닫힌 직후 재오픈 방지 가드](./plans/2026-09-24-select-reopen-guard.md)                                                                             |      |              |
| 2026-09-22 | [북마크 사이드바 — "내 폴더" 라벨 고정 + "새 폴더 만들기" 상단 이동](./plans/2026-09-22-bookmark-sidebar-create-position.md)                                |      |              |
| 2026-09-22 | [queryClient.ts 전역 에러 핸들러 중복 제거](./plans/2026-09-22-queryclient-error-handler-dedupe.md)                                                         |      |              |
| 2026-09-22 | [기존 5개 skill 문서 SSOT 드리프트 전수 수정 + 외부 스킬 도입](./plans/2026-09-22-skills-ssot-drift-fix.md)                                                 |      |              |
| 2026-09-21 | [북마크 "새 폴더 만들기"에 취소 버튼 추가 + ESC가 모달을 닫는 버그 수정](./plans/2026-09-21-bookmark-create-folder-cancel.md)                               |      |              |
| 2026-09-21 | [북마크 폴더 사이드바 — "최근 저장한 폴더" 개선 + 스크롤 도달 불가 수정](./plans/2026-09-21-bookmark-folder-sidebar-fixes.md)                               |      |              |
| 2026-09-21 | [브랜드 컬러(틸) 되돌리기 — 원래 무채색 `--primary`로 복원](./plans/2026-09-21-brand-color-revert.md)                                                       |      |              |
| 2026-09-21 | [LinkSphere 디자인 개편 — 색·타이포·입체감·정렬](./plans/2026-09-21-design-tokens-refresh.md)                                                               |      |              |
| 2026-09-21 | [데스크톱 헤더 검색에 최근 검색어 드롭다운 추가](./plans/2026-09-21-desktop-recent-search-dropdown.md)                                                      |      |              |
| 2026-09-21 | [doc-drift 트래킹 이슈(#99) 노이즈 제거 + 본문 대시보드화](./plans/2026-09-21-doc-drift-issue-dashboard.md)                                                 |      |              |
| 2026-09-21 | [⋮ 메뉴가 "누르자마자 사라지는" 문제 수정 — 트리거를 click 기반으로](./plans/2026-09-21-dropdown-trigger-click.md)                                          |      |              |
| 2026-09-21 | [보관함 사이드바 — 스크롤바가 먹은 폭 때문에 어긋난 폴더 개수 정렬 맞추기](./plans/2026-09-21-folder-sidebar-scrollbar-gutter.md)                           |      |              |
| 2026-09-21 | [MSW 기본 핸들러(post·comment·bookmark-folder) `/api` 접두사 누락 수정](./plans/2026-09-21-msw-handler-prefix-fix.md)                                       |      |              |
| 2026-09-21 | [나만보기(공개범위) 토글에 방향별 성공 토스트 추가](./plans/2026-09-21-post-visibility-toast.md)                                                            |      |              |
| 2026-09-21 | [PostCard 제목이 자물쇠·케밥 아이콘에 폭을 빼앗기는 문제 개선](./plans/2026-09-21-postcard-header-title-width.md)                                           |      |              |
| 2026-09-21 | [데스크톱 최근검색 드롭다운 — 화살표 키 순환 제거 + 스크롤 추적](./plans/2026-09-21-recent-search-arrow-nav-cycle-removal.md)                               |      |              |
| 2026-09-21 | [검색창 X 버튼: 입력창 포커스 복원 + 헤더 X의 검색 해제 통일](./plans/2026-09-21-search-clear-focus.md)                                                     |      |              |
| 2026-09-21 | [검색 태그 파서 경계 수정 — `@a@b` 붙여쓰기 지원](./plans/2026-09-21-search-tag-boundary.md)                                                                |      |              |
| 2026-09-21 | [클릭 가능한 요소의 텍스트 선택 방지 (`user-select: none`) 전역화](./plans/2026-09-21-select-none-global.md)                                                |      |              |
| 2026-09-20 | [배포 반영 확인 수단 (Build Provenance)](./plans/2026-09-20-build-version.md)                                                                               |      |              |
| 2026-09-20 | [다크모드 토글이 next-themes를 우회하는 버그 수정](./plans/2026-09-20-navbar-theme-toggle-next-themes.md)                                                   |      |              |
| 2026-09-20 | [유닛 테스트 NProgress 타이머 누수로 인한 배포 CI 간헐 실패 제거](./plans/2026-09-20-nprogress-test-timer-flake.md)                                         |      |              |
| 2026-09-20 | [Storybook 공개 배포 (S3 + CloudFront 재사용)](./plans/2026-09-20-storybook-public-deploy.md)                                                               |      |              |
| 2026-09-20 | [썸네일 실패 URL 세션 캐시 — 콘솔 에러 누적 / 외부 rate limit 소진 차단](./plans/2026-09-20-thumbnail-failure-session-cache.md)                             |      |              |
| 2026-09-19 | [가상 스크롤 실동작 e2e 증거 확보](./plans/2026-09-19-virtualize-post-list-e2e-verification.md)                                                             |      |              |
| 2026-09-19 | [무한스크롤 리스트 가상화 + 렌더링 최적화](./plans/2026-09-19-virtualize-post-list.md)                                                                      |      |              |
| 2026-09-17 | [모바일 검색 패널이 열린 동안 댓글 작성바 숨기기 + 배경 차단](./plans/2026-09-17-mobile-search-overlay-comment-bar.md)                                      |      |              |
| 2026-09-17 | [화면 덮는 오버레이 전체에 배경 스크롤 잠금 공통 적용](./plans/2026-09-17-overlay-scroll-lock.md)                                                           |      |              |
| 2026-09-16 | [타이포그래피 토큰 도입 + 접근성 CI 게이트](./plans/2026-09-16-typography-tokens-a11y-gate.md)                                                              |      |              |
| 2026-09-14 | [댓글 첨부 이미지 지연 로드로 인한 레이아웃 시프트 수정](./plans/2026-09-14-comment-image-cls.md)                                                           |      |              |
| 2026-09-14 | [e2e 시나리오 카탈로그 재수립 + 티어 3 흐름 구현](./plans/2026-09-14-e2e-tier3-scenarios.md)                                                                |      |              |
| 2026-09-14 | [필터 칩 URL 상태 — mutation 제거 및 pending-intent 명시적 추적](./plans/2026-09-14-filter-chip-pending-url.md)                                             |      |              |
| 2026-09-14 | [로그아웃 시 불필요한 배경 재요청 제거](./plans/2026-09-14-logout-no-refetch.md)                                                                            |      |              |
| 2026-09-14 | [내 댓글 히스토리 화면 추가](./plans/2026-09-14-my-comments.md)                                                                                             |      |              |
| 2026-09-14 | [포스트 상세 돌아가기 버튼 — sticky 고정 + 라벨 정리](./plans/2026-09-14-post-detail-sticky-back.md)                                                        |      |              |
| 2026-09-14 | [`/post` 세로 간격 축소](./plans/2026-09-14-post-spacing-tighten.md)                                                                                        |      |              |
| 2026-09-14 | [로그아웃 후 재로그인 시 "내 댓글" 에러 캐시 재사용 버그 수정](./plans/2026-09-14-relogin-mycomments-cache-fix.md)                                          |      |              |
| 2026-09-13 | [Link-Sphere FE 디자인 시스템 기반 구축 (1단계: 화면 무변경 범위)](./plans/2026-09-13-design-system-foundation.md)                                          |      |              |
| 2026-09-11 | [북마크 마지막 폴더 해제 시 완전 삭제 + 낙관적 갱신 버그 수정](./plans/2026-09-11-bookmark-last-folder-remove.md)                                           |      |              |
| 2026-09-11 | [비로그인 북마크 → 로그인 후 자동 재개 + 공유 아이콘 fill 버그 수정](./plans/2026-09-11-bookmark-login-resume.md)                                           |      |              |
| 2026-09-11 | [북마크 모달: 미분류 재탭 삭제 + 하단 액션 발견성 개선](./plans/2026-09-11-bookmark-uncategorized-retap-remove.md)                                          |      |              |
| 2026-09-11 | [보관함/게시글 목록 커서 깜빡임 — 원인 재현 및 확정](./plans/2026-09-11-cursor-flicker-fix.md)                                                              |      |              |
| 2026-09-10 | [세션 검증 영상 — Playwright MCP devtools 활성화](./plans/2026-09-10-browser-verification-video.md)                                                         |      |              |
| 2026-09-10 | [외부 인용을 "우리가 직접 겪은 것"처럼 쓰지 않기](./plans/2026-09-10-citation-attribution-rule.md)                                                          |      |              |
| 2026-09-10 | [레포 전체 주석·문서 오류 정리 (SSOT 위반 정정)](./plans/2026-09-10-docs-accuracy-cleanup.md)                                                               |      |              |
| 2026-09-10 | [e2e 흐름 확장 (2차) — 로그인·로그아웃·좋아요 캐시 전파·댓글 카운트](./plans/2026-09-10-e2e-flows-phase2.md)                                                |      |              |
| 2026-09-10 | [Playwright e2e 도입 (1차) — 러너·모킹·CI 기반 만들기](./plans/2026-09-10-e2e-playwright-foundation.md)                                                     |      |              |
| 2026-09-10 | [e2e 시나리오 카탈로그 수립 + 티어 1 흐름 4개 구현](./plans/2026-09-10-e2e-scenario-catalog-tier1.md)                                                       |      |              |
| 2026-09-10 | [e2e 시나리오 카탈로그 — 티어 2 흐름 5개 구현](./plans/2026-09-10-e2e-scenario-catalog-tier2.md)                                                            |      |              |
| 2026-09-10 | [로딩 인디케이터 지연 게이트 일관 적용](./plans/2026-09-10-loading-delay-gate.md)                                                                           |      |              |
| 2026-09-10 | [upload.api.ts의 어긋난 신호 정리 (TEXTS 키 리네임 + JSDoc)](./plans/2026-09-10-upload-api-texts-fix.md)                                                    |      |              |
| 2026-09-09 | [질문 전에 판단 재료를 먼저 주는 규칙 문서화 (CLAUDE.md §13 / BE §9)](./plans/2026-09-09-ask-before-asking.md)                                              |      |              |
| 2026-09-09 | [entities/user를 auth/account/user 세 엔티티로 분리](./plans/2026-09-09-auth-account-user-entity-split.md)                                                  |      |              |
| 2026-09-09 | [entities/bookmark/folder 전체 export를 BookmarkFolder로 개명](./plans/2026-09-09-bookmark-folder-entity-rename.md)                                         |      |              |
| 2026-09-09 | [entities/bookmark/folder 역할 파일명을 bookmark-folder.\*로 개명](./plans/2026-09-09-bookmark-folder-filename-rename.md)                                   |      |              |
| 2026-09-09 | [UI에서 직접 부르던 카테고리 옵션 쿼리를 entity 공용 훅으로 모으기](./plans/2026-09-09-category-options-hook.md)                                            |      |              |
| 2026-09-09 | [아키텍처 위반 재발 방지 — 1단계: 정본 문서 ↔ 실제 코드 정합성 감사 (실행 계획)](./plans/2026-09-09-docs-code-alignment-audit.md)                           |      |              |
| 2026-09-09 | [계획 파일에 순서도가 안 들어가던 원인 제거 — §12 범위 교정 + PostToolUse 훅](./plans/2026-09-09-plan-diagram-hook.md)                                      |      |              |
| 2026-09-09 | [포스트 등록·수정 폼 URL 필드의 브라우저 자동완성 끄기](./plans/2026-09-09-post-url-autocomplete-off.md)                                                    |      |              |
| 2026-09-08 | [북마크 폴더 선택 컴포넌트 개명 — PostCardBookmarkFolderModal / PostCreateBookmarkFolderField](./plans/2026-09-08-bookmark-modal-rename.md)                 |      |              |
| 2026-09-08 | [폴더 배열 네이밍 컨벤션 — `folders` → `folderList` 통일 + 죽은 코드 정리](./plans/2026-09-08-folder-list-naming.md)                                        |      |              |
| 2026-09-08 | [entities 폴더 선택 엔진 개명 — FolderPickerModal/useFolderPicker → FolderSelectModal/useFolderSelect](./plans/2026-09-08-folder-select-rename.md)          |      |              |
| 2026-09-08 | [배포 전 "계획 대비 구현" 검증 프로세스 수립](./plans/2026-09-08-plan-verification-process.md)                                                              |      | 대체됨(일부) |
| 2026-09-08 | [고위험 공백에 선별적으로 테스트 추가](./plans/2026-09-08-selective-test-coverage.md)                                                                       |      |              |
