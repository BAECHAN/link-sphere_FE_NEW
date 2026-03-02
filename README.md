# Link Sphere — Frontend

React + Vite + TypeScript 기반의 링크 공유 소셜 플랫폼 프론트엔드입니다.

## 시작하기

### 설치

```bash
pnpm install
```

### 개발 서버 실행

```bash
pnpm dev
```

> 기본 포트: **31119** — `/api` 요청은 BE(51119)로 프록시됩니다.

### 빌드

```bash
pnpm build
```

### 미리보기

```bash
pnpm preview
```

## 개발 명령어

| 명령어            | 설명                                |
| ----------------- | ----------------------------------- |
| `pnpm dev`        | 로컬 개발 서버 실행 (포트 31119)    |
| `pnpm build`      | 프로덕션 빌드                       |
| `pnpm preview`    | 빌드 결과물 미리보기                |
| `pnpm type-check` | TypeScript 타입 검사                |
| `pnpm lint`       | ESLint 검사                         |
| `pnpm lint:fix`   | ESLint 자동 수정                    |
| `pnpm format`     | Prettier 포맷팅                     |
| `pnpm check`      | 타입 + 린트 + 포맷 일괄 검사        |
| `pnpm check:fix`  | 린트·포맷 자동 수정 후 타입 검사    |
| `pnpm storybook`  | Storybook 컴포넌트 개발 서버 (6006) |

## 기술 스택

| 항목         | 기술                                      |
| ------------ | ----------------------------------------- |
| Framework    | React 18, TypeScript 5.7, Vite 6          |
| Routing      | React Router 6                            |
| Server State | TanStack Query 5                          |
| Client State | Zustand 5                                 |
| Form         | React Hook Form 7, Zod 3                  |
| UI           | Shadcn/ui (Radix UI), TailwindCSS 4, CVA  |
| 기타         | Sonner, Supabase JS, dayjs, framer-motion |
| 개발 도구    | ESLint 9, Prettier 3, Husky, Storybook 10 |

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

## 문서

- [FE 아키텍처](docs/FE-ARCHITECTURE.md) — 프론트엔드 앱 구조·패턴
- [시스템 아키텍처](docs/SYSTEM-ARCHITECTURE.md) — 전체 시스템·배포·다이어그램
- [배포 가이드](docs/DEPLOY.md)
- [개발 이력](docs/HISTORY.md)
