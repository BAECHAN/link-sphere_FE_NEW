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
import { server } from '@/mocks/server';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { MAX_COMMENT_CONTENT_BYTES } from '@/entities/comment/config/const';
import { getUtf8ByteLength } from '@/shared/lib/content/textBytes';
import { TEXTS } from '@/shared/config/texts';

// 기본 commentHandlers는 API_BASE_URL 접두사(/api) 없이 등록돼 있어 테스트 환경 요청 경로와
// 매칭되지 않는다(CommentQueries.test.tsx와 동일한 이유) - url()로 명시 등록.
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
  });

  it('편집을 시작하면 원본 댓글 내용으로 초기화된다', () => {
    const { result } = renderHook(
      () => useUpdateComment({ comment: mockComment, postId: mockComment.postId }),
      {
        wrapper: createWrapper(queryClient),
      }
    );

    expect(result.current.form.getValues('content')).toBe(mockComment.content);
    expect(result.current.canSubmit).toBe(true);
  });

  it('본문과 이미지가 모두 없으면 canSubmit이 false가 된다', () => {
    const { result } = renderHook(
      () => useUpdateComment({ comment: mockComment, postId: mockComment.postId }),
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
      () => useUpdateComment({ comment: mockComment, postId: mockComment.postId }),
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
      () => useUpdateComment({ comment: mockComment, postId: mockComment.postId }),
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
      () => useUpdateComment({ comment: mockComment, postId: mockComment.postId }),
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
      () => useUpdateComment({ comment: mockComment, postId: mockComment.postId, onSuccess }),
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
});
