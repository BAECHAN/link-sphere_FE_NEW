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

### 코드 변경 전후 비교 (직접 측정, 2026-09-26)

`pnpm build` 결과물(`dist/`, `dist/stats.html`)을 이 PR의 각 커밋 전후로 직접 비교해서 잰
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
| 진입 청크(`index-*.js`)        | 105.52 KB                | 101.45 KB                                        | `LoginModal`을 정적 렌더에서 뺐다                                                               |

**폰트 로딩**

| 항목                 | 이전                                                      | 이후                                                             |
| -------------------- | --------------------------------------------------------- | ---------------------------------------------------------------- |
| 방식                 | 정적 굵기별 subset 9종                                    | 가변 폰트 + unicode-range 92분할(Pretendard 공식 dynamic subset) |
| `<link rel=preload>` | 4종, 약 1.07MB                                            | 없음                                                             |
| 실제 전송량(첫 로딩) | preload된 4종 전부(약 1.07MB), 실제 쓰는 굵기·글자와 무관 | 화면에 실제 쓰인 글자만큼만, 파일당 약 20~40KB                   |
| 외부 요청            | `fonts.googleapis.com`(Inter, 렌더 차단) + preconnect 2개 | 없음                                                             |

**LCP 후보 이미지**

| 항목                        | 이전                                 | 이후                                       |
| --------------------------- | ------------------------------------ | ------------------------------------------ |
| 목록 첫 행(최대 3장) 썸네일 | `loading="lazy"`, 우선순위 힌트 없음 | `loading="eager"` + `fetchPriority="high"` |
| 나머지 썸네일               | `loading="lazy"`                     | 변경 없음(그대로 lazy)                     |

### Lighthouse 지표

| 시점                | 대상                              | Performance | LCP  | FCP  | Speed Index | CLS   | 비고                                            |
| ------------------- | --------------------------------- | ----------- | ---- | ---- | ----------- | ----- | ----------------------------------------------- |
| 2026-09-25(개선 전) | 프로덕션 `/post`, 데스크톱        | —           | 2.3s | 0.9s | 2.9s        | —     | 사용자 제공 Lighthouse 13.4.1 리포트(일부 잘림) |
| 2026-09-26(개선 전) | 프로덕션 `/post`, 모바일(느린 4G) | 65          | 9.4s | 2.6s | 6.2s        | 0.062 | PageSpeed Insights 실측                         |
| _배포 후 채울 것_   | 프로덕션 `/post`, 데스크톱+모바일 |             |      |      |             |       |                                                 |

위 "코드 변경 전후 비교"는 이 지표들이 왜 바뀔 것으로 기대하는지의 근거다 — 로컬 빌드
산출물 크기 비교이지 랩/필드 성능 지표 자체는 아니다. 배포 후 이 표를 채워야 실제
효과가 확정된다. 계획 대비 구현 전체 대조는 `docs/plans/2026-09-25-lighthouse-perf.md`와
PR 본문의 "계획 대비 구현"을 본다.

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
