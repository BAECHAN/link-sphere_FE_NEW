import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { queryClient } from '@/shared/lib/react-query/config/queryClient';
import { postKeys } from '@/entities/post/api/post.keys';
import { folderKeys } from '@/entities/folder/api/folder.keys';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import type { Post } from '@/entities/post/model/post.schema';
import { useCreatePostMutation, useUpdatePostMutation } from '@/entities/post/api/post.queries';

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

function Wrapper({ children }: { children: ReactNode }) {
  // 캐시 갱신이 싱글톤 queryClient를 직접 조작하므로 동일 인스턴스를 provider로 사용
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const POST_ID = mockPost.id;
const FOLDER_POSTS_KEY = folderKeys.posts('folder-uuid-1');

/** URL을 바꿔 저장했을 때 서버가 새 링크 기준으로 다시 만들어 돌려주는 응답 */
const updatedPost: Post = {
  ...mockPost,
  url: 'https://example.com/changed',
  title: 'Changed Title',
  description: 'Changed description',
};

describe('useUpdatePostMutation', () => {
  beforeEach(() => {
    queryClient.clear();
    queryClient.setQueryData(postKeys.detail(POST_ID), mockPost);
    queryClient.setQueryData(FOLDER_POSTS_KEY, {
      pages: [
        { page: 0, size: 10, content: [mockPost], totalElements: 1, totalPages: 1, last: true },
      ],
      pageParams: [0],
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('수정 성공 시 서버가 반환한 내용으로 post.detail 캐시를 교체한다', async () => {
    server.use(
      http.patch(url(`${API_ENDPOINTS.post.base}/${POST_ID}`), () =>
        HttpResponse.json({ status: 200, message: 'ok', data: updatedPost, timestamp: '' })
      )
    );

    const { result } = renderHook(() => useUpdatePostMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ url: updatedPost.url, title: '', isPrivate: false });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cached = queryClient.getQueryData<Post>(postKeys.detail(POST_ID));
    expect(cached?.url).toBe(updatedPost.url);
    expect(cached?.title).toBe(updatedPost.title);
  });

  it('수정 성공 시 북마크 폴더의 게시글 목록 캐시를 무효화한다', async () => {
    server.use(
      http.patch(url(`${API_ENDPOINTS.post.base}/${POST_ID}`), () =>
        HttpResponse.json({ status: 200, message: 'ok', data: updatedPost, timestamp: '' })
      )
    );

    expect(queryClient.getQueryState(FOLDER_POSTS_KEY)?.isInvalidated).toBe(false);

    const { result } = renderHook(() => useUpdatePostMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ url: updatedPost.url, title: '', isPrivate: false });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // 북마크 목록은 post 키와 별도 캐시라, 무효화되지 않으면 옛 내용이 그대로 보인다
    await waitFor(() =>
      expect(queryClient.getQueryState(FOLDER_POSTS_KEY)?.isInvalidated).toBe(true)
    );
  });
});

describe('useCreatePostMutation', () => {
  const newPost: Post = {
    ...mockPost,
    id: 'post-uuid-new',
    url: 'https://example.com/new-article',
    title: 'New Article',
  };

  const createPayload = {
    url: newPost.url,
    title: undefined,
    categoryIds: [],
    isPrivate: false,
    bookmark: false,
    folderIds: [],
  };

  beforeEach(() => {
    queryClient.clear();
    server.use(
      http.post(url(API_ENDPOINTS.post.base), () =>
        HttpResponse.json({ status: 201, message: 'ok', data: newPost, timestamp: '' })
      )
    );
  });

  afterEach(() => {
    queryClient.clear();
  });

  // 등록 폼이 mutate 완료를 기다리지 않고 즉시 피드로 navigate하는 fire-and-forget 흐름이라
  // (useCreatePost.onSubmit), 피드의 목록 쿼리가 등록 완료 전에 먼저 fetch를 시작해버려
  // invalidateQueries만으로는 새 글이 누락될 수 있다 — 그래서 캐시에 직접 꽂아 넣는다.
  it('등록 성공 시 필터 없는 목록 캐시 맨 앞에 새 글을 꽂아 넣는다', async () => {
    queryClient.setQueryData(postKeys.list(), {
      pages: [
        { page: 0, size: 10, content: [mockPost], totalElements: 1, totalPages: 1, last: true },
      ],
      pageParams: [0],
    });

    const { result } = renderHook(() => useCreatePostMutation(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate(createPayload);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cached = queryClient.getQueryData<{
      pages: { content: Post[]; totalElements: number }[];
    }>(postKeys.list());
    expect(cached?.pages[0]?.content.map((post) => post.id)).toEqual([newPost.id, mockPost.id]);
    expect(cached?.pages[0]?.totalElements).toBe(2);
  });

  it('필터가 걸린 목록 캐시는 건드리지 않는다', async () => {
    const filteredKey = postKeys.list({ search: 'keyword' });
    queryClient.setQueryData(filteredKey, {
      pages: [
        { page: 0, size: 10, content: [mockPost], totalElements: 1, totalPages: 1, last: true },
      ],
      pageParams: [0],
    });

    const { result } = renderHook(() => useCreatePostMutation(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate(createPayload);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cached = queryClient.getQueryData<{ pages: { content: Post[] }[] }>(filteredKey);
    expect(cached?.pages[0]?.content.map((post) => post.id)).toEqual([mockPost.id]);
  });
});
