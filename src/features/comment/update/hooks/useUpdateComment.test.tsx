import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { toast } from '@/shared/lib/toast/toast';
import { createTestQueryClient } from '@/test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { type ReactNode } from 'react';
import { useUpdateComment } from '@/features/comment/update/hooks/useUpdateComment';
import { mockComment } from '@/mocks/fixtures/comment.fixtures';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { server } from '@/mocks/server';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { MAX_COMMENT_CONTENT_BYTES } from '@/entities/comment/config/comment.const';
import { getUtf8ByteLength } from '@/shared/lib/content/textBytes';
import { TEXTS } from '@/shared/config/texts';
import { useAuthStore } from '@/shared/store/auth.store';
import { SERVER_ERROR_CODE } from '@/shared/config/error-code';
import { NavigationService } from '@/shared/lib/router/navigation';
import { SIGNED_OUT_IN_PLACE_DIALOG_STATE } from '@/shared/store/loginDialog.store';

// 기본 commentHandlers는 API_BASE_URL 접두사(/api) 없이 등록돼 있어 테스트 환경 요청 경로와
// 매칭되지 않는다(comment.queries.test.ts와 동일한 이유) - url()로 명시 등록.
const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

describe('useUpdateComment', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    // 저장은 로그인 상태에서만 보낸다(useAuthGuard) - 셋업이 테스트마다 로그인 상태를 지운다
    useAuthStore.getState().setAuth('test-access-token');
  });

  it('편집을 시작하면 원본 댓글 내용으로 초기화된다', () => {
    const { result } = renderHook(
      () => useUpdateComment({ comment: mockComment, postId: mockPost.id }),
      {
        wrapper: createWrapper(queryClient),
      }
    );

    expect(result.current.form.getValues('content')).toBe(mockComment.content);
    expect(result.current.canSubmit).toBe(true);
  });

  it('본문과 이미지가 모두 없으면 canSubmit이 false가 된다', () => {
    const { result } = renderHook(
      () => useUpdateComment({ comment: mockComment, postId: mockPost.id }),
      {
        wrapper: createWrapper(queryClient),
      }
    );

    act(() => {
      result.current.form.setValue('content', '', { shouldDirty: true });
    });

    expect(result.current.canSubmit).toBe(false);
  });

  it('본문이 상한을 넘으면 isOverLimit이 true가 되지만 canSubmit은 막지 않는다', () => {
    // canSubmit(버튼 disabled)이 길이 초과까지 막으면 클릭 이벤트 자체가 안 먹어
    // onSubmit의 zod 검증(→ 초과 안내 토스트)이 실행될 기회가 없어진다 - 그래서
    // 길이 초과는 isOverLimit(인라인 안내용)으로만 노출하고, 실제 제출 차단은
    // onSubmit 내부의 zod resolver가 담당한다.
    const { result } = renderHook(
      () => useUpdateComment({ comment: mockComment, postId: mockPost.id }),
      {
        wrapper: createWrapper(queryClient),
      }
    );

    const overLong = '가'.repeat(Math.ceil(MAX_COMMENT_CONTENT_BYTES / 3) + 1);
    act(() => {
      result.current.form.setValue('content', overLong, { shouldDirty: true });
    });

    expect(result.current.isOverLimit).toBe(true);
    expect(result.current.canSubmit).toBe(true);
  });

  it('본문이 상한을 넘은 채 제출을 시도하면 요청을 보내지 않고 안내 토스트를 띄운다', async () => {
    let requested = false;
    server.use(
      http.patch(url(API_ENDPOINTS.post.comment(mockComment.id)), () => {
        requested = true;
        return HttpResponse.json(
          { status: 200, message: 'ok', data: mockComment, timestamp: new Date().toISOString() },
          { status: 200 }
        );
      })
    );
    const errorSpy = vi.spyOn(toast, 'error');

    const { result } = renderHook(
      () => useUpdateComment({ comment: mockComment, postId: mockPost.id }),
      { wrapper: createWrapper(queryClient) }
    );

    const overLong = '가'.repeat(Math.ceil(MAX_COMMENT_CONTENT_BYTES / 3) + 1);
    act(() => {
      result.current.form.setValue('content', overLong, { shouldDirty: true });
    });

    await act(async () => {
      await result.current.onSubmit();
    });

    expect(requested).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith(expect.anything());
  });

  it('원본 바이트는 상한 밑이어도 줄바꿈이 많아 실제 전송량이 넘으면 요청을 보내지 않는다', async () => {
    // 개행은 JSON 직렬화 시 \n(2바이트)으로 이스케이프된다 - 원본이 전부 개행에 가까우면
    // content 원본 바이트 체크(MAX_COMMENT_CONTENT_BYTES)는 통과해도 실제 전송 바이트는
    // 훨씬 커진다. 앞에 문자 하나를 둬서 trim()이 빈 문자열로 만들지 않게 한다.
    const content = `x${'\n'.repeat(5999)}`;
    expect(getUtf8ByteLength(content)).toBeLessThanOrEqual(MAX_COMMENT_CONTENT_BYTES);

    let requested = false;
    server.use(
      http.patch(url(API_ENDPOINTS.post.comment(mockComment.id)), () => {
        requested = true;
        return HttpResponse.json(
          { status: 200, message: 'ok', data: mockComment, timestamp: new Date().toISOString() },
          { status: 200 }
        );
      })
    );
    const errorSpy = vi.spyOn(toast, 'error');

    const { result } = renderHook(
      () => useUpdateComment({ comment: mockComment, postId: mockPost.id }),
      { wrapper: createWrapper(queryClient) }
    );

    act(() => {
      result.current.form.setValue('content', content, { shouldDirty: true });
    });

    await act(async () => {
      await result.current.onSubmit();
    });

    expect(requested).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith(TEXTS.validation.commentPayloadTooLarge);
  });

  it('제출에 성공하면 onSuccess가 호출된다', async () => {
    server.use(
      http.patch(url(API_ENDPOINTS.post.comment(mockComment.id)), () =>
        HttpResponse.json(
          { status: 200, message: 'ok', data: mockComment, timestamp: new Date().toISOString() },
          { status: 200 }
        )
      )
    );

    const onSuccess = vi.fn();
    const { result } = renderHook(
      () => useUpdateComment({ comment: mockComment, postId: mockPost.id, onSuccess }),
      { wrapper: createWrapper(queryClient) }
    );

    act(() => {
      result.current.form.setValue('content', '수정된 내용', { shouldDirty: true });
    });

    await act(async () => {
      await result.current.onSubmit();
    });

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });

  it('삭제된 댓글을 수정하려 하면 원인 안내를 남기고 폼을 닫지 않는다', async () => {
    server.use(
      http.patch(url(API_ENDPOINTS.post.comment(mockComment.id)), () =>
        HttpResponse.json(
          { status: 409, code: 'COMMENT_DELETED', message: 'deleted', timestamp: '' },
          { status: 409 }
        )
      )
    );

    const onSuccess = vi.fn();
    const { result } = renderHook(
      () => useUpdateComment({ comment: mockComment, postId: mockPost.id, onSuccess }),
      { wrapper: createWrapper(queryClient) }
    );

    act(() => {
      result.current.form.setValue('content', '수정된 내용', { shouldDirty: true });
    });

    await act(async () => {
      await result.current.onSubmit();
    });

    expect(result.current.failureMessage).toBe(TEXTS.messages.error.commentSubmit.commentDeleted);
    expect(onSuccess).not.toHaveBeenCalled();

    act(() => {
      result.current.form.setValue('content', '다시 고친 내용', { shouldDirty: true });
    });

    expect(result.current.failureMessage).toBeNull();
  });

  it('로그인이 풀린 채 그 화면에 머물다 누르면 보내지 않고 그 이유의 로그인 창을 연다', async () => {
    // 로그인 창을 닫고 그대로 누른 경우 - 댓글·답글 등록과 같은 창이 다시 뜨고, 고친 내용은 그대로 남는다
    const dialogSpy = vi.spyOn(NavigationService, 'navigate').mockImplementation(() => {});
    let requestCount = 0;
    server.use(
      http.patch(url(API_ENDPOINTS.post.comment(mockComment.id)), () => {
        requestCount += 1;
        return HttpResponse.json({ status: 200, message: 'ok', data: null });
      })
    );
    useAuthStore.getState().expireSession(`/post/${mockPost.id}`);

    const onSuccess = vi.fn();
    const { result } = renderHook(
      () => useUpdateComment({ comment: mockComment, postId: mockPost.id, onSuccess }),
      { wrapper: createWrapper(queryClient) }
    );

    act(() => {
      result.current.form.setValue('content', '로그인이 풀린 채 고친 내용', { shouldDirty: true });
    });

    await act(async () => {
      await result.current.onSubmit();
    });

    expect(requestCount).toBe(0);
    expect(dialogSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ state: SIGNED_OUT_IN_PLACE_DIALOG_STATE.expired })
    );
    // 로그아웃된 동안에는 저장을 눌렀든 안 눌렀든 폼 안에 같은 안내가 보인다(useSignedOutNotice)
    expect(result.current.failureMessage).toBe(TEXTS.messages.error.signedOutBeforeSave);
    expect(result.current.form.getValues('content')).toBe('로그인이 풀린 채 고친 내용');
    expect(onSuccess).not.toHaveBeenCalled();

    dialogSpy.mockRestore();
  });

  it('저장하는 사이 로그인이 만료되면 고친 내용을 남기고 저장하지 못했다는 안내를 띄운다', async () => {
    // 만료 정리(AuthUtil.applySessionExpired)가 여는 로그인 창의 이동은 여기서 막는다
    const dialogSpy = vi.spyOn(NavigationService, 'navigate').mockImplementation(() => {});
    const errorSpy = vi.spyOn(toast, 'error');
    errorSpy.mockClear();
    server.use(
      http.patch(url(API_ENDPOINTS.post.comment(mockComment.id)), () =>
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

    const onSuccess = vi.fn();
    const { result } = renderHook(
      () => useUpdateComment({ comment: mockComment, postId: mockPost.id, onSuccess }),
      { wrapper: createWrapper(queryClient) }
    );

    act(() => {
      result.current.form.setValue('content', '만료 중에 고친 내용', { shouldDirty: true });
    });

    await act(async () => {
      await result.current.onSubmit();
    });

    expect(result.current.failureMessage).toBe(TEXTS.messages.error.signedOutBeforeSave);
    expect(result.current.form.getValues('content')).toBe('만료 중에 고친 내용');
    expect(onSuccess).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();

    // 다시 로그인하면 안내가 사라진다(useCreatePost.test.tsx와 같은 이유)
    act(() => useAuthStore.getState().setAuth('test-access-token'));

    expect(result.current.failureMessage).toBeNull();

    errorSpy.mockRestore();
    dialogSpy.mockRestore();
  });
});
