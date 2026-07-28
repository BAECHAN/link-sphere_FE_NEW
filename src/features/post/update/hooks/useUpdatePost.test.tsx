import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createTestQueryClient } from '@/test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { type ReactNode } from 'react';
import { useUpdatePost } from '@/features/post/update/hooks/useUpdatePost';
import { postKeys } from '@/entities/post/api/post.keys';
import { mockPost } from '@/mocks/fixtures/post.fixtures';

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
    queryClient = createTestQueryClient();
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
});
