import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createTestQueryClient } from '@/test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { type ReactNode } from 'react';
import { useCreateComment } from '@/features/comment/create/hooks/useCreateComment';
import { useAuthStore } from '@/shared/store/auth.store';
import { accountKeys } from '@/entities/account/api/account.keys';
import { mockAccount } from '@/mocks/fixtures/account.fixtures';
import { server } from '@/mocks/server';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { MAX_COMMENT_CONTENT_BYTES } from '@/entities/comment/config/comment.const';
import { getUtf8ByteLength } from '@/shared/lib/content/textBytes';
import { toast } from '@/shared/lib/toast/toast';
import { TEXTS } from '@/shared/config/texts';

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

  it('요청 도중 폼이 닫히면 안내할 자리가 없으니 토스트로 대신 알린다', async () => {
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

    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith(TEXTS.messages.error.commentSubmit.createFailed)
    );
  });
});
