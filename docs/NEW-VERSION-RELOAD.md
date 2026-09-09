# 새 배포 자동 새로고침 (New Version Reload)

> **문서 성격**: 독립 기능 문서(서사형)
>
> **대상 독자**: 이 레포 FE를 처음 보거나 오랜만에 돌아온 개발자.
>
> **읽고 나면**: 배포 후 열려 있던 탭이 왜·언제 자동으로 새로고침되는지, 스로틀·루프
> 가드가 무엇을 막는지 알고, 감지 주기나 판정 조건을 바꿀 수 있다.
>
> **마지막 검토**: 2026-09-09

배포 직후에도 이미 열려 있던 탭은 계속 구 버전 JS 번들을 쓴다. 이 기능은 탭이
포커스를 받을 때마다 서버의 최신 `index.html`을 확인해 새 배포 여부를 판단하고,
감지되면 사용자가 **다음에 실제로 페이지를 이동하는 시점**에 맞춰 조용히 전체
새로고침한다 — 지금 보고 있는 화면은 건드리지 않는다.

## 1. 쉬운 설명

탭을 오래 켜두고 쓰는 사람 입장에서 상상해보자. 배포는 CloudFront/S3에 새 파일을
올리는 것뿐이라, 이미 열려 있던 탭은 그 사실을 알 방법이 없다 — **우편함 비유**를
쓰면, 새 우편함(새 `index.html`)이 이미 설치됐어도 손에 든 옛날 주소록(브라우저
메모리의 구 JS)으로는 그 사실을 모른다.

그래서 이 기능은 두 가지 별개의 역할로 나눠 푼다.

- **감지(`useAppVersionCheck`)**: 탭에 포커스가 돌아올 때마다 우편함에 직접
  가서("서버의 `index.html`을 다시 받아서") 주소록이 최신인지 확인한다. 다르면
  "새 우편함이 왔다"는 메모만 남기고 아무것도 하지 않는다 — 화면엔 아무 표시도
  없다.
- **적용(`useNewVersionReload`)**: 그 메모가 남아 있는 상태에서 사용자가 실제로
  다른 페이지로 이동하려 하면, 그 이동을 "새로고침"으로 바꿔치기한다. 지금 읽던
  화면은 그대로 두고, **다음 행선지로 갈 때만** 새 건물(새 배포)로 데려간다.

두 역할을 분리한 이유는 "감지했다고 바로 화면을 뺏으면 안 된다"는 원칙 때문이다.
글을 쓰던 중에 갑자기 새로고침되면 그 자체가 사고다 — 그래서 감지와 적용 사이에
반드시 "사용자가 스스로 다른 곳으로 가려 한 시점"이 끼어야 한다.

```mermaid
flowchart TD
  Focus["탭 포커스 획득"] --> Dev{"DEV 모드?"}
  Dev -->|예| Skip1["아무 것도 안 함<br/>(entry script 비교 무의미)"]
  Dev -->|아니오| Throttle{"마지막 확인 후<br/>5분 지났나?"}
  Throttle -->|아니오| Skip2["무시"]
  Throttle -->|예| Fetch["GET /index.html<br/>(cache: no-store)"]
  Fetch -->|실패/파싱 실패| Skip3["조용히 무시"]
  Fetch -->|성공| Compare{"배포된 entry script src ==<br/>현재 문서의 src?"}
  Compare -->|같음| Skip4["무시 (최신 상태)"]
  Compare -->|다름| LoopGuard{"이미 같은 값으로<br/>감지한 적 있나?<br/>(sessionStorage)"}
  LoopGuard -->|예| Skip5["무시 (재감지·재로드 루프 방지)"]
  LoopGuard -->|아니오| Mark["sessionStorage 기록 +<br/>zustand: detectedAtPathname = 현재 pathname"]
  Mark --> WaitNav["사용자가 스스로<br/>다른 라우트로 이동할 때까지 대기"]
  WaitNav --> RouteChange{"pathname이<br/>실제로 바뀌었나?"}
  RouteChange -->|아니오<br/>(같은 페이지 내 이동)| Stay["리로드 안 함"]
  RouteChange -->|예| Reload["SpinnerOverlay 렌더 +<br/>window.location.reload()"]
  Reload --> Fresh["새 index.html + 새 청크로<br/>목적지 페이지를 새로 연다"]
```

## 2. 전제 지식

Zustand 기본 개념과 React Router의 `useLocation`/`useBlocker`를 안다고 가정한다.
[UNSAVED-CHANGES-GUARD.md](./UNSAVED-CHANGES-GUARD.md)를 먼저 읽으면 "왜 useBlocker로
가로채지 않고 라우트 이동 후에 판단하는가"(§5)의 배경(react-router가 blocker를
하나만 허용하는 제약)을 더 빨리 이해할 수 있다 — 이 기능이 그 제약을 그대로
물려받아 같은 결론(단일 blocker 슬롯을 이미 그 가드가 쓰고 있으므로 이쪽은
이동 후 판단으로 우회)에 도달했다.

가정하지 않는 것: Vite가 빌드 시 entry script 파일명에 콘텐츠 해시를 붙이는
동작 원리 — §3에서 그 사실만 이용할 뿐 Vite 내부 구현은 다루지 않는다.

## 3. 사용한 도구·기술

**기능 자체를 이루는 것**

- **Zustand** — 감지 결과(`detectedAtPathname`)를 감지 훅과 적용 훅 사이에 전달하는
  다리 역할의 스토어. `persist` 미들웨어를 붙이지 않는다 — 리로드하면 플래그가
  사라져야 같은 판단이 반복되지 않는다(§6)
- **`fetch('/index.html', { cache: 'no-store' })` + `DOMParser`** — 서버의 최신
  `index.html`을 강제로 재요청하고, 실행 컨텍스트 없이 파싱만 해서 entry script
  경로를 뽑는다(§5)
- **`sessionStorage`** — 같은 값으로 이미 한 번 감지했는지 기록하는 루프 가드(§7)
- **React Router `useLocation`** — 적용 시점을 pathname 변경으로 판정한다(§5)

**구현·검증 과정에서 쓴 도구**

- **MSW(`src/mocks/server.ts`)** — `GET /index.html` 응답을 픽스처로 가로채 감지
  로직을 테스트
- **Vitest `vi.useFakeTimers({ toFake: ['Date'] })`** — 스로틀 타이밍만 페이크하고
  `setTimeout`은 실시간으로 남겨 MSW 네트워크 응답·`vi.waitFor` 폴링과 충돌하지
  않게 함

## 4. 왜 만들었나

배포 후 구 번들을 계속 쓰는 문제에 대해 이 레포엔 이미 사후 대응 하나가 있다 —
`AppErrorFallback`이 청크 로드 실패(`ChunkLoadError`류 에러 메시지)를 잡아 세션당
한 번 자동 새로고침한다(`shared/utils/error.util.ts`의 `isChunkLoadError`,
`shared/config/storage-keys.ts`의 `chunkReloadKey`). 하지만 이건 **사용자가 실제로
삭제된 구 청크를 요청해서 에러가 나야만** 발동한다 — 지연 로드되는 라우트로
이동하기 전까지는 감지되지 않고, 그마저도 "에러 화면을 잠깐 스쳐 지나가는" 경험이다.

이 기능은 그 앞 단계를 채운다 — 에러가 나기 전에 미리 알아채서, 사용자가 다음에
스스로 페이지를 이동하는 순간에 자연스럽게 최신 상태로 옮겨준다. 두 메커니즘은
서로 대체하지 않고 공존한다: 이 기능이 대부분의 경우를 먼저 잡아내고,
`AppErrorFallback`은 그래도 놓친 경우(예: 감지 전에 바로 청크가 삭제된 경우)의
안전망으로 남는다.

## 5. 구조

### 감지와 적용이 분리된 이유

`useBlocker`로 라우트 이동 자체를 가로채 그 시점에 리로드하지 않는다 —
[UNSAVED-CHANGES-GUARD.md](./UNSAVED-CHANGES-GUARD.md)가 이미 쓰고 있는 유일한
blocker 슬롯을 두 번째로 등록하면 react-router가 뒤에 등록된 것만 남기고 앞
가드를 조용히 무력화한다. 그래서 이동을 막는 대신, **이동이 이미 끝난 뒤**(다음
렌더에서 `location.pathname`이 바뀐 것을 확인한 뒤) 판단한다 — 이 시점엔
react-router가 history를 이미 목적지로 밀어둔 상태라, `reload()`가 목적지
페이지를 그대로 다시 연다(`assign()`과 달리 히스토리 항목이 늘지 않아 뒤로가기가
정상 동작한다).

이 순서 덕에 [UNSAVED-CHANGES-GUARD.md](./UNSAVED-CHANGES-GUARD.md)의 폼 이탈
가드와 자연스럽게 공존한다 — 사용자가 작성 중인 폼이 있는 상태로 이동을 시도하면
그 가드가 먼저 이동 자체를 막아(pathname이 아직 안 바뀜) 이 기능은 아무 판단도
하지 않는다. "나가기"를 확정해 실제로 pathname이 바뀐 뒤에야 리로드가 걸린다.

### 감지 판정 순서 (`useAppVersionCheck`)

§1 순서도의 왼쪽 절반. `RootLayout`에서 앱 전체에 1곳만 마운트된다.

1. **DEV 모드면 아무것도 안 한다.** dev 서버 진입 스크립트는 `/src/main.tsx`
   고정이라 비교 자체가 무의미하다.
2. **윈도우 `focus` 이벤트마다** 마지막 확인 이후 5분(`VERSION_CHECK_THROTTLE_MS`)이
   안 지났으면 무시한다. 마운트 시각을 "마지막 확인 시각"의 초깃값으로 쓴다 — 부팅
   자체가 방금 최신 `index.html`을 받아온 시점이라, 마운트 직후 첫 focus까지
   재확인할 필요는 없다.
3. 스로틀을 통과하면 `/index.html`을 `cache: 'no-store'`로 다시 받아 entry script
   경로를 비교한다(§3의 `VersionUtil`). 네트워크 실패·비정상 응답·파싱 실패는 전부
   조용히 무시(다음 focus에서 재시도).
4. 경로가 같으면(최신 상태) 아무 것도 안 한다.
5. 다르면, `sessionStorage`에 **같은 값**이 이미 기록돼 있는지 먼저 확인한다(§7의
   루프 가드) — CloudFront 엣지가 잠깐 옛 `index.html`을 돌려주다가 다시 새
   버전으로 바뀌는 짧은 전파 지연 구간에서, 매 focus마다 감지 → 리로드 →
   재감지가 반복되는 걸 막는다.
6. 새로운 값이면 `sessionStorage`에 기록하고, zustand 스토어에
   `detectedAtPathname`을 **현재 pathname**으로 세운다.

### 적용 판정 (`useNewVersionReload`)

§1 순서도의 오른쪽 절반. `detectedAtPathname`이 null이 아니고, 지금
`location.pathname`이 그 값과 달라졌으면(=감지 이후 실제로 다른 페이지로
이동했으면) `window.location.reload()`를 호출하고 `true`를 반환한다. 호출부
(`RootLayout`)는 이 반환값이 `true`인 동안 `Outlet` 대신
`SpinnerOverlay`(전체 화면)를 렌더한다 — 구 빌드가 목적지 페이지의 청크·쿼리를
그리기 시작하면 새로고침으로 어차피 버려질 작업이라, 애초에 시작시키지 않는다
(`AppErrorFallback`의 청크 에러 처리와 같은 형태).

**pathname만 비교하고 쿼리스트링은 무시한다** — 북마크 페이지의 폴더 전환처럼
쿼리만 바뀌는 이동까지 리로드로 잡으면 과도하다. `UNSAVED-CHANGES-GUARD`가 같은
이유로 쓰는 규칙과 맞췄다.

## 6. 상태 모델

### `useAppVersionStore`(`src/shared/store/appVersion.store.ts`)

| 필드/함수                          | 타입                         | 역할                                                     |
| ---------------------------------- | ---------------------------- | -------------------------------------------------------- |
| `detectedAtPathname`               | `string \| null`             | 새 배포를 감지한 시점의 pathname. `null`이면 미감지 상태 |
| `markNewVersionDetected(pathname)` | `(pathname: string) => void` | 감지 시점 pathname을 기록                                |

`persist` 없음 — 리로드되면 스토어가 초기화되어 같은 판단이 반복되지 않는다.

## 7. 운영 파라미터

| 값                                   | 위치                                                                    | 의미                          |
| ------------------------------------ | ----------------------------------------------------------------------- | ----------------------------- |
| `VERSION_CHECK_THROTTLE_MS`(5분)     | [useAppVersionCheck.ts:9](../src/shared/hooks/useAppVersionCheck.ts#L9) | 재확인 최소 간격              |
| `STORAGE_KEYS.VERSION.LAST_DETECTED` | [storage-keys.ts:27-30](../src/shared/config/storage-keys.ts#L27-L30)   | 루프 가드용 sessionStorage 키 |

## 8. 코드 지도와 자주 하는 수정

```
src/
├── shared/
│   ├── store/
│   │   └── appVersion.store.ts        # §6 — 감지 플래그(Zustand, persist 없음)
│   ├── hooks/
│   │   ├── useAppVersionCheck.ts      # §5 — 감지(포커스 시 index.html 재확인)
│   │   └── useNewVersionReload.ts     # §5 — 적용(라우트 이동 시 리로드)
│   ├── utils/
│   │   └── version.util.ts            # §3 — entry script src 추출·비교
│   └── config/
│       └── storage-keys.ts            # §7 — VERSION.LAST_DETECTED 키
└── app/routes/layouts/RootLayout.tsx  # 두 훅의 유일한 마운트 지점
```

### 자주 하는 수정

| 하고 싶은 것                         | 방법                                                                                                                                                                                          |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 재확인 주기 변경                     | `useAppVersionCheck.ts`의 `VERSION_CHECK_THROTTLE_MS`                                                                                                                                         |
| 포커스 대신 폴링(setInterval)로 전환 | `useAppVersionCheck.ts`의 `checkDeployedVersionOnFocus` — 단, [useWindowFocusManager.ts](../src/shared/hooks/useWindowFocusManager.ts)와 같은 포커스 구독 방식이 이 레포의 기존 선례임을 감안 |
| 리로드 시 보여줄 화면 변경           | `RootLayout.tsx`의 `isReloadingForNewVersion` 분기 — 현재 `SpinnerOverlay`                                                                                                                    |
| entry script 판정 방식 변경          | `version.util.ts`의 `ENTRY_SCRIPT_SELECTOR`·`readEntryScriptSrc`                                                                                                                              |

## 9. 검증 결과

`useAppVersionCheck.test.ts`(7개)·`useNewVersionReload.test.tsx`(4개)·
`version.util.test.ts`(8개) 전체 통과. 저장소 전체 테스트(`pnpm test`, 50개 파일·
333개 테스트)·`pnpm type-check`·`pnpm lint` 모두 통과 상태에서 이 문서를 작성했다.
실제 배포 환경(CloudFront)에서의 전파 지연 구간 동작은 별도로 실측하지 않았다 —
루프 가드(§5의 5번)는 그 구간에서 재감지가 반복되지 않는지에 대한 설계상 방어이지,
실측으로 확인한 수치는 아니다.

## 10. 시행착오

이 문서 작성 시점까지 이 기능 자체에서 겪은 별도 버그 기록은 없다 — 처음부터
`AppErrorFallback`의 청크 에러 처리(§4)와
[UNSAVED-CHANGES-GUARD.md](./UNSAVED-CHANGES-GUARD.md)의 단일 blocker 제약(§5)이라는
두 기존 제약을 알고 시작한 설계였다.

## 11. 남은 것

- 실제 프로덕션 배포에서 감지→리로드까지 걸리는 실측 시나리오는 아직 검증하지
  않았다.

## 12. 용어 사전

- **entry script** — Vite가 `index.html`에 심는 `<script type="module">` 태그.
  빌드마다 파일명에 콘텐츠 해시가 붙어(`/assets/js/index-<hash>.js`), 이 경로
  자체가 "지금 이 빌드가 최신인가"의 판정 기준이 된다(§3)
- **감지(detect)** — `useAppVersionCheck`가 서버 `index.html`을 재확인해 새 배포
  여부를 스토어에 플래그로 남기는 것. 화면에는 아무 영향이 없다(§5)
- **적용(apply)** — `useNewVersionReload`가 감지된 플래그를 실제 새로고침으로
  이어가는 것(§5)
- **루프 가드** — 같은 감지 값으로 반복 리로드되는 것을 막는
  `sessionStorage` 기록(§5, §7)

## 13. 관련 문서

- [UNSAVED-CHANGES-GUARD.md](./UNSAVED-CHANGES-GUARD.md) — 이 기능이 그대로 물려받은
  "라우트 이동 후에 판단" 설계와 단일 blocker 제약의 원출처
- [DEPLOY.md](./DEPLOY.md) — 이 기능이 보완하는 CloudFront 배포·캐시 무효화 파이프라인
