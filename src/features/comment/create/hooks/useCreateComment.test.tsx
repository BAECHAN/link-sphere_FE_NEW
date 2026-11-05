import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, renderHook, screen, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createTestQueryClient } from '@/test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Outlet, RouterProvider, createMemoryRouter } from 'react-router-dom';
import { Suspense, lazy, type ReactNode } from 'react';
import { useCreateComment } from '@/features/comment/create/hooks/useCreateComment';
import { useAuthStore } from '@/shared/store/auth.store';
import { accountKeys } from '@/entities/account/api/account.keys';
import { mockAccount } from '@/mocks/fixtures/account.fixtures';
import { server } from '@/mocks/server';
import { API_BASE_URL, API_ENDPOINTS, IDEMPOTENCY_KEY_HEADER } from '@/shared/config/api';
import {
  MAX_COMMENT_CONTENT_BYTES,
  MAX_COMMENT_CONTENT_HANGUL_CHARS,
} from '@/entities/comment/config/comment.const';
import { getUtf8ByteLength } from '@/shared/lib/content/textBytes';
import { toast } from '@/shared/lib/toast/toast';
import { TEXTS } from '@/shared/config/texts';
import { NavigationService } from '@/shared/lib/router/navigation';
import { SERVER_ERROR_CODE } from '@/shared/config/error-code';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { RouterEvents } from '@/shared/lib/router/router-events';

// 기본 commentHandlers는 API_BASE_URL 접두사(/api) 없이 등록돼 있어 테스트 환경 요청 경로와
// 매칭되지 않는다(comment.queries.test.ts와 동일한 이유) - url()로 명시 등록.
const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;
const POST_ID = 'post-uuid-1';

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

// useCreateComment는 guard() 안에서 useAccount()가 채워질 때까지 제출을 아무 일도 하지 않고
// 삼킨다 - 로그인 상태를 만든 뒤 계정 조회가 끝나기를 기다려야 제출 로직을 실제로 검증할 수 있다.
async function renderLoggedIn(queryClient: QueryClient, options: { onSuccess?: () => void } = {}) {
  useAuthStore.getState().setAuth('test-access-token');
  const { result } = renderHook(() => useCreateComment({ postId: POST_ID, ...options }), {
    wrapper: createWrapper(queryClient),
  });
  await waitFor(() => expect(queryClient.getQueryData(accountKeys.root)).toEqual(mockAccount));
  return result;
}

type ToastOptions = Parameters<typeof toast.error>[1];

/** 폼을 떠난 뒤 실패 토스트(showLeftPageFailureToast) - 제목·고정 id·닫을 때까지·설명 문구를 본다 */
function expectLeftFormFailureToast(
  errorSpy: { mock: { calls: unknown[][] } },
  { title, key, description }: { title: string; key: string; description: string }
) {
  const [message, options] = errorSpy.mock.calls.at(-1) as [string, ToastOptions];

  expect(message).toBe(title);
  expect(options).toMatchObject({ id: `left-page-failure:${key}`, duration: Infinity });

  const { container } = render(<div>{options?.description as ReactNode}</div>);

  expect(container).toHaveTextContent(description);
}

describe('useCreateComment', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  it('제출하면 서버 응답을 기다리지 않고 폼과 이미지가 즉시 비워진다', async () => {
    server.use(
      http.post(url(API_ENDPOINTS.post.postComment(POST_ID)), async () => {
        await new Promise(() => {}); // 응답 없이 pending 유지 - "즉시" 비워지는지만 확인한다.
      })
    );

    const result = await renderLoggedIn(queryClient);

    act(() => {
      result.current.form.setValue('content', '작성 중인 댓글', { shouldDirty: true });
    });

    await act(async () => {
      await result.current.onSubmit();
    });

    expect(result.current.form.getValues('content')).toBe('');
    expect(result.current.images).toEqual([]);
  });

  it('등록이 실패하면 입력했던 내용이 폼에 복원된다', async () => {
    server.use(
      http.post(url(API_ENDPOINTS.post.postComment(POST_ID)), () =>
        HttpResponse.json({}, { status: 500 })
      )
    );

    const result = await renderLoggedIn(queryClient);

    act(() => {
      result.current.form.setValue('content', '실패할 댓글', { shouldDirty: true });
    });

    await act(async () => {
      await result.current.onSubmit();
    });

    await waitFor(() => expect(result.current.form.getValues('content')).toBe('실패할 댓글'));
  });

  it('키가 다른데 같은 댓글을 또 등록하면(DUPLICATE_COMMENT) 입력을 되돌리고 폼에 안내한다', async () => {
    server.use(
      http.post(url(API_ENDPOINTS.post.postComment(POST_ID)), () =>
        HttpResponse.json(
          { status: 409, code: SERVER_ERROR_CODE.DUPLICATE_COMMENT, message: 'duplicate' },
          { status: 409 }
        )
      )
    );

    const result = await renderLoggedIn(queryClient);

    act(() => {
      result.current.form.setValue('content', '방금 쓴 댓글', { shouldDirty: true });
    });

    await act(async () => {
      await result.current.onSubmit();
    });

    await waitFor(() =>
      expect(result.current.failureMessage).toBe(TEXTS.messages.error.commentSubmit.duplicate)
    );
    expect(result.current.form.getValues('content')).toBe('방금 쓴 댓글');
  });

  it.each([
    { label: '댓글', parentId: undefined, endpoint: API_ENDPOINTS.post.postComment(POST_ID) },
    {
      label: '답글',
      parentId: 'parent-comment',
      endpoint: API_ENDPOINTS.post.commentReply('parent-comment'),
    },
  ])(
    '실패로 복원된 $label을 그대로 다시 제출하면 같은 키를 쓴다',
    async ({ parentId, endpoint }) => {
      sessionStorage.clear();
      useAuthStore.getState().setAuth('test-access-token');
      const received: (string | null)[] = [];
      server.use(
        http.post(url(endpoint), ({ request }) => {
          received.push(request.headers.get(IDEMPOTENCY_KEY_HEADER));

          return HttpResponse.json({}, { status: 500 });
        })
      );
      const { result } = renderHook(() => useCreateComment({ postId: POST_ID, parentId }), {
        wrapper: createWrapper(queryClient),
      });
      await waitFor(() => expect(queryClient.getQueryData(accountKeys.root)).toEqual(mockAccount));

      act(() => {
        result.current.form.setValue('content', '다시 보낼 내용', { shouldDirty: true });
      });
      await act(async () => {
        await result.current.onSubmit();
      });
      await waitFor(() => expect(result.current.form.getValues('content')).toBe('다시 보낼 내용'));

      await act(async () => {
        await result.current.onSubmit();
      });
      await waitFor(() => expect(received).toHaveLength(2));

      expect(received[0]).toBeTruthy();
      expect(received[1]).toBe(received[0]);
    }
  );

  it('복원되기 전에 사용자가 새로 입력을 시작했다면 덮어쓰지 않는다', async () => {
    server.use(
      http.post(url(API_ENDPOINTS.post.postComment(POST_ID)), () =>
        HttpResponse.json({}, { status: 500 })
      )
    );

    const result = await renderLoggedIn(queryClient);

    act(() => {
      result.current.form.setValue('content', '실패할 댓글', { shouldDirty: true });
    });

    await act(async () => {
      await result.current.onSubmit();
    });

    // onSubmit이 반환하는 시점엔 아직 네트워크 응답 전이라 폼이 비어 있다 - 그 틈에 새로 입력한다.
    act(() => {
      result.current.form.setValue('content', '새로 쓰기 시작', { shouldDirty: true });
    });

    // 실패 응답의 onError가 실제로 처리될 시간을 준 뒤에도 덮어써지지 않았는지 확인한다.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(result.current.form.getValues('content')).toBe('새로 쓰기 시작');
  });

  it('본문이 상한을 넘으면 제출되지 않고 안내 토스트가 뜬다', async () => {
    let requested = false;
    server.use(
      http.post(url(API_ENDPOINTS.post.postComment(POST_ID)), () => {
        requested = true;
        return HttpResponse.json({}, { status: 201 });
      })
    );
    const errorSpy = vi.spyOn(toast, 'error');

    const { result } = renderHook(() => useCreateComment({ postId: POST_ID }), {
      wrapper: createWrapper(queryClient),
    });
    const overLong = '가'.repeat(Math.ceil(MAX_COMMENT_CONTENT_BYTES / 3) + 1);

    act(() => {
      result.current.form.setValue('content', overLong, { shouldDirty: true });
    });

    await act(async () => {
      await result.current.onSubmit();
    });

    expect(requested).toBe(false);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('글자 수는 한글 기준으로 세고, 상한을 넘는 순간이 isOverLimit과 같다', () => {
    const { result } = renderHook(() => useCreateComment({ postId: POST_ID }), {
      wrapper: createWrapper(queryClient),
    });
    const atLimit = '가'.repeat(MAX_COMMENT_CONTENT_HANGUL_CHARS);

    expect(result.current.contentLength).toBe(0);

    act(() => {
      result.current.form.setValue('content', atLimit, { shouldDirty: true });
    });

    expect(result.current.contentLength).toBe(MAX_COMMENT_CONTENT_HANGUL_CHARS);
    expect(result.current.isOverLimit).toBe(false);

    act(() => {
      result.current.form.setValue('content', `${atLimit}a`, { shouldDirty: true });
    });

    expect(result.current.contentLength).toBe(MAX_COMMENT_CONTENT_HANGUL_CHARS + 1);
    expect(result.current.isOverLimit).toBe(true);
  });

  it('원본 바이트는 상한 밑이어도 줄바꿈이 많아 실제 전송량이 넘으면 요청을 보내지 않는다', async () => {
    // 개행은 JSON 직렬화 시 \n(2바이트)으로 이스케이프된다 - 원본이 전부 개행에 가까우면
    // content 원본 바이트 체크(MAX_COMMENT_CONTENT_BYTES)는 통과해도 실제 전송 바이트는
    // 훨씬 커진다. 앞에 문자 하나를 둬서 trim()이 빈 문자열로 만들지 않게 한다.
    const content = `x${'\n'.repeat(5999)}`;
    expect(getUtf8ByteLength(content)).toBeLessThanOrEqual(MAX_COMMENT_CONTENT_BYTES);

    let requested = false;
    server.use(
      http.post(url(API_ENDPOINTS.post.postComment(POST_ID)), () => {
        requested = true;
        return HttpResponse.json({}, { status: 201 });
      })
    );
    const errorSpy = vi.spyOn(toast, 'error');

    const result = await renderLoggedIn(queryClient);

    act(() => {
      result.current.form.setValue('content', content, { shouldDirty: true });
    });

    await act(async () => {
      await result.current.onSubmit();
    });

    expect(requested).toBe(false);
    // 정확한 호출 횟수 대신 문구를 확인한다 - 이전 테스트의 지연된 프라미스가 늦게
    // 처리되며 별도 토스트를 얹을 수 있어(테스트 격리 이슈, 이 훅의 로직과 무관) 횟수는
    // 불안정하다.
    expect(errorSpy).toHaveBeenCalledWith(TEXTS.validation.commentPayloadTooLarge);
  });

  it('이메일 미인증 계정이면 요청을 보내지 않고 인증 필요 안내 토스트를 띄운다', async () => {
    server.use(
      http.get(url(API_ENDPOINTS.auth.account), () =>
        HttpResponse.json(
          {
            status: 200,
            message: 'ok',
            data: { ...mockAccount, emailVerified: false },
            timestamp: new Date().toISOString(),
          },
          { status: 200 }
        )
      )
    );
    let requested = false;
    server.use(
      http.post(url(API_ENDPOINTS.post.postComment(POST_ID)), () => {
        requested = true;
        return HttpResponse.json({}, { status: 201 });
      })
    );
    const errorSpy = vi.spyOn(toast, 'error');

    useAuthStore.getState().setAuth('test-access-token');
    const { result } = renderHook(() => useCreateComment({ postId: POST_ID }), {
      wrapper: createWrapper(queryClient),
    });
    await waitFor(() =>
      expect(queryClient.getQueryData(accountKeys.root)).toEqual({
        ...mockAccount,
        emailVerified: false,
      })
    );

    act(() => {
      result.current.form.setValue('content', '인증 안 된 계정의 댓글', { shouldDirty: true });
    });

    await act(async () => {
      await result.current.onSubmit();
    });

    expect(requested).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith(TEXTS.messages.error.emailVerificationRequired);
  });

  it('등록이 실패하면 원인 안내를 남기고, 입력을 고치면 지운다', async () => {
    server.use(
      http.post(url(API_ENDPOINTS.post.postComment(POST_ID)), () =>
        HttpResponse.json({}, { status: 500 })
      )
    );

    const result = await renderLoggedIn(queryClient);

    act(() => {
      result.current.form.setValue('content', '실패할 댓글', { shouldDirty: true });
    });

    await act(async () => {
      await result.current.onSubmit();
    });

    await waitFor(() =>
      expect(result.current.failureMessage).toBe(TEXTS.messages.error.commentSubmit.createFailed)
    );
    // 복원(reset)이 안내를 지우지 않았는지 - 내용과 안내가 함께 남아야 한다
    expect(result.current.form.getValues('content')).toBe('실패할 댓글');

    act(() => {
      result.current.form.setValue('content', '고친 댓글', { shouldDirty: true });
    });

    expect(result.current.failureMessage).toBeNull();
  });

  // 넣으려던 파일이 검증에 걸려 들어가지 않았으면 고친 게 없다(#491 6번)
  it('실패 뒤 첨부가 검증에 걸려 들어가지 않으면 안내를 남기고, 실제로 들어가면 지운다', async () => {
    server.use(
      http.post(url(API_ENDPOINTS.post.postComment(POST_ID)), () =>
        HttpResponse.json({}, { status: 500 })
      )
    );

    const result = await renderLoggedIn(queryClient);

    act(() => {
      result.current.form.setValue('content', '실패할 댓글', { shouldDirty: true });
    });

    await act(async () => {
      await result.current.onSubmit();
    });

    await waitFor(() =>
      expect(result.current.failureMessage).toBe(TEXTS.messages.error.commentSubmit.createFailed)
    );

    await act(async () => {
      result.current.addFiles([new File(['img'], 'scan.bmp', { type: 'image/bmp' })]);
    });

    expect(result.current.failureMessage).toBe(TEXTS.messages.error.commentSubmit.createFailed);

    act(() => {
      result.current.addFiles([new File(['img'], 'photo.png', { type: 'image/png' })]);
    });

    await waitFor(() => expect(result.current.failureMessage).toBeNull());
    expect(result.current.images).toHaveLength(1);
  });

  it('첨부 이미지까지 복원돼도 안내는 남고, 이미지를 빼면 지운다', async () => {
    // 업로드 한도(429)에 걸린 경우 - 복원된 이미지가 미리보기를 다시 만들 때 안내가 지워지면 안 된다
    server.use(
      http.post(url(API_ENDPOINTS.upload.signedUrl), () =>
        HttpResponse.json(
          { status: 429, code: 'RATE_LIMIT_EXCEEDED', message: 'too many', timestamp: '' },
          { status: 429, headers: { 'Retry-After': '1380' } }
        )
      )
    );

    const result = await renderLoggedIn(queryClient);

    act(() => {
      result.current.addFiles([new File(['img'], 'photo.png', { type: 'image/png' })]);
    });
    await waitFor(() => expect(result.current.images).toHaveLength(1));

    await act(async () => {
      await result.current.onSubmit();
    });

    await waitFor(() =>
      expect(result.current.failureMessage).toBe(
        TEXTS.messages.error.uploadSubmit.register.imageRateLimitedIn(23)
      )
    );
    expect(result.current.images).toHaveLength(1);
    // 미리보기 재생성(이미지 effect)이 끝난 뒤에도 남아 있는지 한 번 더 기다려 본다
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(result.current.failureMessage).not.toBeNull();

    act(() => {
      result.current.clearImage(0);
    });

    expect(result.current.failureMessage).toBeNull();
  });

  it('로그인이 만료돼 끝나면 비웠던 입력을 되돌리고 저장하지 못했다는 안내만 남긴다 - 실패 토스트는 없다', async () => {
    // 다시 로그인하라는 안내는 만료 정리(로그인 창·토스트)가 맡는다 - 정리가 부르는 화면 이동은 여기서 막는다
    const navigateSpy = vi.spyOn(NavigationService, 'navigate').mockImplementation(() => {});
    // toast는 셋업에서 이미 mock이라 앞 테스트의 호출이 남아 있다 - 이 테스트의 호출만 센다
    const errorSpy = vi.spyOn(toast, 'error');
    errorSpy.mockClear();
    server.use(
      http.post(url(API_ENDPOINTS.post.postComment(POST_ID)), () =>
        HttpResponse.json(
          { status: 401, code: SERVER_ERROR_CODE.TOKEN_EXPIRED, message: '', timestamp: '' },
          { status: 401 }
        )
      ),
      http.post(url(API_ENDPOINTS.auth.refresh), () =>
        HttpResponse.json(
          { status: 401, code: 'INVALID_REFRESH_TOKEN', message: '', timestamp: '' },
          { status: 401 }
        )
      )
    );

    const result = await renderLoggedIn(queryClient);

    act(() => {
      result.current.form.setValue('content', '만료 중에 쓴 댓글', { shouldDirty: true });
    });

    await act(async () => {
      await result.current.onSubmit();
    });

    await waitFor(() => expect(result.current.form.getValues('content')).toBe('만료 중에 쓴 댓글'));
    expect(result.current.failureMessage).toBe(TEXTS.messages.error.signedOutBeforeSave);
    expect(errorSpy).not.toHaveBeenCalled();
    // 쓰던 화면을 떠나지 않는다 - 로그인 페이지로 보내지 않는다
    expect(navigateSpy).not.toHaveBeenCalledWith(ROUTES_PATHS.AUTH.LOGIN, expect.anything());

    // 다시 로그인하면 안내가 사라진다 - 남으면 로그인한 뒤에도 아직 풀린 것처럼 읽힌다
    act(() => useAuthStore.getState().setAuth('test-access-token'));

    expect(result.current.failureMessage).toBeNull();
    expect(result.current.form.getValues('content')).toBe('만료 중에 쓴 댓글');

    navigateSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('등록 요청이 응답 없이 끝나면(504) 등록 여부부터 확인하라고 안내한다', async () => {
    server.use(
      http.post(url(API_ENDPOINTS.post.postComment(POST_ID)), () =>
        HttpResponse.json({}, { status: 504 })
      )
    );

    const result = await renderLoggedIn(queryClient);

    act(() => {
      result.current.form.setValue('content', '저장됐을 수도 있는 댓글', { shouldDirty: true });
    });

    await act(async () => {
      await result.current.onSubmit();
    });

    await waitFor(() =>
      expect(result.current.failureMessage).toBe(TEXTS.messages.error.commentSubmit.outcomeUnknown)
    );
  });

  it('요청 도중 폼이 닫히면 안내할 자리가 없으니 닫을 때까지 남는 토스트로 대신 알린다', async () => {
    let respond: (() => void) | null = null;
    server.use(
      http.post(url(API_ENDPOINTS.post.postComment(POST_ID)), async () => {
        await new Promise<void>((resolve) => {
          respond = resolve;
        });
        return HttpResponse.json({}, { status: 500 });
      })
    );
    const errorSpy = vi.spyOn(toast, 'error');

    useAuthStore.getState().setAuth('test-access-token');
    const { result, unmount } = renderHook(() => useCreateComment({ postId: POST_ID }), {
      wrapper: createWrapper(queryClient),
    });
    await waitFor(() => expect(queryClient.getQueryData(accountKeys.root)).toEqual(mockAccount));

    act(() => {
      result.current.form.setValue('content', '닫힌 뒤 실패할 댓글', { shouldDirty: true });
    });

    await act(async () => {
      await result.current.onSubmit();
    });

    // 요청이 서버(핸들러)에 닿은 뒤에 폼을 닫고 실패 응답을 돌려준다
    await waitFor(() => expect(respond).not.toBeNull());
    unmount();
    respond!();

    await waitFor(() => expect(errorSpy).toHaveBeenCalled());
    // 원인을 가려내지 못한 실패라 제목과 겹치는 "일시적인 문제로 등록하지 못했어요" 대신 할 일만 남긴다
    expectLeftFormFailureToast(errorSpy, {
      title: TEXTS.messages.error.leftPageFailure.commentCreateTitle,
      key: `comment-create:${POST_ID}:root`,
      description: TEXTS.messages.error.leftPageFailure.retryLater,
    });
  });

  it('폼을 닫은 뒤 다시 보낸 요청까지 응답을 못 받으면 실패라고 단정하지 않는 제목으로 알린다', async () => {
    const queryClient = createTestQueryClient({ gcTime: Infinity });
    let respond: (() => void) | null = null;
    server.use(
      http.post(url(API_ENDPOINTS.post.postComment(POST_ID)), async () => {
        await new Promise<void>((resolve) => {
          respond = resolve;
        });
        // 다시 보낸 요청은 붙잡지 않고 바로 끊는다
        server.use(
          http.post(url(API_ENDPOINTS.post.postComment(POST_ID)), () => HttpResponse.error())
        );

        return HttpResponse.error();
      })
    );
    const errorSpy = vi.spyOn(toast, 'error');

    useAuthStore.getState().setAuth('test-access-token');
    const { result, unmount } = renderHook(() => useCreateComment({ postId: POST_ID }), {
      wrapper: createWrapper(queryClient),
    });
    await waitFor(() => expect(queryClient.getQueryData(accountKeys.root)).toEqual(mockAccount));

    act(() => {
      result.current.form.setValue('content', '닫힌 뒤 끊길 댓글', { shouldDirty: true });
    });

    await act(async () => {
      await result.current.onSubmit();
    });

    await waitFor(() => expect(respond).not.toBeNull());
    unmount();
    respond!();

    // 다시 보낸 요청이 끝난 뒤에 뜬다 - 앞선 테스트의 호출 기록이 남아 있어 제목까지 보고 기다린다
    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith(
        TEXTS.messages.error.leftPageFailure.outcomeUnknownTitle,
        expect.anything()
      )
    );
    expectLeftFormFailureToast(errorSpy, {
      title: TEXTS.messages.error.leftPageFailure.outcomeUnknownTitle,
      key: `comment-create:${POST_ID}:root`,
      // 설명은 문장마다 줄을 나눠 그려 문장 사이 공백이 없다
      description: TEXTS.messages.error.commentSubmit.outcomeUnknown.replace('. ', '.'),
    });
  });

  it('다른 화면으로 떠나는 중 그 화면을 불러오는 동안 실패해도 폼 대신 토스트로 알린다', async () => {
    let respond: (() => void) | null = null;
    server.use(
      http.post(url(API_ENDPOINTS.post.postComment(POST_ID)), async () => {
        await new Promise<void>((resolve) => {
          respond = resolve;
        });
        return HttpResponse.json({}, { status: 500 });
      })
    );
    const errorSpy = vi.spyOn(toast, 'error');
    // 처음 가는 화면의 청크를 받는 동안을 붙잡아 둔다 - 그동안 이전 화면(댓글 폼)이 마운트된 채 남는다
    const LazyBookmark = lazy(() => new Promise<{ default: () => JSX.Element }>(() => {}));
    let hook!: ReturnType<typeof useCreateComment>;

    function CommentFormHarness() {
      hook = useCreateComment({ postId: POST_ID });

      return <div data-testid="comment-form" />;
    }

    // 운영처럼 화면마다 같은 자리의 Suspense로 감싼다(app/routes/index.tsx의 withSuspense) - 그래야 다음 화면이
    // suspend하는 동안 이전 화면이 남는다(useCreatePost.guard.test.tsx와 같은 구성)
    const router = createMemoryRouter(
      [
        {
          element: <Outlet />,
          children: [
            {
              path: `${ROUTES_PATHS.POST.ROOT}/:id`,
              element: (
                <Suspense fallback={null}>
                  <CommentFormHarness />
                </Suspense>
              ),
            },
            {
              path: ROUTES_PATHS.BOOKMARK,
              element: (
                <Suspense fallback={null}>
                  <LazyBookmark />
                </Suspense>
              ),
            },
          ],
        },
      ],
      { initialEntries: [`${ROUTES_PATHS.POST.ROOT}/${POST_ID}`] }
    );
    RouterEvents.setSource(router);

    useAuthStore.getState().setAuth('test-access-token');
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} future={{ v7_startTransition: true }} />
      </QueryClientProvider>
    );
    await waitFor(() => expect(queryClient.getQueryData(accountKeys.root)).toEqual(mockAccount));

    act(() => {
      hook.form.setValue('content', '떠나는 중 실패할 댓글', { shouldDirty: true });
    });

    await act(async () => {
      await hook.onSubmit();
    });

    await waitFor(() => expect(respond).not.toBeNull());

    act(() => {
      void router.navigate(ROUTES_PATHS.BOOKMARK);
    });

    // 라우터는 이미 북마크에 가 있지만 화면은 아직 댓글 폼이다(정지 구간)
    await waitFor(() => expect(router.state.location.pathname).toBe(ROUTES_PATHS.BOOKMARK));
    expect(screen.getByTestId('comment-form')).toBeInTheDocument();

    respond!();

    await waitFor(() => expect(errorSpy).toHaveBeenCalled());
    expectLeftFormFailureToast(errorSpy, {
      title: TEXTS.messages.error.leftPageFailure.commentCreateTitle,
      key: `comment-create:${POST_ID}:root`,
      description: TEXTS.messages.error.leftPageFailure.retryLater,
    });
    expect(hook.failureMessage).toBeNull();
  });
});
