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
import type {
  BookmarkFoldersResponse,
  FolderListResponse,
} from '@/entities/folder/model/folder.schema';
import {
  useAddBookmarkFolderMutation,
  useClearBookmarkFoldersMutation,
  useRemoveBookmarkFolderMutation,
} from '@/entities/folder/api/folder.queries';

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

const okResponse = (data: BookmarkFoldersResponse) =>
  HttpResponse.json({ status: 200, message: 'ok', data, timestamp: '' }, { status: 200 });

function Wrapper({ children }: { children: ReactNode }) {
  // 옵티미스틱 업데이트가 싱글톤 queryClient를 직접 조작하므로 동일 인스턴스를 provider로 사용
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const POST_ID = mockPost.id;
const FOLDER_A = 'folder-uuid-a';
const FOLDER_B = 'folder-uuid-b';

const now = new Date('2025-01-01');
const seedFolderList: FolderListResponse = {
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
};

beforeEach(() => {
  queryClient.clear();
});

afterEach(() => {
  queryClient.clear();
});

describe('useAddBookmarkFolderMutation', () => {
  it('POST /bookmark/{postId}/folders/{folderId} 를 body 없이 호출한다', async () => {
    const seededPost: Post = {
      ...mockPost,
      userInteractions: { isLiked: false, isBookmarked: true, bookmarkFolderIds: [] },
    };
    queryClient.setQueryData(postKeys.detail(POST_ID), seededPost);
    queryClient.setQueryData(folderKeys.list, seedFolderList);

    let receivedBody = 'not-called';
    server.use(
      http.post(url(API_ENDPOINTS.bookmark.postFolder(POST_ID, FOLDER_A)), async ({ request }) => {
        receivedBody = await request.text();
        return okResponse({ postId: POST_ID, isBookmarked: true, folderIds: [FOLDER_A] });
      })
    );

    const { result } = renderHook(() => useAddBookmarkFolderMutation(POST_ID), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate(FOLDER_A);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(receivedBody).toBe('');
  });

  it('미분류 상태에서 폴더 추가 시 그 폴더 +1, uncategorizedCount -1', async () => {
    const seededPost: Post = {
      ...mockPost,
      userInteractions: { isLiked: false, isBookmarked: true, bookmarkFolderIds: [] },
    };
    queryClient.setQueryData(postKeys.detail(POST_ID), seededPost);
    queryClient.setQueryData(folderKeys.list, seedFolderList);
    server.use(
      http.post(url(API_ENDPOINTS.bookmark.postFolder(POST_ID, FOLDER_A)), () =>
        okResponse({ postId: POST_ID, isBookmarked: true, folderIds: [FOLDER_A] })
      )
    );

    const { result } = renderHook(() => useAddBookmarkFolderMutation(POST_ID), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate(FOLDER_A);
    });

    await waitFor(() => {
      const post = queryClient.getQueryData<Post>(postKeys.detail(POST_ID));
      expect(post?.userInteractions.bookmarkFolderIds).toEqual([FOLDER_A]);
    });
    const folders = queryClient.getQueryData<FolderListResponse>(folderKeys.list);
    expect(folders?.folders.find((f) => f.id === FOLDER_A)?.bookmarkCount).toBe(3);
    expect(folders?.uncategorizedCount).toBe(0);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('미북마크 글에 추가하면 북마크가 생성되고(bookmarkCount +1), 미분류를 떠난 적이 없으니 uncategorizedCount는 그대로', async () => {
    const seededPost: Post = {
      ...mockPost,
      userInteractions: { isLiked: false, isBookmarked: false, bookmarkFolderIds: [] },
      stats: { ...mockPost.stats, bookmarkCount: 5 },
    };
    queryClient.setQueryData(postKeys.detail(POST_ID), seededPost);
    queryClient.setQueryData(folderKeys.list, seedFolderList);
    server.use(
      http.post(url(API_ENDPOINTS.bookmark.postFolder(POST_ID, FOLDER_A)), () =>
        okResponse({ postId: POST_ID, isBookmarked: true, folderIds: [FOLDER_A] })
      )
    );

    const { result } = renderHook(() => useAddBookmarkFolderMutation(POST_ID), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate(FOLDER_A);
    });

    await waitFor(() => {
      const post = queryClient.getQueryData<Post>(postKeys.detail(POST_ID));
      expect(post?.userInteractions.isBookmarked).toBe(true);
      expect(post?.stats.bookmarkCount).toBe(6);
    });
    const folders = queryClient.getQueryData<FolderListResponse>(folderKeys.list);
    expect(folders?.uncategorizedCount).toBe(1); // 미분류였던 적이 없으므로 불변

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('★ 두 번째 폴더를 추가해도 첫 폴더의 카운트는 줄지 않는다 (다중 폴더 핵심)', async () => {
    const seededPost: Post = {
      ...mockPost,
      userInteractions: { isLiked: false, isBookmarked: true, bookmarkFolderIds: [FOLDER_A] },
    };
    queryClient.setQueryData(postKeys.detail(POST_ID), seededPost);
    queryClient.setQueryData(folderKeys.list, seedFolderList);
    server.use(
      http.post(url(API_ENDPOINTS.bookmark.postFolder(POST_ID, FOLDER_B)), () =>
        okResponse({ postId: POST_ID, isBookmarked: true, folderIds: [FOLDER_A, FOLDER_B] })
      )
    );

    const { result } = renderHook(() => useAddBookmarkFolderMutation(POST_ID), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate(FOLDER_B);
    });

    await waitFor(() => {
      const post = queryClient.getQueryData<Post>(postKeys.detail(POST_ID));
      expect(post?.userInteractions.bookmarkFolderIds).toEqual([FOLDER_A, FOLDER_B]);
    });
    const folders = queryClient.getQueryData<FolderListResponse>(folderKeys.list);
    expect(folders?.folders.find((f) => f.id === FOLDER_A)?.bookmarkCount).toBe(2); // 불변
    expect(folders?.folders.find((f) => f.id === FOLDER_B)?.bookmarkCount).toBe(5); // +1
    expect(folders?.uncategorizedCount).toBe(1); // 이미 폴더에 있었으니 불변

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useRemoveBookmarkFolderMutation', () => {
  it('다른 폴더도 있으면 그 폴더만 -1, 북마크·미분류는 불변', async () => {
    const seededPost: Post = {
      ...mockPost,
      userInteractions: {
        isLiked: false,
        isBookmarked: true,
        bookmarkFolderIds: [FOLDER_A, FOLDER_B],
      },
    };
    queryClient.setQueryData(postKeys.detail(POST_ID), seededPost);
    queryClient.setQueryData(folderKeys.list, seedFolderList);
    server.use(
      http.delete(url(API_ENDPOINTS.bookmark.postFolder(POST_ID, FOLDER_A)), () =>
        okResponse({ postId: POST_ID, isBookmarked: true, folderIds: [FOLDER_B] })
      )
    );

    const { result } = renderHook(() => useRemoveBookmarkFolderMutation(POST_ID), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate(FOLDER_A);
    });

    await waitFor(() => {
      const post = queryClient.getQueryData<Post>(postKeys.detail(POST_ID));
      expect(post?.userInteractions.bookmarkFolderIds).toEqual([FOLDER_B]);
      expect(post?.userInteractions.isBookmarked).toBe(true);
    });
    const folders = queryClient.getQueryData<FolderListResponse>(folderKeys.list);
    expect(folders?.folders.find((f) => f.id === FOLDER_A)?.bookmarkCount).toBe(1);
    expect(folders?.uncategorizedCount).toBe(1);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('마지막 폴더를 제거하면 uncategorizedCount +1, 북마크는 유지', async () => {
    const seededPost: Post = {
      ...mockPost,
      userInteractions: { isLiked: false, isBookmarked: true, bookmarkFolderIds: [FOLDER_A] },
    };
    queryClient.setQueryData(postKeys.detail(POST_ID), seededPost);
    queryClient.setQueryData(folderKeys.list, seedFolderList);
    server.use(
      http.delete(url(API_ENDPOINTS.bookmark.postFolder(POST_ID, FOLDER_A)), () =>
        okResponse({ postId: POST_ID, isBookmarked: true, folderIds: [] })
      )
    );

    const { result } = renderHook(() => useRemoveBookmarkFolderMutation(POST_ID), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate(FOLDER_A);
    });

    await waitFor(() => {
      const post = queryClient.getQueryData<Post>(postKeys.detail(POST_ID));
      expect(post?.userInteractions.bookmarkFolderIds).toEqual([]);
      expect(post?.userInteractions.isBookmarked).toBe(true);
    });
    const folders = queryClient.getQueryData<FolderListResponse>(folderKeys.list);
    expect(folders?.folders.find((f) => f.id === FOLDER_A)?.bookmarkCount).toBe(1);
    expect(folders?.uncategorizedCount).toBe(2);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('서버 에러 시 post.detail과 folder.list를 롤백한다', async () => {
    const seededPost: Post = {
      ...mockPost,
      userInteractions: { isLiked: false, isBookmarked: true, bookmarkFolderIds: [FOLDER_A] },
    };
    queryClient.setQueryData(postKeys.detail(POST_ID), seededPost);
    queryClient.setQueryData(folderKeys.list, seedFolderList);
    server.use(
      http.delete(url(API_ENDPOINTS.bookmark.postFolder(POST_ID, FOLDER_A)), () =>
        HttpResponse.json(
          { status: 500, code: 'INTERNAL_SERVER_ERROR', message: 'boom', timestamp: '' },
          { status: 500 }
        )
      )
    );

    const { result } = renderHook(() => useRemoveBookmarkFolderMutation(POST_ID), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate(FOLDER_A);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    const post = queryClient.getQueryData<Post>(postKeys.detail(POST_ID));
    expect(post?.userInteractions.bookmarkFolderIds).toEqual([FOLDER_A]);
    const folders = queryClient.getQueryData<FolderListResponse>(folderKeys.list);
    expect(folders?.folders.find((f) => f.id === FOLDER_A)?.bookmarkCount).toBe(2);
    expect(folders?.uncategorizedCount).toBe(1);
  });
});

describe('useClearBookmarkFoldersMutation', () => {
  it('소속돼있던 모든 폴더 -1, uncategorizedCount +1, 북마크는 유지', async () => {
    const seededPost: Post = {
      ...mockPost,
      userInteractions: {
        isLiked: false,
        isBookmarked: true,
        bookmarkFolderIds: [FOLDER_A, FOLDER_B],
      },
    };
    queryClient.setQueryData(postKeys.detail(POST_ID), seededPost);
    queryClient.setQueryData(folderKeys.list, seedFolderList);
    server.use(
      http.delete(url(API_ENDPOINTS.bookmark.postFolders(POST_ID)), () =>
        okResponse({ postId: POST_ID, isBookmarked: true, folderIds: [] })
      )
    );

    const { result } = renderHook(() => useClearBookmarkFoldersMutation(POST_ID), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      const post = queryClient.getQueryData<Post>(postKeys.detail(POST_ID));
      expect(post?.userInteractions.bookmarkFolderIds).toEqual([]);
      expect(post?.userInteractions.isBookmarked).toBe(true);
    });
    const folders = queryClient.getQueryData<FolderListResponse>(folderKeys.list);
    expect(folders?.folders.find((f) => f.id === FOLDER_A)?.bookmarkCount).toBe(1);
    expect(folders?.folders.find((f) => f.id === FOLDER_B)?.bookmarkCount).toBe(3);
    expect(folders?.uncategorizedCount).toBe(2);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
