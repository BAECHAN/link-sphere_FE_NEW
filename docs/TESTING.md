# 테스트 가이드

> Link-Sphere FE 테스트 환경 사용 방법

## 목차

1. [스택 개요](#스택-개요)
2. [빠른 시작](#빠른-시작)
3. [테스트 파일 위치 규칙](#테스트-파일-위치-규칙)
4. [무엇에 테스트를 쓰는가 (테스트 범위 기준)](#무엇에-테스트를-쓰는가-테스트-범위-기준)
5. [패턴 A — 유틸 함수 테스트](#패턴-a--유틸-함수-테스트)
6. [패턴 B — Zod 스키마 테스트](#패턴-b--zod-스키마-테스트)
7. [패턴 C — 커스텀 훅 테스트](#패턴-c--커스텀-훅-테스트)
8. [패턴 D — 컴포넌트 테스트](#패턴-d--컴포넌트-테스트)
9. [MSW 핸들러 추가 및 오버라이드](#msw-핸들러-추가-및-오버라이드)
10. [픽스처 추가](#픽스처-추가)
11. [테스트 강제 실행 (pre-push / CI)](#테스트-강제-실행)
12. [커버리지 리포트](#커버리지-리포트)
13. [자주 발생하는 문제](#자주-발생하는-문제)
14. [브라우저 수동 테스트 — DevTools 기기 에뮬레이션 주의사항](#브라우저-수동-테스트--devtools-기기-에뮬레이션-주의사항)

---

## 스택 개요

| 역할          | 도구                                                                                    |
| ------------- | --------------------------------------------------------------------------------------- |
| 테스트 러너   | [Vitest](https://vitest.dev/) 4.x                                                       |
| DOM 환경      | jsdom                                                                                   |
| 컴포넌트 렌더 | [@testing-library/react](https://testing-library.com/docs/react-testing-library/intro/) |
| 사용자 이벤트 | [@testing-library/user-event](https://testing-library.com/docs/user-event/intro/)       |
| API 모킹      | [MSW](https://mswjs.io/) 2.x (Mock Service Worker)                                      |
| DOM 매처      | [@testing-library/jest-dom](https://github.com/testing-library/jest-dom)                |
| 커버리지      | @vitest/coverage-v8                                                                     |

```
테스트 요청
    │
    ▼
Vitest (테스트 러너)
    │
    ├─ jsdom (DOM 시뮬레이션)
    │
    ├─ @testing-library/react (컴포넌트 렌더/쿼리)
    │
    └─ MSW (fetch 인터셉트) ──→ src/mocks/handlers/ (가짜 응답)
```

**API URL 처리 방식**

Vitest 실행 시 `import.meta.env.MODE === 'test'`이므로 `.env.test`가 로드됩니다.

```
.env.test: VITE_API_BASE_URL=http://localhost
↓
shared/config/api.ts: API_BASE_URL = "http://localhost"
↓
fetch("http://localhost/post") → MSW가 인터셉트 → 가짜 응답 반환
```

---

## 빠른 시작

```bash
# 개발 중 — 파일 변경 시 자동 재실행 (TDD 루프)
npm run test:watch

# 전체 1회 실행 (CI/pre-push와 동일)
npm run test

# 커버리지 리포트 생성
npm run test:coverage
# → coverage/index.html 에서 시각적 확인 가능
```

---

## 테스트 파일 위치 규칙

소스 파일과 **같은 폴더**에 `.test.ts` / `.test.tsx` 파일을 위치시킵니다.

```
src/
├── shared/utils/
│   ├── date.util.ts
│   └── date.util.test.ts          ← 유틸 테스트
├── entities/post/model/
│   ├── post.schema.ts
│   └── post.schema.test.ts        ← 스키마 테스트
└── features/post/update/
    ├── hooks/
    │   ├── useUpdatePost.ts
    │   └── useUpdatePost.test.tsx  ← 훅 테스트
    └── ui/
        ├── UpdatePostForm.tsx      ← 이 파일엔 테스트가 없다(아래 "무엇에
        └── ...                      테스트를 쓰는가" 참고) — 위치 규칙만 보여주는
                                      예시일 뿐, 모든 파일에 짝이 있다는 뜻이 아니다
```

(2026-09-08 정정: 이전엔 `useCreatePost.test.tsx`·`CreatePostForm.test.tsx`를 예시로
들었으나 둘 다 실제로 존재하지 않는 파일이었다 — 이 문서가 자기 레포에 없는 파일을
규범 예시로 쓰고 있었다.)

---

## 무엇에 테스트를 쓰는가 (테스트 범위 기준)

**이 레포는 커버리지 목표를 두지 않는다.** `vitest.config.ts`에 coverage threshold가
없고, pre-push/CI는 "기존 테스트가 통과하는가"만 확인하며, 스캐폴딩 커맨드
(`/new-feature`, `/add-entity-api` 등)에도 테스트 파일 생성 스텝이 없다. 2026-09-08
실측(features/widgets/entities 95개 파일 중 20개, 21%) 당시엔 파일 크기·분기 수·훅
vs 컴포넌트 등 코드 성질로는 그 21%의 경계선이 설명되지 않았다(가장 크고 복잡한
컴포넌트 다수가 테스트 없음, 반대로 40~60줄 얇은 파일에 테스트가 있는 경우가 많음).

**실제로 작동하는 기준은 두 가지다.** 하나는 사후적(`.claude/CLAUDE.md`의 "버그 수정
→ 재현 테스트를 작성한다"), 하나는 사전적(고위험 공백 선별)이다. 테스트가 있는
파일은 대부분 다음 중 하나다:

1. 실제 버그 리포트를 받은 파일(회귀 방지) — 예: `useUpdatePost.test.tsx`는
   "링크 수정 화면 진입 시 관심 분야가 초기화되는" 버그를 고치며 추가됐다.
2. React Query 캐시 무효화·낙관적 업데이트가 얽힌 `*.queries.ts` — 조용히 깨지기
   쉬운 영역이라 entities의 `*.queries.ts` 5개(`post`·`comment`·`folder`·
   `interaction`·`auth`)는 전부 테스트를 갖고 있다.
3. Zod 스키마 — BE 응답 계약이 깨지면 파싱 단계에서 조용히 실패하기 쉽다.
4. **순수 함수와 인증·권한 경로** — 버그가 나기 전에 붙이는 사전적 기준. 순수
   함수는 입출력만으로 케이스를 다 나열할 수 있어 비용 대비 가치가 높고(예:
   `search-parser.test.ts`, `auth.util.test.ts`), 인증·권한 경로는 깨지면 권한
   누출이나 화면이 영원히 멈추는 형태로 나타나 회귀가 나기 전에 잡는 편이
   싸다(예: `ProtectedRoute.test.tsx`). 다만 **실사용처가 0곳이거나 거의 없는
   유틸에는 붙이지 않는다** — `common.util.ts`는 메서드 24개 중 실사용이
   `emptyStringToNull` 1개뿐이라 테스트 대상에서 제외했다(2026-09-08 조사). 죽은
   코드에 테스트를 붙이면 나중에 지우기만 더 어려워진다.

**따라서 새 컴포넌트/훅을 만들었는데 테스트가 없어도 그 자체로는 이 레포의 관례
위반이 아니다.** 반대로, 로직을 리팩터로 다른 훅에 옮길 때 원래 있던 테스트를
그 훅까지 따라가게 할지는 명시적으로 판단해야 한다 — 이 레포에서 로직 분리 시
테스트가 껍데기 컴포넌트에만 남고 새 훅엔 안 생긴 사례가 실제로 있었다(2026-09-08
`refactor(bookmark): 폴더 고르기 3형제 로직 분리` — `FolderSelector.test.tsx`는
"무수정 유지"됐지만 새로 뽑힌 훅 3개엔 테스트가 안 생겼다). 리팩터 후 테스트가
UI 껍데기에서 로직을 얼마나 실질적으로 커버하는지 스스로 확인하는 습관이,
지금 이 레포에서 유일하게 이 공백을 메우는 방법이다.

---

## 패턴 A — 유틸 함수 테스트

순수 함수는 MSW나 React 없이 가장 단순하게 테스트합니다.

<!-- check-docs-ignore: 새로 만들 파일의 예시 경로, 아직 존재하지 않음 -->

```typescript
// src/shared/utils/my-util.test.ts
import { describe, expect, it } from 'vitest';
import { MyUtil } from './my-util';

describe('MyUtil.someMethod', () => {
  it('기대하는 결과를 반환한다', () => {
    expect(MyUtil.someMethod('input')).toBe('expected output');
  });

  it('엣지 케이스를 처리한다', () => {
    expect(MyUtil.someMethod('')).toBe('');
    expect(MyUtil.someMethod(null)).toBeNull();
  });
});
```

**시간에 의존하는 함수**는 가짜 타이머를 사용합니다.

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('시간 의존 테스트', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-03-01T12:00:00.000Z')); // 기준 시간 고정
  });

  afterEach(() => {
    vi.useRealTimers(); // 반드시 복원
  });

  it('"방금 전"을 반환한다', () => {
    const thirtySecondsAgo = new Date('2025-03-01T11:59:30.000Z');
    expect(DateUtil.formatRelativeShort(thirtySecondsAgo)).toBe('방금 전');
  });
});
```

---

## 패턴 B — Zod 스키마 테스트

`safeParse()`로 유효/무효 케이스를 검증합니다.

```typescript
// src/entities/post/model/post.schema.test.ts
import { describe, expect, it } from 'vitest';
import { createPostSchema } from './post.schema';

describe('createPostSchema', () => {
  it('유효한 데이터를 파싱한다', () => {
    const result = createPostSchema.safeParse({
      url: 'https://example.com',
      isPrivate: false,
      bookmark: false,
      folderIds: [],
    });
    expect(result.success).toBe(true);
  });

  it('잘못된 URL 형식은 실패한다', () => {
    const result = createPostSchema.safeParse({
      url: 'not-a-url',
      isPrivate: false,
      bookmark: false,
      folderIds: [],
    });
    expect(result.success).toBe(false);
    // 에러 메시지도 확인 가능
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('URL');
    }
  });
});
```

> `bookmark`·`folderIds`는 옵셔널이 아니라 필수 필드다 — 빠뜨리면 유효한 입력도 파싱에
> 실패한다. 실제 케이스는 [`post.schema.test.ts`](../src/entities/post/model/post.schema.test.ts) 참고.

> **주의**: `postSchema.author.image`는 `z.string().optional()` — `null`을 허용하지 않고 `undefined`만 허용합니다.

---

## 패턴 C — 커스텀 훅 테스트

`renderHook`과 MSW를 함께 사용합니다.

<!-- check-docs-ignore: 새로 만들 파일의 예시 경로, 아직 존재하지 않음 -->

```typescript
// src/features/post/create/hooks/useCreatePost.test.tsx
import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { createTestQueryClient } from '@/test/utils';
import { useCreatePost } from './useCreatePost';

// ── Wrapper 팩토리 ──────────────────────────────────────
function createWrapper() {
  const queryClient = createTestQueryClient();
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }
  return Wrapper;
}

// ── useNavigate 모킹 ────────────────────────────────────
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// ── 테스트 ──────────────────────────────────────────────
describe('useCreatePost', () => {
  it('초기 상태에서 isCreating이 false다', () => {
    const { result } = renderHook(() => useCreatePost(), {
      wrapper: createWrapper(),
    });
    expect(result.current.isCreating).toBe(false);
  });

  it('제출하면 서버 응답을 기다리지 않고 목록으로 navigate한다', async () => {
    const { result } = renderHook(() => useCreatePost(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.form.setValue('url', 'https://example.com', { shouldDirty: true });
      result.current.form.setValue('isPrivate', false, { shouldDirty: true });
    });

    await act(async () => {
      await result.current.onSubmit();
    });

    expect(mockNavigate).toHaveBeenCalledWith('/post', { replace: true });
  });
});
```

> `useCreatePost`는 `mutate()`를 fire-and-forget으로 호출한 뒤 **서버 응답을 기다리지 않고
> 바로 navigate한다**(`useCreatePost.ts` 참고) — "성공 시에만 navigate"가 아니다. 성공/실패에
> 따라 navigate 여부가 갈리는 훅을 테스트할 땐 `server.use()`로 핸들러를 오버라이드하고
> `waitFor`로 결과를 기다리는 패턴을 쓴다. 실제 예시:
> [`useCreateComment.test.tsx`](../src/features/comment/create/hooks/useCreateComment.test.tsx)
> (성공/실패에 따라 폼이 비워지거나 복원되는 케이스를 MSW 오버라이드로 검증).

---

## 패턴 D — 컴포넌트 테스트

`renderWithProviders`로 컴포넌트를 렌더하고 사용자 인터랙션을 테스트합니다.

<!-- check-docs-ignore: 새로 만들 파일의 예시 경로, 아직 존재하지 않음 -->

```typescript
// src/widgets/post/post-card/ui/PostCard.test.tsx
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { PostCard } from './PostCard';
import { mockPost } from '@/mocks/fixtures/post.fixtures';

describe('PostCard', () => {
  it('포스트 제목을 렌더한다', () => {
    renderWithProviders(<PostCard post={mockPost} />);
    expect(screen.getByText(mockPost.title)).toBeInTheDocument();
  });

  it('특정 경로로 렌더할 수 있다', () => {
    renderWithProviders(<PostCard post={mockPost} />, {
      wrapperOptions: { initialEntries: ['/post/123'] },
    });
    expect(screen.getByText(mockPost.title)).toBeInTheDocument();
  });
});
```

> **좋아요·북마크처럼 아이콘형 액션 버튼은 `getByRole('button', { name: /.../i })`로 특정하기
> 어렵다** — `LikePostButton`(`features/post/like/ui/LikePostButton.tsx`)은 아이콘 옆에
> 카운트 숫자만 있고 별도 텍스트·`aria-label`이 없다. 이런 버튼의 클릭 인터랙션은
> `PostCard` 전체가 아니라 **그 버튼 컴포넌트를 단위로 분리해서** 테스트한다(props로 상태를
> 직접 주입할 수 있어 쿼리가 훨씬 단순해진다). 폼 제출·검색 입력처럼 접근 가능한 이름이
> 있는 인터랙션의 실전 예시는
> [`NavbarSearch.test.tsx`](../src/widgets/layout/navbar/ui/NavbarSearch.test.tsx),
> [`useCreateComment.test.tsx`](../src/features/comment/create/hooks/useCreateComment.test.tsx) 참고.

**쿼리 우선순위** (접근성 좋은 순서대로):

```typescript
// 1순위: 역할 + 이름 (접근성 기반)
screen.getByRole('button', { name: /제출/i });
screen.getByRole('textbox', { name: /이메일/i });

// 2순위: 텍스트 내용
screen.getByText('저장');

// 3순위: placeholder
screen.getByPlaceholderText('URL을 입력하세요');

// 4순위: test id (마지막 수단)
screen.getByTestId('submit-button');
```

---

## MSW 핸들러 추가 및 오버라이드

### 기본 핸들러 추가

새로운 API 엔드포인트가 생기면 `src/mocks/handlers/`에 핸들러를 추가합니다. 아래는 아직
없는 새 도메인(`notification`)을 추가하는 가정의 예시입니다 — 실존하는 핸들러는
[`src/mocks/handlers/`](../src/mocks/handlers/)의 `auth`·`post`·`comment`·`folder`·`upload`
5종을 참고하세요.

<!-- check-docs-ignore: 새로 만들 파일의 예시 경로, 아직 존재하지 않음 -->

```typescript
// src/mocks/handlers/notification.handlers.ts
import { http, HttpResponse } from 'msw';

const BASE = 'http://localhost';

export const notificationHandlers = [
  http.get(`${BASE}/notification`, () => {
    return HttpResponse.json({
      status: 200,
      message: 'ok',
      data: {
        /* 응답 데이터 */
      },
      timestamp: new Date().toISOString(),
    });
  }),

  http.patch(`${BASE}/notification/:id/read`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      status: 200,
      message: 'ok',
      data: body,
      timestamp: new Date().toISOString(),
    });
  }),
];
```

그리고 `src/mocks/handlers/index.ts`에 등록합니다.

```typescript
import { notificationHandlers } from './notification.handlers'; // 추가

export const handlers = [
  ...authHandlers,
  ...postHandlers,
  ...commentHandlers,
  ...folderHandlers,
  ...uploadHandlers,
  ...notificationHandlers, // 추가
];
```

### 특정 테스트에서만 핸들러 오버라이드

```typescript
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';

it('404 에러 시 에러 메시지를 보여준다', async () => {
  // server.use()로 이 테스트에서만 핸들러를 교체
  server.use(
    http.get('http://localhost/post/999', () => {
      return HttpResponse.json(
        { status: 404, code: 'POST_NOT_FOUND', message: '포스트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    })
  );

  renderWithProviders(<PostDetailPage />);

  await waitFor(() => {
    expect(screen.getByText(/찾을 수 없습니다/i)).toBeInTheDocument();
  });

  // afterEach에서 server.resetHandlers()가 자동으로 원래 핸들러로 복원
});
```

### 네트워크 오류 시뮬레이션

```typescript
import { http, HttpResponse } from 'msw';

server.use(
  http.post('http://localhost/post', () => {
    return HttpResponse.error(); // 네트워크 연결 실패
  })
);
```

---

## 픽스처 추가

새로운 도메인의 목 데이터는 `src/mocks/fixtures/`에 추가합니다. 위와 같은 가정의
`notification` 도메인이라면:

<!-- check-docs-ignore: 새로 만들 파일의 예시 경로, 아직 존재하지 않음 -->

```typescript
// src/mocks/fixtures/notification.fixtures.ts
import type { Notification } from '@/entities/notification/model/notification.schema';

export const mockNotification: Notification = {
  id: 'notification-uuid-1',
  message: '댓글이 달렸어요.',
  isRead: false,
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
};
```

**규칙:**

- 픽스처는 **Zod 타입**으로 명시적으로 타입 지정 (`const mockX: MyType = { ... }`)
- `auth.fixtures.ts`의 `mockAccount`와 일관된 ID 사용 (`user-uuid-1`)
- `postSchema.author.image`처럼 `null`/`undefined` 구분에 주의

---

## 테스트 강제 실행

### git push 시 자동 실행

```bash
git push  # → pre-push 훅이 npm run test 실행
          # → 실패 시 push 차단
```

### GitHub Actions (CI/CD)

PR을 만들면 `ci.yml`이 `pnpm check`(타입+린트+포맷)와 `pnpm test`를 검증합니다. `main`에
push되면 `deploy.yml`이 같은 검증을 다시 거친 뒤 빌드·배포합니다.

```
Install dependencies → Type check/lint/format(check) → Run tests → Build → Deploy to S3
                                                              ↑
                                                        실패 시 여기서 중단
```

### 테스트를 통과하지 않고 push하는 방법 (비상시)

```bash
git push --no-verify  # pre-push 훅 건너뜀 (비추천)
```

> CI/CD는 `--no-verify`로 우회할 수 없습니다. PR을 통해 merge하는 경우에도 Actions가 실행됩니다.

---

## 커버리지 리포트

```bash
npm run test:coverage
```

결과는 터미널과 `coverage/index.html` 두 곳에서 확인할 수 있습니다.

```
----------|---------|----------|---------|---------|
File      | % Stmts | % Branch | % Funcs | % Lines |
----------|---------|----------|---------|---------|
All files |   72.5  |   68.3   |   75.0  |   72.1  |
 date.util|   95.2  |   88.0   |  100.0  |   95.2  |
 form.util|   85.0  |   80.0   |  100.0  |   85.0  |
----------|---------|----------|---------|---------|
```

---

## 자주 발생하는 문제

### 1. `import.meta.env.DEV`가 false라 API URL이 undefined

**원인**: Vitest 환경에서는 `MODE === 'test'`이므로 `DEV === false`

**해결**: `.env.test` 파일이 있는지 확인

```
# .env.test (FE 프로젝트 루트)
VITE_API_BASE_URL=http://localhost
```

---

### 2. `screen.getByText()`가 요소를 찾지 못함

**원인**: 비동기 데이터 로딩 중에 쿼리 실행

**해결**: `waitFor` 또는 `findBy*` 사용

```typescript
// ❌ 동기 쿼리 → 데이터 로딩 전에 실행됨
expect(screen.getByText('포스트 제목')).toBeInTheDocument();

// ✅ 비동기 대기 → 렌더될 때까지 기다림
await waitFor(() => {
  expect(screen.getByText('포스트 제목')).toBeInTheDocument();
});

// ✅ 또는 findBy (내부적으로 waitFor 사용)
expect(await screen.findByText('포스트 제목')).toBeInTheDocument();
```

---

### 3. 테스트 간 캐시 오염

**원인**: React Query 캐시가 테스트 간에 공유됨

**해결**: `renderWithProviders`는 자동으로 각 테스트마다 새 `QueryClient`를 생성합니다. `renderHook`을 쓸 때도 반드시 `createTestQueryClient()`를 사용하세요.

```typescript
// ✅ 올바른 사용법
function createWrapper() {
  const queryClient = createTestQueryClient(); // 매번 새로 생성
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}
```

---

### 4. MSW 핸들러가 실행되지 않음

**원인**: 핸들러 URL과 실제 요청 URL이 다름

**디버깅**: `server.listen({ onUnhandledRequest: 'warn' })` 설정으로 콘솔 경고 확인

```typescript
// 실제 요청 URL 확인 방법
server.use(
  http.all('*', ({ request }) => {
    console.log('요청:', request.method, request.url);
    return passthrough(); // 원래 핸들러로 넘김
  })
);
```

---

### 5. `postSchema.author.image: null` 오류

**원인**: `accountSchema.image = z.string().optional()` → `string | undefined` (null 불가)

**해결**: 픽스처에서 `null` 대신 `undefined` 사용

```typescript
// ❌
author: { id: '...', nickname: '...', image: null }

// ✅
author: { id: '...', nickname: '...', image: undefined }
```

---

### 6. `useNavigate`를 사용하는 훅 테스트 오류

**원인**: `react-router-dom`의 `useNavigate`는 Router 컨텍스트가 필요

**해결**: `MemoryRouter` 래핑 + `useNavigate` 모킹

```typescript
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});
```

---

## 브라우저 수동 테스트 — DevTools 기기 에뮬레이션 주의사항

여기까지는 전부 Vitest 자동화 테스트다. 이 섹션은 **실제 브라우저를 열어 눈으로
확인하는 수동 QA**에 대한 것이다.

**증상 사례**: 모바일 전용 UI(사이드바 드로어, `md:hidden`)를 DevTools의
"기기 툴바 토글"(모바일 기기 에뮬레이션)로 테스트했더니 마우스 뒤로가기(옆면)
버튼을 눌러도 반응이 없었다. `window` 캡처 단계에서 모든 마우스 이벤트를 잡는
계측을 깔아도 아무것도 안 찍혀서 한동안 "브라우저가 이 조합을 막는다"고
오판했다. 그런데 같은 화면을 **기기 에뮬레이션 없이 브라우저 창만 768px
이하로 좁혀서** 열었더니 정상 동작했다. 자세한 경위는
[DECISIONS.md의 2026-08-07 항목](./DECISIONS.md) 참고.

**원인**: DevTools 기기 에뮬레이션은 마우스 입력을 터치 이벤트로 변환해
시뮬레이션한다. 실제 모바일 기기엔 애초에 "마우스 옆면 버튼" 같은 입력이
존재하지 않으니, 에뮬레이터가 이런 입력을 실제 데스크톱과 동일하게 재현해야 할
이유가 없다 — 에뮬레이터 고유의 아티팩트였지 실사용에서 나는 문제가 아니었다.

**규칙**:

- `md:hidden` 같은 **반응형 CSS 브레이크포인트만** 확인하면 되는 경우 → 기기
  에뮬레이션을 켜지 말고 **브라우저 창 자체를 좁혀서** 테스트한다. 입력 경로가
  실제 데스크톱과 동일하게 유지되어 이런 아티팩트가 생기지 않는다.
- 스와이프 등 **터치 전용 제스처**·기기별 user-agent·모바일 전용 브라우저 API를
  확인해야 할 때만 기기 에뮬레이션을 쓴다.
- 기기 에뮬레이션에서만 재현되고 **창을 좁힌 상태(에뮬레이션 없이)나 실기기에서는
  재현되지 않는 증상**은 앱 버그로 단정하기 전에 에뮬레이터 아티팩트일 가능성부터
  의심한다.
