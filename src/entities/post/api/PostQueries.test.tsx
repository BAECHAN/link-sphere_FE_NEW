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
import { useUpdatePostMutation } from '@/entities/post/api/post.queries';

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
