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
