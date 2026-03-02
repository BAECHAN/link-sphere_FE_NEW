# 테스트 가이드

> Link-Sphere FE 테스트 환경 사용 방법

## 목차

1. [스택 개요](#스택-개요)
2. [빠른 시작](#빠른-시작)
3. [테스트 파일 위치 규칙](#테스트-파일-위치-규칙)
4. [패턴 A — 유틸 함수 테스트](#패턴-a--유틸-함수-테스트)
5. [패턴 B — Zod 스키마 테스트](#패턴-b--zod-스키마-테스트)
6. [패턴 C — 커스텀 훅 테스트](#패턴-c--커스텀-훅-테스트)
7. [패턴 D — 컴포넌트 테스트](#패턴-d--컴포넌트-테스트)
8. [MSW 핸들러 추가 및 오버라이드](#msw-핸들러-추가-및-오버라이드)
9. [픽스처 추가](#픽스처-추가)
10. [테스트 강제 실행 (pre-push / CI)](#테스트-강제-실행)
11. [커버리지 리포트](#커버리지-리포트)
12. [자주 발생하는 문제](#자주-발생하는-문제)

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
├── domains/post/_common/model/
│   ├── post.schema.ts
│   └── post.schema.test.ts        ← 스키마 테스트
└── domains/post/features/create-post/
    ├── hooks/
    │   ├── useCreatePost.ts
    │   └── useCreatePost.test.tsx  ← 훅 테스트
    └── ui/
        ├── CreatePostForm.tsx
        └── CreatePostForm.test.tsx ← 컴포넌트 테스트
```

---

## 패턴 A — 유틸 함수 테스트

순수 함수는 MSW나 React 없이 가장 단순하게 테스트합니다.

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
// src/domains/post/_common/model/post.schema.test.ts
import { describe, expect, it } from 'vitest';
import { createPostSchema } from './post.schema';

describe('createPostSchema', () => {
  it('유효한 데이터를 파싱한다', () => {
    const result = createPostSchema.safeParse({
      url: 'https://example.com',
      isPrivate: false,
    });
    expect(result.success).toBe(true);
  });

  it('잘못된 URL 형식은 실패한다', () => {
    const result = createPostSchema.safeParse({
      url: 'not-a-url',
      isPrivate: false,
    });
    expect(result.success).toBe(false);
    // 에러 메시지도 확인 가능
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('URL');
    }
  });
});
```

> **주의**: `postSchema.author.image`는 `z.string().optional()` — `null`을 허용하지 않고 `undefined`만 허용합니다.

---

## 패턴 C — 커스텀 훅 테스트

`renderHook`과 MSW를 함께 사용합니다.

```typescript
// src/domains/post/features/create-post/hooks/useCreatePost.test.tsx
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { server } from '@/mocks/server';
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

  it('성공 시 /post 로 navigate한다', async () => {
    const { result } = renderHook(() => useCreatePost(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.form.setValue('url', 'https://example.com');
      result.current.form.setValue('isPrivate', false);
      await result.current.onSubmit(/* form event */);
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/post');
    });
  });

  it('서버 에러 시 navigate를 호출하지 않는다', async () => {
    // 이 테스트에서만 핸들러를 오버라이드
    server.use(
      http.post('http://localhost/post', () => {
        return HttpResponse.json({ message: 'Server Error' }, { status: 500 });
      })
    );

    const { result } = renderHook(() => useCreatePost(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.form.setValue('url', 'https://example.com');
      result.current.form.setValue('isPrivate', false);
      await result.current.onSubmit(/* form event */);
    });

    await waitFor(() => {
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});
```

---

## 패턴 D — 컴포넌트 테스트

`renderWithProviders`로 컴포넌트를 렌더하고 사용자 인터랙션을 테스트합니다.

```typescript
// src/domains/post/features/post-detail/ui/PostCard.test.tsx
import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders, userEvent } from '@/test/utils';
import { PostCard } from './PostCard';
import { mockPost } from '@/mocks/fixtures/post.fixtures';

describe('PostCard', () => {
  it('포스트 제목을 렌더한다', () => {
    renderWithProviders(<PostCard post={mockPost} />);
    expect(screen.getByText(mockPost.title)).toBeInTheDocument();
  });

  it('좋아요 버튼 클릭 시 API가 호출된다', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PostCard post={mockPost} />);

    await user.click(screen.getByRole('button', { name: /좋아요/i }));

    // MSW가 핸들러를 통해 응답하므로 UI 변화를 확인
    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument(); // likeCount 증가
    });
  });

  it('특정 경로로 렌더할 수 있다', () => {
    renderWithProviders(<PostCard post={mockPost} />, {
      wrapperOptions: { initialEntries: ['/post/123'] },
    });
    expect(screen.getByText(mockPost.title)).toBeInTheDocument();
  });
});
```

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

새로운 API 엔드포인트가 생기면 `src/mocks/handlers/`에 핸들러를 추가합니다.

```typescript
// src/mocks/handlers/member.handlers.ts
import { http, HttpResponse } from 'msw';

const BASE = 'http://localhost';

export const memberHandlers = [
  http.get(`${BASE}/account/profile`, () => {
    return HttpResponse.json({
      status: 200,
      message: 'ok',
      data: {
        /* 응답 데이터 */
      },
      timestamp: new Date().toISOString(),
    });
  }),

  http.patch(`${BASE}/account/profile`, async ({ request }) => {
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
import { memberHandlers } from './member.handlers'; // 추가

export const handlers = [
  ...authHandlers,
  ...postHandlers,
  ...commentHandlers,
  ...memberHandlers, // 추가
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

새로운 도메인의 목 데이터는 `src/mocks/fixtures/`에 추가합니다.

```typescript
// src/mocks/fixtures/member.fixtures.ts
import type { MemberProfile } from '@/domains/member/_common/model/member.schema';

export const mockMemberProfile: MemberProfile = {
  id: 'user-uuid-1',
  nickname: 'testuser',
  bio: '테스트 유저입니다.',
  postCount: 5,
  followerCount: 10,
  followingCount: 3,
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

`main` 브랜치에 push 시 자동으로 다음 순서로 실행됩니다.

```
Install dependencies → Run tests → Build → Deploy to S3
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
