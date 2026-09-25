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

| 항목                 | 이전                                                      | 이후                                                                  |
| -------------------- | --------------------------------------------------------- | --------------------------------------------------------------------- |
| 방식                 | 정적 굵기별 subset 9종                                    | 가변 폰트 + unicode-range 92분할(Pretendard 공식 dynamic subset)      |
| `<link rel=preload>` | 4종, 약 1.07MB                                            | 92개 중 19개(선별), 약 480KB — 이유는 아래 "폰트 preload 유지보수" 절 |
| 실제 전송량(첫 로딩) | preload된 4종 전부(약 1.07MB), 실제 쓰는 굵기·글자와 무관 | 화면에 실제 쓰인 글자만큼만, 파일당 약 20~40KB                        |
| 외부 요청            | `fonts.googleapis.com`(Inter, 렌더 차단) + preconnect 2개 | 없음                                                                  |

**LCP 후보 이미지**

| 항목                        | 이전                                 | 이후                                       |
| --------------------------- | ------------------------------------ | ------------------------------------------ |
| 목록 첫 행(최대 3장) 썸네일 | `loading="lazy"`, 우선순위 힌트 없음 | `loading="eager"` + `fetchPriority="high"` |
| 나머지 썸네일               | `loading="lazy"`                     | 변경 없음(그대로 lazy)                     |

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
