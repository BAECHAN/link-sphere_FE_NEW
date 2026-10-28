import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createTestQueryClient } from '@/test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { type ReactNode } from 'react';
import { useUpdatePost } from '@/features/post/update/hooks/useUpdatePost';
import { postKeys } from '@/entities/post/api/post.keys';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { accountKeys } from '@/entities/account/api/account.keys';
import { mockAccount } from '@/mocks/fixtures/account.fixtures';
import { useAuthStore } from '@/shared/store/auth.store';
import { SERVER_ERROR_CODE } from '@/shared/config/error-code';
import { TEXTS } from '@/shared/config/texts';
import { NavigationService } from '@/shared/lib/router/navigation';
import { SIGNED_OUT_IN_PLACE_DIALOG_STATE } from '@/shared/store/loginDialog.store';

const goBackSpy = vi.fn();

vi.mock('@/shared/hooks/useGoBack', () => ({ useGoBack: () => goBackSpy }));

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

describe('useUpdatePost', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    goBackSpy.mockClear();
    // 저장은 로그인 상태에서만 보낸다(useAuthGuard) - 셋업이 테스트마다 로그인 상태를 지운다
    useAuthStore.getState().setAuth('test-access-token');
    queryClient = createTestQueryClient({ staleTime: Infinity });
    queryClient.setQueryData(postKeys.detail(mockPost.id), mockPost);
  });

  it('폼을 처음 열었을 때 카테고리·제목이 게시글 값 그대로 유지된다', async () => {
    const { result } = renderHook(() => useUpdatePost(mockPost.id), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.form.getValues('url')).toBe(mockPost.url));

    expect(result.current.form.getValues('title')).toBe(mockPost.title);
    expect(result.current.form.getValues('categoryIds')).toEqual(
      mockPost.categories?.map((c) => String(c.id))
    );
  });

  it('고치던 중에 글을 다시 불러와도(다시 로그인한 뒤 재조회 등) 고친 값을 덮지 않는다', async () => {
    const { result } = renderHook(() => useUpdatePost(mockPost.id), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.form.getValues('title')).toBe(mockPost.title));

    act(() => {
      result.current.form.setValue('title', '고치던 제목', { shouldDirty: true });
    });

    await waitFor(() => expect(result.current.form.formState.isDirty).toBe(true));

    act(() => {
      queryClient.setQueryData(postKeys.detail(mockPost.id), {
        ...mockPost,
        title: '서버에서 다시 받은 제목',
      });
    });

    await waitFor(() => expect(result.current.form.getValues('title')).toBe('고치던 제목'));
  });

  it('고치던 중에 다른 글의 수정 화면으로 바뀌면 그 글 값으로 폼을 맞춘다', async () => {
    // 같은 라우트라 PostEditPage가 폼을 다시 마운트하지 않는다 - 이전 글의 고친 값이 다른 글로 저장되면 안 된다
    const otherPost = { ...mockPost, id: 'post-other', title: '다른 글 제목' };
    const { result, rerender } = renderHook(({ postId }) => useUpdatePost(postId), {
      wrapper: createWrapper(queryClient),
      initialProps: { postId: mockPost.id },
    });

    await waitFor(() => expect(result.current.form.getValues('title')).toBe(mockPost.title));

    act(() => {
      result.current.form.setValue('title', '고치던 제목', { shouldDirty: true });
    });

    await waitFor(() => expect(result.current.form.formState.isDirty).toBe(true));

    // gcTime 0이라 관찰자가 붙기 직전에 넣는다 - 먼저 넣으면 정리돼 목 서버의 기본 글을 받는다
    queryClient.setQueryData(postKeys.detail(otherPost.id), otherPost);
    rerender({ postId: otherPost.id });

    await waitFor(() => expect(result.current.form.getValues('title')).toBe(otherPost.title));
  });

  it('고치기 전이면 다시 불러온 글 값으로 폼을 맞춘다', async () => {
    const { result } = renderHook(() => useUpdatePost(mockPost.id), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.form.getValues('title')).toBe(mockPost.title));

    act(() => {
      queryClient.setQueryData(postKeys.detail(mockPost.id), {
        ...mockPost,
        title: '서버에서 다시 받은 제목',
      });
    });

    await waitFor(() =>
      expect(result.current.form.getValues('title')).toBe('서버에서 다시 받은 제목')
    );
  });

  it('사용자가 URL을 실제로 변경하면 제목·카테고리가 비워진다', async () => {
    const { result } = renderHook(() => useUpdatePost(mockPost.id), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.form.getValues('url')).toBe(mockPost.url));
    expect(result.current.form.getValues('categoryIds')?.length).toBeGreaterThan(0);

    act(() => {
      result.current.form.setValue('url', 'https://example.com/another-article', {
        shouldDirty: true,
      });
    });

    await waitFor(() => expect(result.current.form.getValues('title')).toBe(''));
    expect(result.current.form.getValues('categoryIds')).toEqual([]);
  });

  it('수정이 성공한 뒤에만 이전 화면으로 돌아간다', async () => {
    const { result } = renderHook(() => useUpdatePost(mockPost.id), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.form.getValues('url')).toBe(mockPost.url));

    act(() => {
      result.current.form.setValue('title', '고친 제목', {
        shouldDirty: true,
        shouldValidate: true,
      });
    });
    await act(async () => {
      await result.current.onSubmit();
    });

    expect(goBackSpy).toHaveBeenCalledTimes(1);
  });

  it('수정이 실패하면 돌아가지 않고 고친 값을 그대로 남긴다', async () => {
    server.use(
      http.patch(url(`${API_ENDPOINTS.post.base}/:id`), () =>
        HttpResponse.json(
          { status: 500, code: 'INTERNAL_SERVER_ERROR', message: 'boom' },
          { status: 500 }
        )
      )
    );
    const { result } = renderHook(() => useUpdatePost(mockPost.id), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.form.getValues('url')).toBe(mockPost.url));

    act(() => {
      result.current.form.setValue('title', '고친 제목', {
        shouldDirty: true,
        shouldValidate: true,
      });
    });
    await act(async () => {
      await result.current.onSubmit();
    });

    expect(goBackSpy).not.toHaveBeenCalled();
    expect(result.current.form.getValues('title')).toBe('고친 제목');
  });

  it('로그인이 풀린 채 그 화면에 머물다 누르면 보내지 않고 그 이유의 로그인 창을 연다', async () => {
    // useCreatePost.test.tsx의 같은 케이스와 같은 상황
    const dialogSpy = vi.spyOn(NavigationService, 'navigate').mockImplementation(() => {});
    let requestCount = 0;
    server.use(
      http.patch(url(`${API_ENDPOINTS.post.base}/:id`), () => {
        requestCount += 1;
        return HttpResponse.json({ status: 200, message: 'ok', data: null });
      })
    );
    const { result } = renderHook(() => useUpdatePost(mockPost.id), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.form.getValues('url')).toBe(mockPost.url));

    act(() => {
      useAuthStore.getState().expireSession(`/post/edit/${mockPost.id}`);
      result.current.form.setValue('title', '고친 제목', {
        shouldDirty: true,
        shouldValidate: true,
      });
    });
    await act(async () => {
      await result.current.onSubmit();
    });

    expect(requestCount).toBe(0);
    expect(dialogSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ state: SIGNED_OUT_IN_PLACE_DIALOG_STATE.expired })
    );
    expect(goBackSpy).not.toHaveBeenCalled();
    expect(result.current.form.getValues('title')).toBe('고친 제목');

    dialogSpy.mockRestore();
  });

  it('저장하는 사이 로그인이 만료되면 고친 값을 남기고 저장하지 못했다는 안내를 띄운다', async () => {
    // 만료 정리(AuthUtil.applySessionExpired)가 여는 로그인 창의 이동은 여기서 막는다
    const dialogSpy = vi.spyOn(NavigationService, 'navigate').mockImplementation(() => {});
    server.use(
      http.patch(url(`${API_ENDPOINTS.post.base}/:id`), () =>
        HttpResponse.json(
          { status: 401, code: SERVER_ERROR_CODE.TOKEN_EXPIRED, message: '' },
          { status: 401 }
        )
      ),
      http.post(url(API_ENDPOINTS.auth.refresh), () =>
        HttpResponse.json(
          { status: 401, code: 'INVALID_REFRESH_TOKEN', message: '' },
          { status: 401 }
        )
      )
    );
    const { result } = renderHook(() => useUpdatePost(mockPost.id), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.form.getValues('url')).toBe(mockPost.url));

    act(() => {
      result.current.form.setValue('title', '고친 제목', {
        shouldDirty: true,
        shouldValidate: true,
      });
    });
    await act(async () => {
      await result.current.onSubmit();
    });

    expect(goBackSpy).not.toHaveBeenCalled();
    expect(result.current.form.getValues('title')).toBe('고친 제목');
    expect(result.current.submitError?.message).toBe(TEXTS.messages.error.signedOutBeforeSave);

    // 다시 로그인하면 안내가 사라진다(useCreatePost.test.tsx와 같은 이유)
    act(() => useAuthStore.getState().setAuth('test-access-token'));

    expect(result.current.submitError).toBeNull();

    dialogSpy.mockRestore();
  });

  it('URL을 원래 값 그대로 두면 미리보기를 묻지 않고, 바꾸면 그때 묻는다', async () => {
    queryClient.setQueryData(accountKeys.root, mockAccount);
    const requestedUrls: string[] = [];
    server.use(
      http.get(url(API_ENDPOINTS.post.linkPreview), ({ request }) => {
        requestedUrls.push(new URL(request.url).searchParams.get('url') ?? '');
        return HttpResponse.json({
          status: 200,
          message: 'ok',
          data: { url: 'https://example.com/another-article', title: '새 링크' },
        });
      })
    );
    const { result } = renderHook(() => useUpdatePost(mockPost.id), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.form.getValues('url')).toBe(mockPost.url));
    // 디바운스(0.5초)가 지나도 원래 URL로는 묻지 않는다
    await new Promise((resolve) => setTimeout(resolve, 700));

    expect(requestedUrls).toEqual([]);
    expect(result.current.linkPreview.status).toBe('idle');

    act(() => {
      result.current.form.setValue('url', 'https://example.com/another-article', {
        shouldDirty: true,
      });
    });

    await waitFor(() => expect(result.current.linkPreview.status).toBe('ready'));
    expect(requestedUrls).toEqual(['https://example.com/another-article']);
  });
});
