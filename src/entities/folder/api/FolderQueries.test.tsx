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
import type { FolderListResponse } from '@/entities/folder/model/folder.schema';
import { useMoveBookmarkMutation } from '@/entities/folder/api/folder.queries';

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

const okResponse = () =>
  HttpResponse.json({ status: 200, message: 'ok', data: null, timestamp: '' }, { status: 200 });

function Wrapper({ children }: { children: ReactNode }) {
  // 옵티미스틱 업데이트가 싱글톤 queryClient를 직접 조작하므로 동일 인스턴스를 provider로 사용
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const POST_ID = mockPost.id;
const FOLDER_ID = 'folder-uuid-1';

const seedFolderList: FolderListResponse = {
  folders: [
    {
      id: FOLDER_ID,
      name: '읽을거리',
      sortOrder: 0,
      bookmarkCount: 2,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
    },
  ],
  // 현재 미분류(bookmarkFolderId = null)인 seededPost 1건을 반영
  uncategorizedCount: 1,
};

describe('useMoveBookmarkMutation', () => {
  beforeEach(() => {
    queryClient.clear();
    // 현재 미분류(bookmarkFolderId = null) 상태인 북마크된 포스트를 캐시에 주입
    const seededPost: Post = {
      ...mockPost,
      userInteractions: { isLiked: false, isBookmarked: true, bookmarkFolderId: null },
    };
    queryClient.setQueryData(postKeys.detail(POST_ID), seededPost);
    queryClient.setQueryData(folderKeys.list, seedFolderList);
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('폴더로 이동 시 PATCH /bookmark/{postId}/folder를 호출하고 성공한다', async () => {
    let receivedBody: unknown;
    server.use(
      http.patch(url(API_ENDPOINTS.bookmark.moveBookmark(POST_ID)), async ({ request }) => {
        receivedBody = await request.json();
        return okResponse();
      })
    );

    const { result } = renderHook(() => useMoveBookmarkMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ folderId: FOLDER_ID });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(receivedBody).toEqual({ folderId: FOLDER_ID });
  });

  it('옵티미스틱 업데이트로 post.detail과 folder.list 캐시를 즉시 갱신한다', async () => {
    server.use(http.patch(url(API_ENDPOINTS.bookmark.moveBookmark(POST_ID)), () => okResponse()));

    const { result } = renderHook(() => useMoveBookmarkMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ folderId: FOLDER_ID });
    });

    // post.detail: bookmarkFolderId가 대상 폴더로 즉시 변경
    await waitFor(() => {
      const post = queryClient.getQueryData<Post>(postKeys.detail(POST_ID));
      expect(post?.userInteractions.bookmarkFolderId).toBe(FOLDER_ID);
      expect(post?.userInteractions.isBookmarked).toBe(true);
    });

    // folder.list: 대상 폴더 bookmarkCount 증가 (2 → 3), 미분류 감소 (1 → 0)
    const folders = queryClient.getQueryData<FolderListResponse>(folderKeys.list);
    expect(folders?.folders.find((f) => f.id === FOLDER_ID)?.bookmarkCount).toBe(3);
    expect(folders?.uncategorizedCount).toBe(0);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('서버 에러 시 옵티미스틱 변경을 롤백한다', async () => {
    server.use(
      http.patch(url(API_ENDPOINTS.bookmark.moveBookmark(POST_ID)), () =>
        HttpResponse.json(
          { status: 404, code: 'BOOKMARK_NOT_FOUND', message: 'not found', timestamp: '' },
          { status: 404 }
        )
      )
    );

    const { result } = renderHook(() => useMoveBookmarkMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ folderId: FOLDER_ID });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    // 롤백 확인: post.detail은 다시 미분류(null), folder.list bookmarkCount/미분류는 원복
    const post = queryClient.getQueryData<Post>(postKeys.detail(POST_ID));
    expect(post?.userInteractions.bookmarkFolderId).toBe(null);
    const folders = queryClient.getQueryData<FolderListResponse>(folderKeys.list);
    expect(folders?.folders.find((f) => f.id === FOLDER_ID)?.bookmarkCount).toBe(2);
    expect(folders?.uncategorizedCount).toBe(1);
  });

  it('post.detail 캐시가 없어도 folder 게시글 캐시에서 원본 폴더를 찾아 카운트를 감소시킨다', async () => {
    // 북마크 화면 재현: post.detail 없음, 카드는 folder 게시글 캐시에서만 옴
    queryClient.removeQueries({ queryKey: postKeys.detail(POST_ID) });

    const SOURCE_ID = 'folder-uuid-source';
    const TARGET_ID = 'folder-uuid-target';
    const now = new Date('2025-01-01');
    queryClient.setQueryData<FolderListResponse>(folderKeys.list, {
      folders: [
        {
          id: SOURCE_ID,
          name: 'AI',
          sortOrder: 0,
          bookmarkCount: 1,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: TARGET_ID,
          name: '호주',
          sortOrder: 1,
          bookmarkCount: 4,
          createdAt: now,
          updatedAt: now,
        },
      ],
      uncategorizedCount: 0,
    });

    const postInSource: Post = {
      ...mockPost,
      userInteractions: { isLiked: false, isBookmarked: true, bookmarkFolderId: SOURCE_ID },
    };
    queryClient.setQueryData(folderKeys.posts(SOURCE_ID, 'latest', ''), {
      pages: [
        { page: 0, size: 10, content: [postInSource], totalElements: 1, totalPages: 1, last: true },
      ],
      pageParams: [0],
    });

    server.use(http.patch(url(API_ENDPOINTS.bookmark.moveBookmark(POST_ID)), () => okResponse()));

    const { result } = renderHook(() => useMoveBookmarkMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ folderId: TARGET_ID });
    });

    // 원본 폴더 -1, 대상 폴더 +1 (기존엔 원본이 감소하지 않던 버그)
    await waitFor(() => {
      const folders = queryClient.getQueryData<FolderListResponse>(folderKeys.list);
      expect(folders?.folders.find((f) => f.id === SOURCE_ID)?.bookmarkCount).toBe(0);
      expect(folders?.folders.find((f) => f.id === TARGET_ID)?.bookmarkCount).toBe(5);
    });
  });

  it('폴더 → 미분류 이동 시 폴더 카운트 감소 + uncategorizedCount 증가', async () => {
    // seededPost를 폴더에 소속시킨 상태로 재설정
    const postInFolder: Post = {
      ...mockPost,
      userInteractions: { isLiked: false, isBookmarked: true, bookmarkFolderId: FOLDER_ID },
    };
    queryClient.setQueryData(postKeys.detail(POST_ID), postInFolder);
    queryClient.setQueryData<FolderListResponse>(folderKeys.list, seedFolderList);

    server.use(http.patch(url(API_ENDPOINTS.bookmark.moveBookmark(POST_ID)), () => okResponse()));

    const { result } = renderHook(() => useMoveBookmarkMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ folderId: null });
    });

    // 폴더 2 → 1, 미분류 1 → 2
    await waitFor(() => {
      const folders = queryClient.getQueryData<FolderListResponse>(folderKeys.list);
      expect(folders?.folders.find((f) => f.id === FOLDER_ID)?.bookmarkCount).toBe(1);
      expect(folders?.uncategorizedCount).toBe(2);
    });
  });
});
