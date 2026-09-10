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
13. [Playwright e2e 자동화 테스트](#playwright-e2e-자동화-테스트)
14. [자주 발생하는 문제](#자주-발생하는-문제)
15. [브라우저 수동 테스트 — DevTools 기기 에뮬레이션 주의사항](#브라우저-수동-테스트--devtools-기기-에뮬레이션-주의사항)
16. [Playwright MCP로 로그인 필요 화면 시각 검증하기](#playwright-mcp로-로그인-필요-화면-시각-검증하기)

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
4. **호출부가 실제로 있고, 틀릴 수 있는 분기가 있는 코드** — 버그가 나기 전에
   붙이는 사전적 기준. "순수 함수라서" 또는 "인증 코드라서" 자체는 판별 기준이
   아니다 — `common.util.ts`가 정확히 그 반례다: 메서드 24개 전부가 순수
   함수지만 실사용은 `emptyStringToNull` 1개뿐이라 나머지 23개는 테스트 대상에서
   제외했다(2026-09-08 조사, "순수 함수니까 테스트한다"였다면 이 파일 전체가
   편입됐을 것이다). 반대로 `ProtectedRoute.tsx`처럼 호출부가 확실하고(모든
   보호 페이지) 분기마다 다른 결과(스피너/리다이렉트/통과)가 나오는 코드는
   깨지면 권한 누출이나 화면이 영원히 멈추는 형태로 나타나 회귀가 나기 전에
   잡는 편이 싸다. 판단은 두 조건을 **모두** 확인해서 한다:
   - 호출부가 실제로 존재하는가 (`grep`으로 확인)
   - 경계값·에러 경로·조기 return처럼 틀릴 수 있는 분기가 있는가

   둘 중 하나라도 아니면 쓰지 않는다. 이번에 이 기준으로 추가한 예:
   `search-parser.test.ts`(순수 함수, `usePostList.ts`에서 실사용),
   `auth.util.test.ts`(30초 만료 마진 경계), `ProtectedRoute.test.tsx`(권한
   분기 케이스 전체 — 두 인증 게이트의 책임 분리는 [`docs/AUTH.md`](AUTH.md) 참고).

   파일 보유율만으로는 실제 검증 범위를 못 읽는다는 점도 이번에 실측했다 —
   테스트 파일 33개(15.2%)였을 때 `pnpm test:coverage` 실측 statements는
   40.15%였다(간접 커버: 예를 들어 `src/shared/store/`는 직접 테스트가
   `imageViewer.store.ts` 하나뿐인데도 다른 테스트가 그 스토어를 거쳐가며
   70%가 커버됐다). "테스트가 없다"가 "검증이 안 됐다"와 같은 말이 아니다.

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

## Playwright e2e 자동화 테스트

> 여기서부터는 jsdom이 아니라 **실제 Chromium**에서 여러 화면을 가로지르는 흐름(라우팅·
> 인증 상태·모달)을 검증한다. [Playwright MCP로 로그인 필요 화면 시각 검증하기](#playwright-mcp로-로그인-필요-화면-시각-검증하기)와는
> 다른 도구다 — MCP 절차는 세션이 방금 만든 변경을 **사람이 눈으로** 확인하는 수동
> 검증이고, 여기는 `@playwright/test`로 **자동** 회귀 테스트를 짜는 것이다.

### 스택 개요

| 항목          | 내용                                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 러너          | [@playwright/test](https://playwright.dev/) `1.57.0`(`playwright` 라이브러리와 버전 고정, 브라우저 바이너리 불일치 방지) |
| 브라우저      | Chromium만(v1 범위 — Firefox/WebKit은 필요해지면 추가)                                                                   |
| 네트워크 모킹 | Playwright 내장 `page.route()` 직접 사용(`@msw/playwright` 아님 — pre-1.0 정체로 배제)                                   |
| dev server    | `vite --mode test`(`.env.test` 재사용 — mkcert HTTPS를 자연히 피해 HTTP로 뜬다)                                          |
| 설정 파일     | `playwright.config.ts`, `tsconfig.e2e.json`                                                                              |

```bash
pnpm test:e2e   # chromium 헤드리스로 1회 실행
npx playwright show-report   # 마지막 실행의 HTML 리포트 열기(스텝별 스크린샷·트레이스)
```

### 디렉터리 구조

`src/mocks/handlers/`의 도메인별 분리 구조를 그대로 따른다.

```
e2e/
  fixtures/
    auth.fixture.ts        # has-session 플래그 시딩(page 픽스처 오버라이드)
  mocks/
    catch-all.ts           # /api/** 안전망 — beforeEach에서 가장 먼저 등록
    route-match.ts          # pathname 정확 일치 헬퍼(isApiPath)
    endpoints.ts             # API 엔드포인트 문자열 미러(아래 "주의점" 참고)
    wrap-response.ts        # ApiResponse<T> 래핑 헬퍼
    <domain>.mock.ts        # 도메인별 page.route 등록 함수
  <flow>.spec.ts            # 테스트 파일
playwright.config.ts
tsconfig.e2e.json
```

`e2e/mocks/*.mock.ts`는 `src/mocks/fixtures/*.fixtures.ts`(순수 데이터, msw 미의존)를
그대로 import해 재사용한다 — 유닛 테스트와 같은 고정값을 쓰므로 응답 데이터를 두 번
정의하지 않는다.

### 네트워크 모킹 — 캐치올 + pathname 정확 일치

모든 스펙의 `beforeEach`는 항상 이 순서로 `page.route`를 등록한다:

```ts
test.beforeEach(async ({ page }) => {
  await installCatchAll(page); // 1. 안전망 — 가장 먼저 등록
  await mockAuthRefresh(page); // 2. 로그인 상태가 필요하면
  await mockPostList(page); // 3. 이 스펙이 쓰는 구체적인 목들
  // ...
});
```

**등록 순서가 중요하다.** Playwright route는 **나중에 등록한 핸들러가 먼저 실행**된다
(LIFO,
[공식 문서](https://playwright.dev/docs/api/class-route#route-fallback):
_"they run in the order opposite to their registration"_). 캐치올을 가장 먼저
등록해야 이후 등록하는 구체적인 목들이 그걸 덮어쓴다 — 반대로 두면(예: 로그인 fixture가
자기 route를 먼저 등록하고 스펙이 나중에 캐치올을 등록) 캐치올이 오히려 구체적인 목을
덮어써 그 요청이 조용히 abort된다. 2026-09-10 구현 중 실제로 이 순서를 반대로 둬서
`/auth/refresh`가 막혀 "로그인 상태를 시딩했는데 로그인 모달이 뜨는" 회귀를 겪었다 — 그래서
`auth.fixture.ts`는 localStorage 시딩만 하고, `/auth/refresh` 모킹 자체는 각 스펙의
`beforeEach`가 캐치올 다음에 직접 등록한다(등록 순서를 스펙이 명시적으로 통제).

안 덮인 요청은 캐치올이 abort시켜 테스트가 그 자리에서 실패한다 — 모킹 누락을 조용히
통과시키지 않기 위한 의도적 설계다(dev 프록시 target이 실제 BE Lambda URL이라, 안
덮이면 실서버로 새는 것보다 훨씬 안전하다).

**pathname 정확 일치를 쓰는 이유** — 처음엔 glob 문자열(`` `**/api${endpoint}` ``)을
썼는데, Vite 자체 모듈 경로(예: `src/entities/post/api/post.keys.ts`)에도 `/api/`가
부분 문자열로 들어있어 캐치올이 실제 API 요청이 아닌 모듈 로딩까지 막아버렸다(2026-09-10
실측 — 페이지가 흰 화면으로 렌더 실패). `page.route`는 URL을 받는 predicate 함수도
지원하므로, `route-match.ts`의 `isApiPath(url, endpoint)`가 `url.pathname === '/api' + endpoint`로
정확히 비교한다 — `URL.pathname`은 쿼리스트링을 포함하지 않아 `*` 와일드카드 없이도
`?q=...` 같은 검색어가 자연히 매칭된다.

**`api.ts`를 직접 import할 수 없는 이유** — `src/shared/config/api.ts`는 모듈
최상위에서 `import.meta.env.DEV`를 읽는다. Vite(dev server)·Vitest는 이 글로벌을
채워주지만, Playwright test의 Node 기반 테스트 러너는 채워주지 않아 이 파일을 import하는
순간 `Cannot read properties of undefined (reading 'DEV')`로 크래시한다(2026-09-10
실측). 그래서 `e2e/mocks/endpoints.ts`가 이 e2e 목이 쓰는 엔드포인트 경로 문자열만
별도로 옮겨 갖고 있다 — `api.ts`의 `API_ENDPOINTS`가 바뀌면 이 파일도 같이 갱신해야
한다.

### 대표 흐름

| 스펙                    | 흐름                                                                        |
| ----------------------- | --------------------------------------------------------------------------- |
| `e2e/post-list.spec.ts` | 비로그인 방문자 — 목록 조회 → 검색 → 상세 진입                              |
| `e2e/bookmark.spec.ts`  | 로그인 상태(has-session 시딩) — 북마크 버튼 → 폴더 선택 → 저장              |
| `e2e/login.spec.ts`     | 실제 로그인 폼 제출 — 성공 시 `/post` 착지, 실패 시 서버 메시지 토스트      |
| `e2e/logout.spec.ts`    | 로그아웃 — 비보호 페이지(제자리)/보호 페이지(`/post`로 이동) 두 분기        |
| `e2e/like.spec.ts`      | 좋아요 — 상세↔목록 캐시 전파(재조회 불필요), 실패 시 양쪽 롤백              |
| `e2e/comment.spec.ts`   | 댓글 작성 → 댓글 수 반영(invalidate로 재조회 필수 — 좋아요와 대조되는 지점) |

### 무엇에 새 e2e 흐름을 추가하는가

이 레포는 유닛 테스트에도 커버리지 목표를 두지 않는다([위 "무엇에 테스트를 쓰는가"](#무엇에-테스트를-쓰는가-테스트-범위-기준)
참고) — e2e는 유닛보다 작성·유지 비용이 훨씬 크므로 같은 선별 원칙을 더 엄격하게
적용한다:

- **사후적** — 여러 화면/레이어를 가로지르는 흐름에서 실제 회귀가 발생했을 때, 그 흐름을
  재현하는 e2e를 추가한다.
- **사전적** — 유닛/컴포넌트 테스트로는 검증 불가능한 영역만: 라우팅 가드, 인증 상태에
  따른 리다이렉트/모달 분기, 여러 페이지를 가로지르는 mutation→invalidate→refetch 체인.
- 이미 유닛으로 잘 덮인 로직을 브라우저에서 한 번 더 확인하는 용도로는 추가하지
  않는다 — 이중 비용만 늘어난다.

### CI 연동

`ci.yml`의 `e2e` job이 `check` job과 병렬로 PR마다 자동 실행된다(Chromium 설치 →
`vite --mode test` 자동 기동(`playwright.config.ts`의 `webServer`) → `pnpm test:e2e`).
실패하면 `playwright-report/`·`test-results/`(스크린샷·트레이스·영상)가 아티팩트로
업로드된다 — 다운로드해 `npx playwright show-report`로 그대로 열어보면 CI에서 무엇이
실패했는지 로컬에서 재현 없이 확인할 수 있다.

### 결과를 눈으로 확인하는 방법

**HTML 리포트** (`npx playwright show-report`)는 `playwright-report/`를 서빙하는
로컬 정적 서버를 띄운다(기본 `localhost:9323`). **재실행 후에도 서버를 새로 켤 필요는
없다** — 같은 폴더를 계속 서빙 중이므로 `pnpm test:e2e`(또는 `pnpm exec playwright
test`)를 다시 돌려 리포트 파일이 갱신되면, 브라우저 탭에서 새로고침만 해도 최신 결과가
보인다(2026-09-10, 예전 실행 시점의 리포트를 보고 있어 스펙이 일부만 보인다고 헷갈렸던
사례 — 서버를 새로 켜는 게 아니라 새로고침이 빠져 있었다).

**브라우저 창으로 직접 보고 싶을 때**:

```bash
pnpm exec playwright test --headed   # 실제 Chromium 창이 뜨고 클릭하는 걸 그대로 본다
pnpm exec playwright test --ui       # Playwright UI 모드 — 스텝별 타임라인을 되감아가며 확인, 가장 자세히 보고 싶을 때 추천
```

**느린 속도로 녹화해서 IDE 탭에서 재생하고 싶을 때** — 기본 설정(`use.video:
'on-first-retry'`)은 통과하는 테스트엔 영상을 안 남긴다. 항상 녹화하고, 액션 사이
간격을 눈으로 따라갈 수 있게 하려면 `playwright.config.ts`를 **일시적으로**(영구
설정으로 두지 않는다 — 모든 실행이 느려진다) 아래처럼 바꿔 돌린 뒤 원복한다:

```ts
use: {
  // ...
  video: 'on',
  launchOptions: { slowMo: 1000 }, // 액션 사이 1초 대기
},
```

결과 영상은 `test-results/<테스트명>/video.webm`에 생긴다. `open -a "Cursor" <경로>`
(또는 `cursor <경로>`)로 열면 별도 창이 아니라 **IDE 탭에서 재생**된다 —
`browser-verification` skill이 세션 검증 영상에 쓰는 것과 같은 이유(창이 따로 뜨면
정신없다는 피드백)다. 재생이 안 되면(빈 화면·재생 버튼 없음) 그 skill의 "알려진
제약"과 같은 원인(Playwright는 VP8 코덱 webm 전용)이니 같은 방식(ffmpeg 변환 또는
스크린샷 대체)으로 대응한다.

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

### 7. `isAuthResolved`가 테스트 사이에 샌다

**원인**: `src/test/setup.ts`의 `afterEach`는 `useAuthStore.getState().clearAuth()`만
호출하는데, `auth.store.ts`의 `clearAuth()`는 `accessToken`·`isAuthenticated`만
되돌리고 `isAuthResolved`는 건드리지 않는다. 앞선 테스트가 `setAuthResolved(true)`로
만들어 놓으면 그 값이 다음 테스트로 그대로 넘어온다.

**해결**: `isAuthResolved`를 다루는 테스트(`ProtectedRoute.test.tsx`,
`useAppInitialization.test.tsx` 등)는 `beforeEach`/`afterEach` 양쪽에서 명시적으로
`setAuthResolved(false)`로 되돌린다. `--sequence.shuffle`로 순서를 무작위 실행해
누수 여부를 확인할 수 있다.

---

### 8. 지연 게이트가 걸린 로딩 UI는 렌더 직후엔 안 보인다

**대상**: `useDelayedLoading`을 내부에 쓰는 모든 로딩 표시 — `SpinnerOverlay`,
`DelayedFallback`(및 그걸로 감싼 스켈레톤·스피너). 로딩 UX 규약은
`docs/FE-ARCHITECTURE.md` §12-A 참고.

**원인**: `useDelayedLoading(true, delay)`은 `delay=0`이어도 내부적으로
`setTimeout(fn, 0)` 매크로태스크를 거쳐야 `true`가 된다. `render()` 직후
동기 `getByRole('status')`나 `getByTestId(...)`는 아직 아무것도 못 찾는다.

**해결 — 실제 타이머로 충분할 때**:
`await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument())`로 기다린다.

**해결 — 지연 값 자체(경계값, 취소 등)를 검증해야 할 때**: fake timers를 쓴다.
`waitFor`와 fake timers를 같은 테스트에서 섞지 않는다 — 시간 진행은 반드시
`act(() => vi.advanceTimersByTime(n))`으로 감싼다.

```ts
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers(); // 빼먹으면 뒤 테스트 스위트가 전부 멈춘다
});

it('delay가 지나면 true로 바뀐다', () => {
  const { result } = renderHook(() => useDelayedLoading(true, 300));
  act(() => {
    vi.advanceTimersByTime(300);
  });
  expect(result.current).toBe(true);
});
```

`useMinimumLoading`처럼 `Date.now()`로 경과 시간을 계산하는 훅은 `vi.useFakeTimers()`가
`Date`도 함께 fake하는지 확인한다(`{ toFake: ['Date', ...] }`로 명시하면 안전). 안 그러면
`elapsedTime` 계산이 실시간을 읽어 케이스가 조용히 무의미해진다. 참고:
`useDelayedLoading.test.ts`, `useMinimumLoading.test.ts`, `DelayedFallback.test.tsx`.

⚠️ MSW를 함께 쓰는 테스트(`ProtectedRoute.test.tsx` 등)에서는 네트워크가 관여하는
케이스에 fake timers를 `beforeEach` 전역으로 켜지 않는다 — refresh 요청처럼 fetch가
끼는 흐름에서 요청이 영원히 pending될 수 있다. 해당 `it` 안에서만 켠다.

---

### 9. `act`를 `vitest`에서 import하면 조용히 깨진다

**원인**: `act`는 `@testing-library/react`가 내보내는 함수다. `vitest`에서 `act`를
import해도 타입 에러 없이 통과하다가(둘 다 이름이 같은 export를 갖고 있지 않아 실제로는
`undefined`가 잡혀) 호출 시점에 `TypeError: ... is not a function`으로 터진다.

**해결**: 훅이 `navigate()`처럼 렌더 트리 바깥에서 상태를 바꾸는 호출을 감쌀 때는
`import { act } from '@testing-library/react'`를 쓴다.

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

---

## Playwright MCP로 로그인 필요 화면 시각 검증하기

이 절은 [Playwright e2e 자동화 테스트](#playwright-e2e-자동화-테스트)(`@playwright/test`
기반 자동 회귀 테스트)와는 다른 도구를 다룬다 — Claude Code 세션이 UI 변경을 그
자리에서 **눈으로** 확인할 때는 대화형 MCP Playwright 도구(`mcp__playwright__*`)로
실제 브라우저를 띄워 직접 조작한다. 북마크·마이페이지처럼 **로그인해야만 보이는 화면**은 매번 사용자에게
비밀번호를 물어보는 대신 아래 방식으로 세션을 재사용한다(2026-09-10 확정 — Playwright
공식 [Authentication 가이드](https://playwright.dev/docs/auth)의 `storageState` 패턴을
이 레포 사정에 맞게 적용했다).

**핵심 제약**: `shared/store/auth.store.ts`의 리프레시 토큰은 **httpOnly 쿠키**라
JS(`document.cookie`, localStorage, IndexedDB 어느 것으로도)로 읽을 수 없다(XSS
방어, 의도된 설계). 그래서 "로그인 후 토큰을 뽑아 파일에 저장" 같은 JS 레벨 접근은
애초에 불가능하다 — 대신 브라우저 엔진 레벨(CDP)에서 쿠키를 통째로 캡처하는
Playwright의 `context.storageState()`를 쓴다.

**세션 캡처 (테스트 계정으로 최초 로그인한 직후, 1회만)**:

```js
// browser_run_code_unsafe로 실행
async (page) => {
  await page
    .context()
    .storageState({ path: '/Users/<user>/.claude/link-sphere-e2e-auth-state.json' });
};
```

- 저장 위치는 **반드시 이 레포 바깥**(워크트리도 아니고 메인 체크아웃도 아닌, 사용자
  홈 디렉터리)이어야 한다 — git이 추적할 수 있는 경로에 두면 `.gitignore`로 막아도
  실수로 커밋될 위험이 남는다. Playwright 공식 문서도 storageState 파일에는 민감한
  쿠키가 담기니 저장소에 체크인하지 말라고 명시한다.
- 이 파일에는 테스트 계정 비밀번호가 아니라 **로그인 결과로 발급된 세션 쿠키만**
  들어있다. 비밀번호 자체는 세션 캡처 시점에 대화로만 주고받고 어떤 파일에도 저장하지
  않는다.
- 테스트 계정은 운영 데이터가 없는 별도 계정이어야 한다 — 실사용자 계정으로 이
  절차를 수행하지 않는다.

**세션 재사용 (다음 세션 이후, 로그인 없이)**:

새 워크트리/새 세션에서 로그인 필요 화면을 확인해야 할 때, 위 파일이 존재하면
비밀번호를 다시 묻지 않고 그 안의 쿠키를 현재 브라우저 컨텍스트에 주입해 재사용한다.
구체적인 주입 절차(새 컨텍스트 생성 시 `storageState` 옵션으로 넘길지, 기존
컨텍스트에 `addCookies`로 주입할지)는 MCP Playwright 도구가 컨텍스트 생성을 직접
노출하지 않아 다음 실제 사용 시점에 검증이 필요하다 — 아직 재사용 자체를 실측하지는
않았다(2026-09-10 기준, 최초 캡처만 확인됨).

- 세션이 만료됐거나(리프레시 토큰 수명 경과) 재사용 절차가 실패하면, 사용자에게
  테스트 계정 자격증명을 다시 요청한다 — 이때도 받은 비밀번호를 파일에 저장하지
  않고 로그인 1회에만 사용한 뒤 버린다.
