# 성능 측정 가이드

이 문서는 Lighthouse 측정을 재현하는 절차 문서(how-to)다. "왜 이 방식을 골랐는가"는
`docs/DECISIONS.md`(LHCI assertion 단계, og 이미지 파이프라인 검토), "무엇을 언제
바꿨는가"는 `docs/plans/2026-09-25-lighthouse-perf.md`(계획)와 `CHANGELOG.md`를 본다.

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
pnpm build              # dist/를 만든다 (lighthouserc.cjs가 이걸 서빙해서 잰다)
pnpm perf:lh            # 공개 페이지 4개 × 5회, 데스크톱 프리셋
```

`pnpm perf:lh`는 내부적으로 `vite preview --port 4173 --strictPort`로 서버를 직접
띄웠다 끄므로, 미리 `pnpm preview`를 따로 실행해둘 필요는 없다(포트가 이미 쓰이고
있으면 `--strictPort` 때문에 명확히 실패한다).

측정이 끝나면 각 URL·실행마다의 리포트 링크가 콘솔에 출력된다
(`upload.target: 'temporary-public-storage'` — 며칠 후 자동 삭제되는 임시 링크다).

## 측정 URL

| 분류        | URL                                         | 설정 파일               |
| ----------- | ------------------------------------------- | ----------------------- |
| 공개        | `/post`, `/auth/login`, `/auth/sign-up`     | `lighthouserc.cjs`      |
| 로그인 필요 | `/post/submit`, `/bookmark`, `/my/comments` | `lighthouserc.auth.cjs` |

`/post/:id`, `/post/edit/:id`처럼 특정 게시글 ID가 필요한 페이지는 뺐다 — 테스트
계정이 소유한, 항상 존재가 보장된 고정 ID를 만들어주는 시드 데이터가 없어서다
(`lighthouserc.auth.cjs` 상단 주석 참고).

## 로그인 필요 페이지 측정

```bash
export LH_TEST_PASSWORD='...'   # 대화로만 받고 파일에 남기지 않는다
pnpm build
pnpm perf:lh:auth
```

- 테스트 계정은 `tester_new_999@example.com`을 쓴다. README `## 테스트 계정`의
  계정(수동 QA용, 실사용자 데이터 있음)이 아니다 — 이유는
  `docs/TESTING.md`의 "로그인 계정" 절과 같다.
- 로그인은 `scripts/lighthouse-login.js`(LHCI의 `puppeteerScript`)가 자동으로 한다.
  이미 로그인 상태(`has-session` 쿠키가 살아있는 상태로 재실행)면 조용히 건너뛴다.
- `disableStorageReset: true`로 5회 실행 내내 세션 쿠키를 유지한다 — 꺼두면 매
  실행마다 `/auth/refresh`를 한 번씩 더 타서 순수 페이지 성능과 무관한 지연이 섞인다.

## 프로덕션 재측정

배포 후 실제 체감 성능을 확인할 때는 프로덕션 URL을 직접 넘긴다(로컬 설정 파일을
쓰지 않는다 — `startServerCommand`가 로컬 빌드를 서빙하는 용도라 프로덕션에는 안 맞는다):

```bash
npx lhci collect --url=https://dbw3brui6htwk.cloudfront.net/post \
  --numberOfRuns=5 --preset=desktop
```

모바일(느린 4G) 프리셋으로 재려면 [PageSpeed Insights](https://pagespeed.web.dev/)를
직접 쓰는 편이 더 간단하다 — Lighthouse 코어와 같은 엔진이고 모바일 스로틀링·CrUX
필드 데이터 유무까지 한 화면에서 보여준다.

## CI 게이트

`.github/workflows/ci.yml`의 `lighthouse` job이 PR마다 공개 페이지 4개를 측정해
`warn` 리포트를 artifact로 남긴다. 로그인 필요 페이지는 CI에 없다 — 테스트 계정
비밀번호를 GitHub Actions secret으로 등록하는 별도 절차가 필요해 이번 범위에 넣지
않았다(추가하려면 `LH_TEST_PASSWORD`를 레포 secret으로 등록하고 `lighthouserc.auth.cjs`
로 job을 하나 더 두면 된다).

## 실측 결과

| 시점                | 대상                              | Performance | LCP  | FCP  | Speed Index | CLS   | 비고                                            |
| ------------------- | --------------------------------- | ----------- | ---- | ---- | ----------- | ----- | ----------------------------------------------- |
| 2026-09-25(개선 전) | 프로덕션 `/post`, 데스크톱        | —           | 2.3s | 0.9s | 2.9s        | —     | 사용자 제공 Lighthouse 13.4.1 리포트(일부 잘림) |
| 2026-09-26(개선 전) | 프로덕션 `/post`, 모바일(느린 4G) | 65          | 9.4s | 2.6s | 6.2s        | 0.062 | PageSpeed Insights 실측                         |
| _배포 후 채울 것_   | 프로덕션 `/post`, 데스크톱+모바일 |             |      |      |             |       |                                                 |

배포 전 로컬 A/B 결과는 `docs/plans/2026-09-25-lighthouse-perf.md`의 "계획 대비 구현"에
남긴다(PR 본문에서 링크).

## 자주 발생하는 문제

- **`Error: Unable to connect to Chrome`** — 이 머신에 Chrome/Chromium이 없다.
  `npx playwright install chromium`으로 설치되는 브라우저를 LHCI가 자동으로 찾지
  못하면 `CHROME_PATH` 환경변수로 직접 경로를 지정한다.
- **측정마다 점수가 크게 흔들린다** — 다른 워크트리에서 동시에 `pnpm dev`/`pnpm preview`나
  무거운 빌드를 돌리고 있지 않은지 먼저 확인한다. Lighthouse variability 문서는
  _"같은 머신에서 동시에 여러 측정을 돌리지 말라"_(번역)고 명시한다.
- **CORS 에러로 `/api/*` 호출이 실패한다** — 이 레포의 BE(Lambda Function URL)는
  요청 Origin을 그대로 반사하는 CORS 설정이라(`Access-Control-Allow-Origin: <origin>`,
  `Access-Control-Allow-Credentials: true`, 2026-09-26 직접 curl로 확인)
  `localhost:4173`을 포함해 어떤 로컬 포트에서 호출해도 정상 동작해야 한다. 그래도
  막히면 BE 쪽 CORS 설정이 바뀌었을 가능성이 높다.
