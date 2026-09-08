import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { createTestQueryClient } from '@/test/utils';
import { postKeys } from '@/entities/post/api/post.keys';
import { bookmarkFolderKeys } from '@/entities/bookmark/folder/api/bookmark-folder.keys';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import type { Post } from '@/entities/post/model/post.schema';
import type { BookmarkFolderListResponse } from '@/entities/bookmark/folder/model/bookmark-folder.schema';
import { useBookmarkPostMutation } from '@/entities/interaction/api/interaction.queries';

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

// setQueryData로 캐시를 심고 나중에 getQueryData로 검증하므로 gcTime: Infinity가 필요하다
// (createTestQueryClient 참고).
let queryClient: QueryClient;

function Wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

const POST_ID = mockPost.id;
const FOLDER_A = 'folder-uuid-a';
const FOLDER_B = 'folder-uuid-b';
const now = new Date('2025-01-01');

const seedFolderList = (
  overrides: Partial<BookmarkFolderListResponse> = {}
): BookmarkFolderListResponse => ({
  folders: [
    { id: FOLDER_A, name: '개발', sortOrder: 0, bookmarkCount: 2, createdAt: now, updatedAt: now },
    {
      id: FOLDER_B,
      name: '나중에 읽기',
      sortOrder: 1,
      bookmarkCount: 4,
      createdAt: now,
      updatedAt: now,
    },
  ],
  uncategorizedCount: 1,
  ...overrides,
});

beforeEach(() => {
  queryClient = createTestQueryClient({ gcTime: Infinity });
  // 기본 postHandlers 의 토글 핸들러는 API_BASE_URL 접두사(/api) 없이 등록돼 있어
  // 테스트 환경(VITE_API_BASE_URL) 요청 경로와 매칭되지 않는다 — url() 로 명시 등록.
  server.use(
    http.post(
      url(API_ENDPOINTS.post.postBookmark(POST_ID)),
      () => new HttpResponse(null, { status: 204 })
    )
  );
});

describe('useBookmarkPostMutation', () => {
  it('2개 폴더에 든 글을 해제하면 두 폴더 카운트가 -1되고 bookmarkFolderIds가 비워진다', async () => {
    const seededPost: Post = {
      ...mockPost,
      userInteractions: {
        isLiked: false,
        isBookmarked: true,
        bookmarkFolderIds: [FOLDER_A, FOLDER_B],
      },
      stats: { ...mockPost.stats, bookmarkCount: 10 },
    };
    queryClient.setQueryData(postKeys.detail(POST_ID), seededPost);
    queryClient.setQueryData(bookmarkFolderKeys.list, seedFolderList());

    const { result } = renderHook(() => useBookmarkPostMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      const post = queryClient.getQueryData<Post>(postKeys.detail(POST_ID));
      expect(post?.userInteractions.isBookmarked).toBe(false);
      expect(post?.userInteractions.bookmarkFolderIds).toEqual([]);
      expect(post?.stats.bookmarkCount).toBe(9);
    });

    const folders = queryClient.getQueryData<BookmarkFolderListResponse>(bookmarkFolderKeys.list);
    expect(folders?.folders.find((f) => f.id === FOLDER_A)?.bookmarkCount).toBe(1);
    expect(folders?.folders.find((f) => f.id === FOLDER_B)?.bookmarkCount).toBe(3);
    expect(folders?.uncategorizedCount).toBe(1); // 소속이 있었으므로 미분류는 불변

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('미분류 글을 해제하면 uncategorizedCount가 -1된다', async () => {
    const seededPost: Post = {
      ...mockPost,
      userInteractions: { isLiked: false, isBookmarked: true, bookmarkFolderIds: [] },
      stats: { ...mockPost.stats, bookmarkCount: 5 },
    };
    queryClient.setQueryData(postKeys.detail(POST_ID), seededPost);
    queryClient.setQueryData(bookmarkFolderKeys.list, seedFolderList());

    const { result } = renderHook(() => useBookmarkPostMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      const folders = queryClient.getQueryData<BookmarkFolderListResponse>(bookmarkFolderKeys.list);
      expect(folders?.uncategorizedCount).toBe(0);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('토글 ON(신규 북마크)이면 미분류로 생성되어 uncategorizedCount가 +1된다', async () => {
    const seededPost: Post = {
      ...mockPost,
      userInteractions: { isLiked: false, isBookmarked: false, bookmarkFolderIds: [] },
      stats: { ...mockPost.stats, bookmarkCount: 5 },
    };
    queryClient.setQueryData(postKeys.detail(POST_ID), seededPost);
    queryClient.setQueryData(bookmarkFolderKeys.list, seedFolderList());

    const { result } = renderHook(() => useBookmarkPostMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      const post = queryClient.getQueryData<Post>(postKeys.detail(POST_ID));
      expect(post?.userInteractions.isBookmarked).toBe(true);
      expect(post?.userInteractions.bookmarkFolderIds).toEqual([]);
      expect(post?.stats.bookmarkCount).toBe(6);
    });
    const folders = queryClient.getQueryData<BookmarkFolderListResponse>(bookmarkFolderKeys.list);
    expect(folders?.uncategorizedCount).toBe(2);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('서버 에러 시 post.detail과 folder.list를 롤백한다', async () => {
    server.use(
      http.post(url(API_ENDPOINTS.post.postBookmark(POST_ID)), () =>
        HttpResponse.json(
          { status: 500, code: 'INTERNAL_SERVER_ERROR', message: 'boom', timestamp: '' },
          { status: 500 }
        )
      )
    );

    const seededPost: Post = {
      ...mockPost,
      userInteractions: {
        isLiked: false,
        isBookmarked: true,
        bookmarkFolderIds: [FOLDER_A, FOLDER_B],
      },
      stats: { ...mockPost.stats, bookmarkCount: 10 },
    };
    queryClient.setQueryData(postKeys.detail(POST_ID), seededPost);
    queryClient.setQueryData(bookmarkFolderKeys.list, seedFolderList());

    const { result } = renderHook(() => useBookmarkPostMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    const post = queryClient.getQueryData<Post>(postKeys.detail(POST_ID));
    expect(post?.userInteractions.isBookmarked).toBe(true);
    expect(post?.userInteractions.bookmarkFolderIds).toEqual([FOLDER_A, FOLDER_B]);
    expect(post?.stats.bookmarkCount).toBe(10);

    const folders = queryClient.getQueryData<BookmarkFolderListResponse>(bookmarkFolderKeys.list);
    expect(folders?.folders.find((f) => f.id === FOLDER_A)?.bookmarkCount).toBe(2);
    expect(folders?.uncategorizedCount).toBe(1);
  });
});
