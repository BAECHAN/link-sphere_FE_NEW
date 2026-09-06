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

### 설치

```bash
pnpm install
```

### 개발 서버 실행

```bash
pnpm dev
```

> 기본 포트: **31119** — `/api` 요청은 BE(8080)로 프록시됩니다.

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
| 기타         | Sonner, Supabase JS, dayjs, framer-motion                    |
| 개발 도구    | ESLint 9, Prettier 3, Husky, Storybook 10                    |
| 테스트       | Vitest 4, jsdom, Testing Library, MSW 2, @vitest/coverage-v8 |

## 프로젝트 구조

```
src/
├── main.tsx                    # 앱 진입점
│
├── app/                        # 앱 셸 (라우터, 프로바이더, 레이아웃, 네비게이션)
│   ├── layouts/                # AppLayout, AuthLayout, ErrorLayout, Navbar
│   ├── providers/              # QueryProvider, AuthProvider, RouterProvider, ThemeProvider
│   └── routes/                 # 라우트 정의, ProtectedRoute
│
├── domains/                    # 도메인별 비즈니스 로직 (DDD)
│   ├── auth/                   # 로그인, 회원가입
│   │   ├── _common/api/        # auth.api.ts · auth.keys.ts · auth.queries.ts
│   │   └── features/           # login/ · sign-up/
│   ├── post/                   # 게시물 + 댓글 도메인
│   │   ├── _common/api/        # post · comment · interaction (api/keys/queries)
│   │   ├── _common/model/      # post · comment · interaction (schema/types)
│   │   └── features/           # create-post · update-post · delete-post
│   │                           # post-list · post-detail
│   │                           # like-post · bookmark-post
│   │                           # comment-list · create-comment · update-comment
│   │                           # delete-comment · like-comment
│   └── member/                 # 사용자 프로필
│       └── _common/            # member.api.ts · member.schema.ts
│
├── pages/                      # 라우트 단위 페이지 컴포넌트
│   ├── auth/                   # LoginPage · SignUpPage
│   ├── post/                   # PostDetailPage · PostEditPage · PostSubmitPage
│   ├── mypage/                 # MyPage
│   ├── 403/                    # Forbidden
│   └── 404/                    # NotFound
│
└── shared/                     # 도메인 독립적인 공통 레이어
    ├── api/                    # Axios 클라이언트 (client.ts) + 공통 API
    ├── config/                 # API 엔드포인트, 라우트 경로, 텍스트 상수
    ├── hooks/                  # useDebounce · useIsMobile · useToggle 등
    ├── lib/                    # queryClient, react-table, tailwind 유틸
    ├── store/                  # Zustand 전역 스토어 (auth)
    ├── ui/
    │   ├── atoms/              # Shadcn/ui 기본 컴포넌트 (Button, Input, Dialog …)
    │   └── elements/           # 복합 컴포넌트 (Form, Modal/Alert, AsyncBoundary …)
    └── utils/                  # auth · date · file · form · storage 유틸
```

### 도메인 내 3-Layer API 패턴

```
_common/api/
├── *.api.ts       # 순수 async 함수 (React 의존 없음)
├── *.keys.ts      # 쿼리 키 팩토리 + 캐시 invalidation 핸들러
└── *.queries.ts   # useQuery / useMutation 래퍼 훅
```

### Feature 폴더 구조

```
features/<feature-name>/
├── hooks/         # 비즈니스 로직 (form, mutation, state)
└── ui/            # 얇은 UI 컴포넌트 (hook 사용)
```

## 테스트

- **1회 실행**: `pnpm test` (CI / pre-push와 동일)
- **감시 모드**: `pnpm test:watch` (TDD 루프)
- **커버리지**: `pnpm test:coverage` → `coverage/index.html`에서 확인

`git push` 시 pre-push 훅으로 테스트가 자동 실행되며, 실패 시 push가 차단됩니다. 상세한 패턴·MSW·픽스처·트러블슈팅은 [테스트 가이드](docs/TESTING.md)를 참고하세요.

## 문서

**프로젝트 전반**

- [`CHANGELOG.md`](CHANGELOG.md) — 버전별 변경 사항 (Keep a Changelog)

**독립 기능 문서(서사형)** — "지금 어떻게 동작하는가"

- [`docs/BOOKMARK.md`](docs/BOOKMARK.md) — 북마크 페이지: 폴더 분류, 반응형 3분기, 폴더 내 검색
- [`docs/CI-CHECK-GATE.md`](docs/CI-CHECK-GATE.md) — `pnpm check`가 실제로는 아무 데도 안 걸려 있던 문제와 PR·배포 게이트 정비
- [`docs/FCM-PUSH-NOTIFICATION.md`](docs/FCM-PUSH-NOTIFICATION.md) — 댓글·답글 FCM 웹 푸시: 토큰 수명주기, 서비스워커, 알림 클릭 딥링크
- [`docs/MYPAGE.md`](docs/MYPAGE.md) — 프로필 수정 모달: 닉네임·아바타 변경, 재오픈 시 입력값 복원
- [`docs/UNSAVED-CHANGES-GUARD.md`](docs/UNSAVED-CHANGES-GUARD.md) — 저장하지 않은 입력이 있을 때 페이지 이탈을 막는 전역 가드

**절차** — "이럴 땐 이렇게 한다"

- [`docs/DEPLOY.md`](docs/DEPLOY.md) — S3+CloudFront 배포 아키텍처, GitHub Actions 파이프라인, Secrets 설정
- [`docs/TESTING.md`](docs/TESTING.md) — Vitest·Testing Library·MSW로 테스트 작성/실행하는 법

**레퍼런스** — "지금 값이 뭔가"

- [`docs/FE-ARCHITECTURE.md`](docs/FE-ARCHITECTURE.md) — FSD 구조, 3-Layer API·Feature Hook 등 재사용 패턴, 네이밍 컨벤션
- [`docs/SYSTEM-ARCHITECTURE.md`](docs/SYSTEM-ARCHITECTURE.md) — 시스템 컨텍스트·배포 파이프라인·FE/BE 구조 (Mermaid)
- [`docs/VERSION-COMPATIBILITY.md`](docs/VERSION-COMPATIBILITY.md) — BE·FE 버전 호환 매트릭스
- [`docs/HISTORY.md`](docs/HISTORY.md) — 커밋 기반 변경 이력 (자동 생성, 직접 편집 금지)

**설계 결정 기록(ADR 경량판)**

- [`docs/DECISIONS.md`](docs/DECISIONS.md) — 되돌리기 어렵고 대안을 비교해 선택한 설계·UX 결정 (append-only)

> 분류 기준과 문서 작성 규칙은 [`docs/README.md`](docs/README.md) 참고.
