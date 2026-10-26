# 성능 측정 가이드

이 문서는 Lighthouse 측정을 재현하는 절차 문서(how-to)다. "왜 이 방식을 골랐는가"는
`docs/DECISIONS.md`(LHCI assertion 단계, og 이미지 파이프라인 검토), "무엇을 언제
바꿨는가"는 `docs/plans/2026-09-25-lighthouse-perf.md`(계획)와 `CHANGELOG.md`를 본다.
실사용자(필드) 데이터는 이 문서가 아니라 [`docs/RUM.md`](RUM.md)에서 다룬다.

## 개요

- 도구: [`@lhci/cli`](https://github.com/GoogleChrome/lighthouse-ci)(Lighthouse CI). 로컬과
  GitHub Actions CI가 같은 설정 파일을 공유한다.
- 측정 대상은 **이 브랜치의 빌드 결과물**이다(`vite preview`로 로컬에서 서빙) — 배포된
  프로덕션이 아니다. 프로덕션 자체를 재려면 "프로덕션 재측정" 절을 본다.
- 5회 측정 후 중앙값을 쓴다. Lighthouse 공식 variability 문서: _"5회 실행의 중앙값
  점수가 1회보다 2배 안정적이다"_(번역, [출처](https://github.com/GoogleChrome/lighthouse/blob/main/docs/variability.md)).
- assertion은 전부 `warn`이다 — PR을 막지 않고 리포트만 남긴다. 근거와 향후 `error`
  승격 기준은 `docs/DECISIONS.md`를 본다.

## 빠른 시작

```bash
SKIP_CSP_INJECTION=1 pnpm build   # dist/를 만든다 (lighthouserc.cjs가 이걸 서빙해서 잰다). CSP 주입은 건너뛴다 — 아래 "자주 발생하는 문제"
pnpm perf:lh                      # 공개 페이지 4개 × 5회, 데스크톱 프리셋
```

`pnpm perf:lh`는 내부적으로 `vite preview --port 4173 --strictPort`로 서버를 직접
띄웠다 끄므로, 미리 `pnpm preview`를 따로 실행해둘 필요는 없다(포트가 이미 쓰이고
있으면 `--strictPort` 때문에 명확히 실패한다).

측정이 끝나면 각 URL·실행마다의 리포트 링크가 콘솔에 출력된다
(`upload.target: 'temporary-public-storage'` — 며칠 후 자동 삭제되는 임시 링크다).

## 측정 URL

| 분류        | URL                                                           | 설정 파일               |
| ----------- | ------------------------------------------------------------- | ----------------------- |
| 공개        | `/post`, `/post/:id`, `/auth/login`, `/auth/sign-up`          | `lighthouserc.cjs`      |
| 로그인 필요 | `/post/submit`, `/post/edit/:id`, `/bookmark`, `/my/comments` | `lighthouserc.auth.cjs` |

`:id`는 측정 전용으로 tester_new_999 계정이 등록한 고정 게시글(공개,
`https://tech.kakao.com/`, id `06ec0958-a33c-4c3f-81f6-0481badbbeb7`)이다 — 존재가
보장된 ID가 없어 한 번 뺐던 것을 2026-09-26 이 게시글을 만들어 해소했다. 처음엔
`https://www.inflearn.com/`로 등록했으나 BE 스크래퍼가 이 URL을 일본어로 긁어오는
문제가 반복돼(원인 미확정) 같은 게시글 ID를 유지한 채 URL만 안정적으로 한국어로
스크랩되는 `tech.kakao.com`으로 바꿨다. 이 게시글은 지우지 않는다(지우면 두 설정
파일이 다시 깨진다).

## 로그인 필요 페이지 측정

```bash
export LH_TEST_PASSWORD='...'   # 대화로만 받고 파일에 남기지 않는다
SKIP_CSP_INJECTION=1 pnpm build
pnpm perf:lh:auth
```

- 테스트 계정은 `tester_new_999@example.com`을 쓴다. README `## 테스트 계정`의
  계정(수동 QA용, 실사용자 데이터 있음)이 아니다 — 이유는
  `.claude/skills/browser-verification/SKILL.md`의 "로그인 계정" 절과 같다(정정,
  2026-09-29: `docs/TESTING.md`에는 자체 "로그인 계정" 절이 없고, 그 문서도 같은
  skill 파일의 절을 가리킨다).
- 로그인은 `scripts/lighthouse-login.cjs`(LHCI의 `puppeteerScript`)가 자동으로 한다.
  이미 로그인 상태(`has-session` localStorage 플래그가 살아있는 상태로 재실행)면 조용히 건너뛴다.
- `disableStorageReset: true`로 5회 실행 내내 세션 쿠키를 유지한다 — 꺼두면 매
  실행마다 `/auth/refresh`를 한 번씩 더 타서 순수 페이지 성능과 무관한 지연이 섞인다.

## 프로덕션 재측정

배포 후 실제 체감 성능을 확인할 때는 프로덕션 URL을 직접 넘긴다(로컬 설정 파일을
쓰지 않는다 — `startServerCommand`가 로컬 빌드를 서빙하는 용도라 프로덕션에는 안 맞는다):

```bash
npx lhci collect --url=https://linksphere.click/post \
  --numberOfRuns=5 --preset=desktop
```

모바일(느린 4G) 프리셋으로 재려면 [PageSpeed Insights](https://pagespeed.web.dev/)를
직접 쓰는 편이 더 간단하다 — Lighthouse 코어와 같은 엔진이고 모바일 스로틀링·CrUX
필드 데이터 유무까지 한 화면에서 보여준다.

## CI 게이트

`.github/workflows/ci.yml`의 `lighthouse` job이 PR마다 공개 페이지 4개를 측정한다.

- **기준**: Best Practices만 `error`(`minScore: 0.9`)이고 나머지는 `warn`이다. 0.9는 가중치 1짜리 감사 2개까지는
  통과하고, 3·5짜리(`paste-preventing-inputs`·`deprecations`·`third-party-cookies` 등)는 하나만 실패해도 걸리는
  선이다. 기준 미달이면 job이 실패하지만(로컬 `pnpm perf:lh`도 종료 코드 1), 필수 체크가 아니라 병합은 막히지
  않는다. 처음엔 전부 `warn`이었는데(`docs/DECISIONS.md` 2026-09-26), Best Practices는 통과/실패형 감사라 타이밍
  지표 같은 노이즈가 없어 2026-10-26에 이 항목만 올렸다(`docs/plans/2026-10-26-lighthouse-best-practices.md`).
- **흔들림 격리**: PR 코드와 무관한 감점으로 빨간 ✗가 뜨지 않게 두 가지를 둔다(2026-10-26, PR #416의 CI에서
  코드는 그대로인데 `/post`가 첫 실행 0.93, 재실행 0.96으로 갈렸다).
  - Best Practices만 5회 중 가장 좋은 실행으로 판정한다(`aggregationMethod: 'optimistic'`). 다른 단언이 쓰는
    `median-run`은 성능 지표가 중간인 실행 하나의 점수를 그대로 써서, 간헐적인 콘솔 에러가 그 실행에 걸리느냐로
    결과가 갈렸다. 5회 내내 나는 문제는 그대로 잡힌다.
  - CloudWatch RUM 전송(`dataplane.rum.ap-northeast-1…`)을 `blockedUrlPatterns`로 막는다. RUM 허용 도메인에
    localhost가 없어 CI에서는 전송이 400으로 거절되고 그 콘솔 에러가 감점이 됐다. 차단된 요청은 Lighthouse가 콘솔
    에러로 세지 않는다. RUM 스크립트 자체는 실제 사용자도 받는 비용이라 막지 않는다.
  - 근거: Lighthouse CI 문서는 결과가 흔들리면 _"외부 의존을 피하라(광고, YouTube 임베드, 애널리틱스 같은 가변적인
    서드파티 연동을 끈다)"_ (번역, [troubleshooting.md](https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/troubleshooting.md))고
    권한다. 기준(0.9)을 낮추는 방법은 진짜 회귀까지 가려 쓰지 않았다.
  - 남는 흔들림: CI 빌드가 운영 API의 실제 피드를 그리므로, 응답에 `Set-Cookie`를 싣는 외부 썸네일이 피드 첫
    화면에 있으면 `inspector-issues`(가중치 1)가 깎인다(2026-10-26 `skills.sh/og.jpeg`).
- **결과 보기**: `scripts/lighthouse-report.js`가 페이지별 4개 카테고리 중앙값, 기준을 못 넘은 항목, 실행 과반에서
  실패한 Best Practices 감사를 표로 만들어 PR 댓글 1개(다시 push하면 갱신)와 job Step Summary에 싣는다. 로컬에서는
  `pnpm perf:lh` 뒤 `node scripts/lighthouse-report.js`로 같은 표를 본다.
- **리포트 보관**: 원본 JSON·HTML은 job 아티팩트 `lighthouse-report`(30일)에 있다. `.lighthouseci/`가 숨김 폴더라
  `include-hidden-files: true` 없이는 업로드가 통째로 빠졌다(2026-10-26 이전 run 전부). 댓글의 리포트 링크는 LHCI
  임시 저장소라 며칠 뒤 지워진다.
- **CI가 못 보는 것**: 빈 프로필로 재므로 측정자 쿠키 저장소에 따라 달라지는 감점(아래 "Best Practices 77점 사례")은
  재현되지 않는다. 엔진도 `@lhci/cli` 0.15.1에 묶인 Lighthouse 12.6.1이라 DevTools(13.x)와 점수가 조금
  다를 수 있다(13은 Best Practices에서 `viewport`·`font-size`를 뺐다).
- **로그인 필요 페이지는 CI에 없다** — 테스트 계정 비밀번호를 GitHub Actions secret으로 등록하는 별도 절차가 필요해
  넣지 않았다(추가하려면 `LH_TEST_PASSWORD`를 레포 secret으로 등록하고 `lighthouserc.auth.cjs`로 job을 하나 더 두면
  된다).

## 실측 결과

### 코드 변경 전후 비교 (직접 측정, 2026-09-26)

`pnpm build` 결과물(`dist/`, `dist/stats.html` — 이 번들 분석 리포트는 2026-10-14부터 로컬 빌드에서만 만들어지고 CI·배포 빌드에는 없다, `vite.config.ts`)을 이 PR의 각 커밋 전후로 직접 비교해서 잰
값이다 — 추정이 아니라 실제 빌드 산출물 크기다. 재현 절차: `pnpm build` 후
`ls -la dist/assets/js/`와 `grep -o 'href="[^"]*"' dist/index.html`로 modulepreload 목록을
확인한다.

**JS 청크 크기**

| 청크                           | 이전                     | 이후                                             | 비고                                                                                            |
| ------------------------------ | ------------------------ | ------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `vendor`                       | 413.32 KB                | 335.48 KB                                        | Firebase를 별도 청크로 분리하며 그만큼 줄었다                                                   |
| `firebase-vendor`(신규)        | 없음(vendor에 포함)      | 77.66 KB, `index.html` modulepreload 목록에 없음 | 로그인 상태에서만 동적 import되므로 비로그인 방문자는 아예 안 받는다                            |
| `form-vendor`(react-hook-form) | 86.77 KB(zod 포함)       | 30.40 KB                                         | zod를 별도 청크로 뺐다                                                                          |
| `zod-vendor`(신규)             | 없음(form-vendor에 포함) | 56.12 KB, 여전히 modulepreload 목록에 있음       | entities 스키마가 zod를 필요로 해 폼이 없는 페이지도 여전히 받는다(form-vendor와는 분리됐을 뿐) |
| 진입 청크(`index-*.js`)        | 105.52 KB                | 101.45 KB                                        | `LoginDialog`를 정적 렌더에서 뺐다                                                              |

**폰트 로딩**

| 항목                 | 이전                                                      | 이후                                                                  |
| -------------------- | --------------------------------------------------------- | --------------------------------------------------------------------- |
| 방식                 | 정적 굵기별 subset 9종                                    | 가변 폰트 + unicode-range 92분할(Pretendard 공식 dynamic subset)      |
| `<link rel=preload>` | 4종, 약 1.07MB                                            | 92개 중 19개(선별), 약 480KB — 이유는 아래 "폰트 preload 유지보수" 절 |
| 실제 전송량(첫 로딩) | preload된 4종 전부(약 1.07MB), 실제 쓰는 굵기·글자와 무관 | 화면에 실제 쓰인 글자만큼만, 파일당 약 20~40KB                        |
| 외부 요청            | `fonts.googleapis.com`(Inter, 렌더 차단) + preconnect 2개 | 없음                                                                  |

**LCP 후보 이미지**

| 항목                        | 이전                                 | 이후                                                                                |
| --------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------- |
| 목록 첫 행(최대 3장) 썸네일 | `loading="lazy"`, 우선순위 힌트 없음 | `loading="eager"` + `fetchPriority="high"`                                          |
| 상세 페이지 카드 썸네일     | `loading="lazy"`, 우선순위 힌트 없음 | `loading="eager"` + `fetchPriority="high"`(2026-10-26, 아래 "LCP 데이터 요청 시점") |
| 나머지 썸네일               | `loading="lazy"`                     | 변경 없음(그대로 lazy)                                                              |

### Lighthouse 지표

| 시점                                         | 대상                              | Performance | LCP       | FCP      | Speed Index | CLS      | 비고                                                                                                                     |
| -------------------------------------------- | --------------------------------- | ----------- | --------- | -------- | ----------- | -------- | ------------------------------------------------------------------------------------------------------------------------ |
| 2026-09-25(개선 전)                          | 프로덕션 `/post`, 데스크톱        | —           | 2.3s      | 0.9s     | 2.9s        | —        | 사용자 제공 Lighthouse 13.4.1 리포트(일부 잘림)                                                                          |
| 2026-09-26(개선 전)                          | 프로덕션 `/post`, 모바일(느린 4G) | 65          | 9.4s      | 2.6s     | 6.2s        | 0.062    | PageSpeed Insights 실측                                                                                                  |
| 2026-09-26(PR #195 배포 후, preload 적용 전) | 프로덕션 `/post`, 데스크톱        | 94          | 1.5s      | 0.8s     | 1.4s        | 0.014    | PageSpeed Insights 실측 — 개선됨                                                                                         |
| 2026-09-26(PR #195 배포 후, preload 적용 전) | 프로덕션 `/post`, 모바일(느린 4G) | 61          | **11.0s** | **4.8s** | 5.5s        | 0.062    | PageSpeed Insights 실측 — **LCP·FCP 악화**(원인: 아래 "폰트 preload 유지보수" 절)                                        |
| 2026-09-26(PR #198 배포 후, preload 적용)    | 프로덕션 `/post`, 모바일(느린 4G) | **70**      | **5.7s**  | **2.4s** | 6.4s        | **0.01** | PageSpeed Insights 실측 — 회귀 전(65/9.4s)보다도 더 좋아짐. 폰트 요청 19개가 전부 343~346ms 안에 동시 시작되는 것도 확인 |

데스크톱은 개선됐지만 모바일(느린 4G)은 폰트 preload가 없어 오히려 나빠졌다가(원인·대응은
바로 아래 "폰트 preload 유지보수" 절), preload 반영 후 재측정에서 회귀 전보다도 더
좋아졌다. 위 "코드 변경 전후 비교"는 애초에 왜 개선을 기대했는지의 근거였을 뿐, 실제
모바일 결과는 그 예상과 한 번 어긋났다가(폰트 fan-out을 놓침) 이번 preload로 바로잡혔다.
계획 대비 구현 전체 대조는 `docs/plans/2026-09-25-lighthouse-perf.md`와 PR 본문의
"계획 대비 구현"을 본다.

### 폰트 preload 유지보수

`/post` 피드는 여러 게시글의 제목·설명·태그가 섞여 있어, 다른 페이지보다 한 화면에
필요한 Pretendard dynamic-subset 조각(92개 중 일부) 수가 많다. 2026-09-26 배포
직후 재측정에서 **preload 없이는 이게 오히려 독이 된다는 게 드러났다** — 조각 20개가
CSS 파싱 후에야 뒤늦게 발견돼 두 웨이브(약 640ms대, 1210ms대)로 나뉘어 요청되면서
모바일 LCP가 9.4s→11.0s로 악화됐다(FCP도 2.6s→4.8s).

**대응: 자주 쓰이는 조각만 골라 `index.html`에 preload를 다시 넣는다.**
`scripts/compute-font-preload-chunks.js`가 최근 300개 게시글(title+description+tags)을
가져와 실제로 필요한 조각 인덱스를 계산한다 — 2026-09-26 기준 92개 중 **19개**(약 480KB,
예전 정적 subset preload 1.07MB보다는 여전히 적다).

```bash
node scripts/compute-font-preload-chunks.js
# 콘솔에 <link rel=preload> 태그 목록이 출력된다 - index.html에 통째로 교체해 붙여넣는다
```

- **자동 반영 안 함.** 이 스크립트는 파일을 직접 고치지 않는다 — 사람이 결과를 보고
  `index.html`에 수동으로 붙여넣는다.
- **최근 300개로 캡을 두는 이유.** 게시글이 계속 늘어도 계산 비용이 고정되게
  하기 위해서다. 지금은 전체 게시글 수가 300개보다 적어 사실상 전체를 보는 것과
  같지만, 캡 자체가 향후 대비다(2026-09-26 사용자 결정).
- **자동 드리프트 감시(매일 cron으로 재계산해 어긋나면 GitHub 이슈로만 알리는 방식)는
  검토했지만 지금은 만들지 않기로 결정했다** — 지금 당장 문제가 아니고, 매번 자동
  실행되는 파이프라인을 늘리고 싶지 않다는 게 이유다(2026-09-26). 나중에 이 preload
  목록이 실제 콘텐츠와 눈에 띄게 어긋나(예: 모바일 LCP가 다시 나빠지면) 자동화가
  필요해지면, `openapi-drift-check.yml` + `scripts/check-openapi-drift.js`의 형태
  (매일 cron, 레포에 쓰지 않고 GitHub 이슈로만 보고, PR을 막지 않음)를 그대로 따라
  만들면 된다 — 그 스크립트가 "운영 스펙과 커밋된 스냅샷이 다른지"를 확인하는 것과
  똑같은 구조로, "실제 필요한 조각과 index.html에 preload된 조각이 다른지"를 확인하면
  된다.
- **선례를 따라간 게 아니라 직접 내린 판단이다.** 당근마켓 검색 결과 페이지
  (`/kr/search/buy-sell/`, 우리 피드와 같은 "다양한 글이 섞인 목록" 구조)를 2026-09-26
  직접 재보니, 폰트 요청 17개·preload 0개로 우리와 같은 상태였고, 모바일 Performance
  49점·LCP 21.9s로 **우리보다 더 나빴다**. 즉 "당근도 이렇게 하니까 문제없다"는
  근거로 쓸 수 없다 — 이 페이지 유형(다양한 텍스트가 섞인 피드)에서 dynamic subset을
  preload 없이 쓰는 건 업계에서도 안 풀린 문제로 보이고, 우리는 여기서 선례를
  따라가는 대신 직접 풀기로 했다.

### LCP 데이터 요청 시점 (직접 측정, 2026-10-26)

피드와 상세 모두 LCP 요소는 외부 og 썸네일(IMG)이었다. 그 썸네일 주소는 게시글 API 응답에 들어 있다.
그런데 게시글 요청은 lazy 페이지 청크가 도착해 렌더된 뒤에야 나가서, 청크 다운로드 → API → 썸네일이
차례로 이어졌다.

측정 방법은 운영 대상 Playwright Chromium이다. 캐시를 끈 새 페이지에서 `PerformanceObserver('largest-contentful-paint')`와
Resource Timing을 모았다. 모바일은 CDP `Network.emulateNetworkConditions`(지연 150ms, 1.44Mbps)와 CPU 4배 감속,
412×823 조건이다. RUM 전송은 차단했다.

| 관찰(적용 전)                            | 모바일                       | 데스크톱       |
| ---------------------------------------- | ---------------------------- | -------------- |
| `/post` 카테고리 요청 시작(라우트에서)   | 4,734ms                      | 241ms          |
| `/post` 게시글 목록 요청 시작(청크 안)   | 5,273ms                      | 338ms          |
| 상세: 페이지 청크 → `GET /post/:id` 시작 | 청크 4,727~5,329 → API 5,343 | 177~312 → 315  |
| `/post` FCP → LCP                        | 4.7s → 8.2s                  | LCP 0.48~0.70s |

- **바꾼 것**: 피드·상세 라우트가 페이지 청크를 요청하는 같은 렌더에서 목록 첫 페이지·상세·댓글을 요청한다.
  그 경위는 [`SEARCH.md`](SEARCH.md) §10 2026-10-26 항목과 [`POST.md`](POST.md) "상세"에 있다. 아울러 상세 썸네일을
  아래 "LCP 후보 이미지" 표대로 우선 로딩한다. web.dev는 _"LCP 이미지는 절대 lazy-load하지 마라"_
  (번역, [Optimize LCP](https://web.dev/articles/optimize-lcp))고 쓴다.
- **기대 효과(추정)**: API 시작이 `/post`는 모바일 약 0.5s·데스크톱 약 0.1s, 상세는 0.2~0.35s 앞당겨진다.
  모바일 LCP는 여전히 썸네일 다운로드(227KB PNG, 2.7~3.5s)와 폰트 바이트가 지배한다.
- 계획과 다른 후보(폰트 preload, og 썸네일 축소, 첫 로딩 JS)는 `docs/plans/2026-10-26-lcp-prefetch-font-preload.md`에 있다.

## Best Practices 77점 사례 (2026-10-26)

사용자가 평소 쓰는 Chrome(로그인 상태)의 DevTools Lighthouse 13.4.1로 운영 `/post/:id`를 재자 Best
Practices가 77점이 나왔다. 감점은 `third-party-cookies`(가중치 5)와 `inspector-issues`(가중치 1) 두 항목뿐이었다.
Lighthouse 13의 적용 대상 가중치 합이 26이라 20/26 = 77점이다.

- **원인**: og 썸네일(`src/shared/ui/atoms/link-thumbnail.tsx`)은 외부 사이트 이미지를 `<img>`로 바로 불러온다.
  그러면 브라우저가 사용자 쿠키 저장소에 이미 있던 그 사이트 쿠키를 함께 보낸다. 리포트에는 jobkorea·thevc
  배너 이미지 요청에 실린 Hotjar(`_hjSession*`)·RTB House(`__rtbh.*`) 쿠키 8개가 찍혔다.
- **CI·headless에서 재현되지 않는 이유**: 쿠키 저장소가 비어 있어 실을 쿠키가 없다. 같은 날 운영을 headless
  Lighthouse 12.6.1로 재면 96~100점이었다. 점수는 "피드에 뜬 외부 이미지 × 측정하는 사람의 쿠키 저장소"에 따라
  달라지므로, 이 감점은 어떤 자동 측정으로도 재현되지 않는다.
- **조치**: 앱 HTML 응답에 `Cross-Origin-Embedder-Policy: credentialless`를 붙인다
  (`infra/cloudfront-functions/spa-status.js`). MDN은 이 값을 _"no-cors 모드로 요청하는 교차 출처 리소스를
  CORP 헤더 없이 불러올 수 있다. 이때 요청은 자격 증명 없이 보내진다: 요청에서 쿠키를 빼고, 응답의 쿠키도
  무시한다"_(번역, [MDN COEP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy))고
  설명한다. 지원 범위는 Chrome 96·Firefox 119이고 Safari는 미지원이다
  ([MDN BCD](https://github.com/mdn/browser-compat-data/blob/main/http/headers/Cross-Origin-Embedder-Policy.json)).
  쿠키가 있어야만 이미지를 주는 사이트가 있다면 그 썸네일은 대체 아이콘으로 바뀐다.

**검증 결과 (직접 측정, 2026-10-26)** — Playwright Chromium. 외부 이미지 호스트에 더미 쿠키를 심고, 진짜
헤더를 보내는 로컬 서버로 비교했다.

| 비교                                                                                         | 헤더 없음                                   | COEP `credentialless` |
| -------------------------------------------------------------------------------------------- | ------------------------------------------- | --------------------- |
| 외부 이미지 3개 요청의 `Cookie` 헤더                                                         | 3개 모두 실림                               | 없음                  |
| Chrome 쿠키 이슈(`Audits.issueAdded`)                                                        | `WarnThirdPartyPhaseout` 3건 + SameSite 1건 | 없음                  |
| 운영을 중계한 `/post`·`/post/:id`·`/auth/login`의 API 응답·외부 이미지 로드 수·RUM·콘솔 에러 | 기준                                        | 차이 없음             |

`WarnThirdPartyPhaseout`은 Lighthouse `third-party-cookies` 감사가 세는 사유다(설치본
`lighthouse@12.6.1/core/audits/third-party-cookies.js`). Playwright `route.fulfill`로 문서 응답에 헤더를 끼워 넣는
방식은 COEP가 적용되지 않아(쿠키가 그대로 실림) 이 시험에 쓸 수 없었다. 진짜 헤더를 보내는 서버로 재야 한다.

## 자주 발생하는 문제

- **`Error: Unable to connect to Chrome`** — 이 머신에 Chrome/Chromium이 없다.
  `npx playwright install chromium`으로 설치되는 브라우저를 LHCI가 자동으로 찾지
  못하면 `CHROME_PATH` 환경변수로 직접 경로를 지정한다.
- **측정마다 점수가 크게 흔들린다** — 다른 워크트리에서 동시에 `pnpm dev`/`pnpm preview`나
  무거운 빌드를 돌리고 있지 않은지 먼저 확인한다. Lighthouse variability 문서는
  _"같은 머신에서 동시에 여러 측정을 돌리지 말라"_(번역)고 명시한다.
- **API 호출이 전부 막혀 데이터 없는 화면을 잰다(콘솔에 CSP `connect-src` 위반)** —
  `SKIP_CSP_INJECTION=1` 없이 `pnpm build`한 경우다. 로컬 `.env`의 `VITE_API_BASE_URL`은
  운영 API(`https://linksphere.click/api`, `localhost:4173`과 교차 출처)인데,
  `scripts/inject-csp.js`가 주입하는 CSP의 `connect-src`에는 이 도메인이 없어 호출이
  전부 막힌다. 로그인 필요 페이지 측정은 로그인 API부터 막힌다. CI(`ci.yml`의
  `lighthouse` job)도 같은 이유로 이 변수를 준다.
- **CORS 에러로 `/api/*` 호출이 실패한다** — Lighthouse 빌드는 운영 API
  `https://linksphere.click/api`(CloudFront 경유)를 부른다. BE CORS 허용 목록에
  `http://localhost:*`가 있어(`Access-Control-Allow-Origin: <origin>`,
  `Access-Control-Allow-Credentials: true`, 2026-10-02 curl preflight로 확인)
  `localhost:4173`에서 호출해도 정상 동작해야 한다. 그래도 막히면 BE 쪽 CORS 설정이
  바뀌었을 가능성이 높다. Lambda Function URL을 직접 부르면 OAC 잠금(2026-09-29) 이후
  CORS가 아니라 403이다.
