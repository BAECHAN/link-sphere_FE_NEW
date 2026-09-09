# Link Sphere — Frontend

React + Vite + TypeScript 기반의 링크 공유 소셜 플랫폼 프론트엔드입니다.

# Link Sphere - Backend

https://github.com/BAECHAN/link-sphere_BE_NEW

# 배포 URL

https://dbw3brui6htwk.cloudfront.net/post

## 테스트 계정

### ID

```
test_account@linksphere.com
```

### PW

```
Gk8#pW2!vN9x
```

## 시작하기

### 전제 조건

- Node 24 이상(`.nvmrc` 고정) — `nvm use`로 맞춘다. `package.json`의 `engines.node`가
  강제하므로 다른 버전이면 `pnpm install`부터 막힌다
- pnpm (버전은 `package.json`의 `packageManager` 참고)
- 루트에 `.env` 파일 필요 — 없으면 `pnpm validate`/`pnpm check:env`가 실패한다

### 설치

```bash
pnpm install
```

### 개발 서버 실행

```bash
pnpm dev
```

> 기본 포트: **31119** — `/api` 요청은 `VITE_API_BASE_URL` 환경변수(`.env`)가 가리키는
> BE로 프록시됩니다.

### 빌드

```bash
pnpm build
```

### 미리보기

```bash
pnpm preview
```

### 스토리북

```bash
pnpm storybook
```

## 개발 명령어

| 명령어               | 설명                                         |
| -------------------- | -------------------------------------------- |
| `pnpm dev`           | 로컬 개발 서버 실행 (포트 31119)             |
| `pnpm build`         | 프로덕션 빌드                                |
| `pnpm preview`       | 빌드 결과물 미리보기                         |
| `pnpm type-check`    | TypeScript 타입 검사                         |
| `pnpm lint`          | ESLint 검사                                  |
| `pnpm lint:fix`      | ESLint 자동 수정                             |
| `pnpm format`        | Prettier 포맷팅                              |
| `pnpm check`         | 타입 + 린트 + 포맷 일괄 검사                 |
| `pnpm check:fix`     | 린트·포맷 자동 수정 후 타입 검사             |
| `pnpm storybook`     | Storybook 컴포넌트 개발 서버 (6006)          |
| `pnpm test`          | 테스트 1회 실행 (CI / pre-push 동일)         |
| `pnpm test:watch`    | 테스트 감시 모드 (파일 변경 시 재실행)       |
| `pnpm test:coverage` | 커버리지 리포트 생성 (`coverage/index.html`) |

## 기술 스택

| 항목         | 기술                                                         |
| ------------ | ------------------------------------------------------------ |
| Framework    | React 18, TypeScript 5.7, Vite 6                             |
| Routing      | React Router 6                                               |
| Server State | TanStack Query 5                                             |
| Client State | Zustand 5                                                    |
| Form         | React Hook Form 7, Zod 3                                     |
| UI           | Shadcn/ui (Radix UI), TailwindCSS 4, CVA                     |
| 기타         | Sonner, Supabase JS, dayjs, framer-motion, Firebase(FCM)     |
| 개발 도구    | ESLint 9, Prettier 3, Husky, Storybook 10                    |
| 테스트       | Vitest 4, jsdom, Testing Library, MSW 2, @vitest/coverage-v8 |

## 프로젝트 구조

Feature-Sliced Design(FSD)을 뼈대로 하되 일부 규칙을 다르게 채택한 변형이다 — 상세 트리·
정식 FSD와 다른 점은 [`docs/FE-ARCHITECTURE.md`](docs/FE-ARCHITECTURE.md)가 정본이다.

레이어(하향 의존만 허용): `app → pages → widgets → features → entities → shared`

| 레이어     | 역할                                         |
| ---------- | -------------------------------------------- |
| `app`      | 라우터, 프로바이더, 앱 셸 레이아웃           |
| `pages`    | 라우트 단위 페이지 컴포넌트                  |
| `widgets`  | 복합 UI 블록 (`<도메인>/<슬라이스>/`)        |
| `features` | 사용자 상호작용 (`<도메인>/<액션>/`)         |
| `entities` | 비즈니스 엔티티 — data layer + basic display |
| `shared`   | 도메인 독립적인 공통 유틸·UI 원자·API client |

레이어에 속하지 않는 최상위 디렉터리도 있다 — `src/mocks/`(MSW), `src/test/`(Vitest 셋업),
`src/types/`(전역 타입 선언). 상세는 FE-ARCHITECTURE.md §3 참고.

### Entity 내 3-Layer API 패턴 (표준형)

```
entities/<entity>/api/
├── *.api.ts       # 순수 async 함수 (React 의존 없음)
├── *.keys.ts      # 쿼리 키 팩토리 + 캐시 invalidation 핸들러
└── *.queries.ts   # useQuery / useMutation 래퍼 훅
```

일부 엔티티는 예외다 — `interaction`은 `keys.ts` 없이 다른 엔티티의 키를 직접 쓰고,
`upload`는 `api.ts`만 있다. 상세는 FE-ARCHITECTURE.md §3·§4 참고.

### Feature 폴더 구조 (표준형)

```
features/<도메인>/<액션>/
├── hooks/         # 비즈니스 로직 (form, mutation, state)
└── ui/            # 얇은 UI 컴포넌트 (hook 사용)
```

컴포넌트가 필요 없는 슬라이스(`post/delete`, `comment/delete`)는 `hooks/`만 갖는다.

## 테스트

- **1회 실행**: `pnpm test` (CI / pre-push와 동일)
- **감시 모드**: `pnpm test:watch` (TDD 루프)
- **커버리지**: `pnpm test:coverage` → `coverage/index.html`에서 확인

`git commit` 시 pre-commit 훅으로 타입 체크 + lint-staged가, `git push` 시 pre-push 훅으로 테스트가 자동 실행되며, 실패 시 각각 커밋·push가 차단됩니다. 상세한 패턴·MSW·픽스처·트러블슈팅은 [테스트 가이드](docs/TESTING.md)를 참고하세요.

## 문서

**프로젝트 전반**

- [`CHANGELOG.md`](CHANGELOG.md) — 버전별 변경 사항 (Keep a Changelog)

**독립 기능 문서(서사형)** — "지금 어떻게 동작하는가"

- [`docs/AUTH.md`](docs/AUTH.md) — 인증·세션·토큰 갱신: 세 개의 독립된 인증 게이트, 상태 저장 위치, 401 자동 갱신
- [`docs/BOOKMARK.md`](docs/BOOKMARK.md) — 북마크 페이지: 폴더 분류, 반응형 3분기, 폴더 내 검색
- [`docs/CI-CHECK-GATE.md`](docs/CI-CHECK-GATE.md) — `pnpm check`가 실제로는 아무 데도 안 걸려 있던 문제와 PR·배포 게이트 정비
- [`docs/FCM-PUSH-NOTIFICATION.md`](docs/FCM-PUSH-NOTIFICATION.md) — 댓글·답글 FCM 웹 푸시: 토큰 수명주기, 서비스워커, 알림 클릭 딥링크
- [`docs/MYPAGE.md`](docs/MYPAGE.md) — 프로필 수정 모달: 닉네임·아바타 변경, 재오픈 시 입력값 복원
- [`docs/NEW-VERSION-RELOAD.md`](docs/NEW-VERSION-RELOAD.md) — 배포 후 새 버전 감지 시 다음 라우트 이동에 맞춰 자동 새로고침
- [`docs/SEARCH.md`](docs/SEARCH.md) — 게시글 검색: URL SSOT, 헤더 검색창 동기화, `@카테고리`·`#닉네임` 태그 분해
- [`docs/UNSAVED-CHANGES-GUARD.md`](docs/UNSAVED-CHANGES-GUARD.md) — 저장하지 않은 입력이 있을 때 페이지 이탈을 막는 전역 가드

**절차** — "이럴 땐 이렇게 한다"

- [`docs/DEPLOY.md`](docs/DEPLOY.md) — S3+CloudFront 배포 아키텍처, GitHub Actions 파이프라인, Secrets 설정
- [`docs/TESTING.md`](docs/TESTING.md) — Vitest·Testing Library·MSW로 테스트 작성/실행하는 법

**레퍼런스** — "지금 값이 뭔가"

- [`docs/FE-ARCHITECTURE.md`](docs/FE-ARCHITECTURE.md) — FSD 변형 구조(정식 FSD와 다른 점 포함), 3-Layer API·Feature Hook 등 재사용 패턴, 네이밍 컨벤션
- [`docs/SYSTEM-ARCHITECTURE.md`](docs/SYSTEM-ARCHITECTURE.md) — 시스템 컨텍스트·배포 파이프라인·FE/BE 구조 (Mermaid)
- [`docs/VERSION-COMPATIBILITY.md`](docs/VERSION-COMPATIBILITY.md) — BE·FE 버전 호환 매트릭스
- [`docs/HISTORY.md`](docs/HISTORY.md) — 커밋 기반 변경 이력 (자동 생성, 직접 편집 금지)

**설계 결정 기록(ADR 경량판)**

- [`docs/DECISIONS.md`](docs/DECISIONS.md) — 되돌리기 어렵고 대안을 비교해 선택한 설계·UX 결정 (append-only)

**작업 계획** — "무엇을 하기로 했는지"

- [`docs/plans/`](docs/plans/) — plan mode로 세운 계획의 스냅샷 (append-only, 파일마다 여기 개별 등록하지 않음)

> 문서 분류 기준과 작성 규칙은 [`.claude/CLAUDE.md`](.claude/CLAUDE.md)의 "docs/ 내부 분류" 절 참고.
