import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { createTestQueryClient } from '@/test/utils';
import { toast } from '@/shared/lib/toast/toast';
import { TEXTS } from '@/shared/config/texts';
import { postKeys } from '@/entities/post/api/post.keys';
import { bookmarkFolderKeys } from '@/entities/bookmark/folder/api/bookmark-folder.keys';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import type { Post } from '@/entities/post/model/post.schema';
import type {
  BookmarkFoldersResponse,
  BookmarkFolderListResponse,
} from '@/entities/bookmark/folder/model/bookmark-folder.schema';
import {
  useAddBookmarkFolderMutation,
  useClearBookmarkFoldersMutation,
  useRemoveBookmarkFolderMutation,
  useSetBookmarkFolderPinMutation,
} from '@/entities/bookmark/folder/api/bookmark-folder.queries';

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

const okResponse = (data: BookmarkFoldersResponse) =>
  HttpResponse.json({ status: 200, message: 'ok', data, timestamp: '' }, { status: 200 });

// setQueryData로 캐시를 심고 나중에 getQueryData로 검증하므로 gcTime: Infinity가 필요하다
// (createTestQueryClient 참고).
let queryClient: QueryClient;

function Wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

const POST_ID = mockPost.id;
const FOLDER_A = 'folder-uuid-a';
const FOLDER_B = 'folder-uuid-b';

const seedFolderList: BookmarkFolderListResponse = {
  folders: [
    { id: FOLDER_A, name: '개발', sortOrder: 0, bookmarkCount: 2 },
    {
      id: FOLDER_B,
      name: '나중에 읽기',
      sortOrder: 1,
      bookmarkCount: 4,
    },
  ],
  uncategorizedCount: 1,
};

beforeEach(() => {
  queryClient = createTestQueryClient({ gcTime: Infinity });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useAddBookmarkFolderMutation', () => {
  it('POST /bookmark/{postId}/folders/{folderId} 를 body 없이 호출한다', async () => {
    const seededPost: Post = {
      ...mockPost,
      userInteractions: { isLiked: false, isBookmarked: true, bookmarkFolderIds: [] },
    };
    queryClient.setQueryData(postKeys.detail(POST_ID), seededPost);
    queryClient.setQueryData(bookmarkFolderKeys.list, seedFolderList);

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
    queryClient.setQueryData(bookmarkFolderKeys.list, seedFolderList);
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
    const folders = queryClient.getQueryData<BookmarkFolderListResponse>(bookmarkFolderKeys.list);
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
    queryClient.setQueryData(bookmarkFolderKeys.list, seedFolderList);
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
    const folders = queryClient.getQueryData<BookmarkFolderListResponse>(bookmarkFolderKeys.list);
    expect(folders?.uncategorizedCount).toBe(1); // 미분류였던 적이 없으므로 불변

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('★ 두 번째 폴더를 추가해도 첫 폴더의 카운트는 줄지 않는다 (다중 폴더 핵심)', async () => {
    const seededPost: Post = {
      ...mockPost,
      userInteractions: { isLiked: false, isBookmarked: true, bookmarkFolderIds: [FOLDER_A] },
    };
    queryClient.setQueryData(postKeys.detail(POST_ID), seededPost);
    queryClient.setQueryData(bookmarkFolderKeys.list, seedFolderList);
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
    const folders = queryClient.getQueryData<BookmarkFolderListResponse>(bookmarkFolderKeys.list);
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
    queryClient.setQueryData(bookmarkFolderKeys.list, seedFolderList);
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
    const folders = queryClient.getQueryData<BookmarkFolderListResponse>(bookmarkFolderKeys.list);
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
    queryClient.setQueryData(bookmarkFolderKeys.list, seedFolderList);
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
    const folders = queryClient.getQueryData<BookmarkFolderListResponse>(bookmarkFolderKeys.list);
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
    queryClient.setQueryData(bookmarkFolderKeys.list, seedFolderList);
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
    const folders = queryClient.getQueryData<BookmarkFolderListResponse>(bookmarkFolderKeys.list);
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
    queryClient.setQueryData(bookmarkFolderKeys.list, seedFolderList);
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
    const folders = queryClient.getQueryData<BookmarkFolderListResponse>(bookmarkFolderKeys.list);
    expect(folders?.folders.find((f) => f.id === FOLDER_A)?.bookmarkCount).toBe(1);
    expect(folders?.folders.find((f) => f.id === FOLDER_B)?.bookmarkCount).toBe(3);
    expect(folders?.uncategorizedCount).toBe(2);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useSetBookmarkFolderPinMutation', () => {
  const PINNED_AT = '2026-10-01T09:00:00';
  let pinRequests: string[];

  beforeEach(() => {
    pinRequests = [];
  });

  const pinResponse = (pinnedAt: string | null) =>
    HttpResponse.json(
      { status: 200, message: 'ok', data: { id: FOLDER_A, pinnedAt }, timestamp: '' },
      { status: 200 }
    );
  const errorResponse = () =>
    HttpResponse.json(
      { status: 500, code: 'SERVER_ERROR', message: '', timestamp: '' },
      { status: 500 }
    );

  function respondPin(method: 'PUT' | 'DELETE', respond: () => Response | Promise<Response>) {
    const handler = () => {
      pinRequests.push(method);
      return respond();
    };
    server.use(
      method === 'PUT'
        ? http.put(url(API_ENDPOINTS.bookmark.folderPin(FOLDER_A)), handler)
        : http.delete(url(API_ENDPOINTS.bookmark.folderPin(FOLDER_A)), handler)
    );
  }

  function createResponseGate() {
    let release!: () => void;
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });

    return { wait, release };
  }

  function seedWithPinnedAt(pinnedAt: string | null) {
    queryClient.setQueryData<BookmarkFolderListResponse>(bookmarkFolderKeys.list, {
      ...seedFolderList,
      folders: seedFolderList.folders.map((folder) =>
        folder.id === FOLDER_A ? { ...folder, lastUsedAt: '2026-09-01T00:00:00', pinnedAt } : folder
      ),
    });
  }

  const readFolderA = () =>
    queryClient
      .getQueryData<BookmarkFolderListResponse>(bookmarkFolderKeys.list)
      ?.folders.find((folder) => folder.id === FOLDER_A);

  it('고정은 PUT, 해제는 DELETE를 보내고 화면은 응답 전에, 성공 토스트는 응답 뒤에 뜬다', async () => {
    const successSpy = vi.spyOn(toast, 'success');
    seedWithPinnedAt(null);
    const gate = createResponseGate();
    respondPin('PUT', async () => {
      await gate.wait;
      return pinResponse(PINNED_AT);
    });
    respondPin('DELETE', () => pinResponse(null));
    const { result } = renderHook(() => useSetBookmarkFolderPinMutation(FOLDER_A), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate(true);
    });

    await waitFor(() => expect(readFolderA()?.pinnedAt).toEqual(expect.any(String)));
    // 이름·개수·lastUsedAt은 건드리지 않는다 — 최근 구획 순서가 그대로여야 한다
    expect(readFolderA()).toMatchObject({
      name: '개발',
      bookmarkCount: 2,
      lastUsedAt: '2026-09-01T00:00:00',
    });
    expect(successSpy).not.toHaveBeenCalled();

    gate.release();
    await waitFor(() => expect(readFolderA()?.pinnedAt).toBe(PINNED_AT));
    expect(successSpy).toHaveBeenLastCalledWith(TEXTS.messages.success.folderPinned('개발'));

    act(() => {
      result.current.mutate(false);
    });

    await waitFor(() => expect(pinRequests).toEqual(['PUT', 'DELETE']));
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(readFolderA()?.pinnedAt).toBeNull();
    expect(successSpy).toHaveBeenLastCalledWith(TEXTS.messages.success.folderUnpinned('개발'));
    expect(successSpy).toHaveBeenCalledTimes(2);
  });

  it('이미 고정된 폴더를 다시 고정해도 처음 고정한 시각을 유지한다', async () => {
    seedWithPinnedAt(PINNED_AT);
    const gate = createResponseGate();
    respondPin('PUT', async () => {
      await gate.wait;
      return pinResponse(PINNED_AT);
    });
    const { result } = renderHook(() => useSetBookmarkFolderPinMutation(FOLDER_A), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate(true);
    });

    await waitFor(() => expect(pinRequests).toEqual(['PUT']));
    expect(readFolderA()?.pinnedAt).toBe(PINNED_AT);

    gate.release();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(readFolderA()?.pinnedAt).toBe(PINNED_AT);
  });

  it('실패하면 되돌리고 목록을 다시 조회하도록 무효화하며 실패 토스트를 한 번 띄운다', async () => {
    const errorSpy = vi.spyOn(toast, 'error');
    seedWithPinnedAt(null);
    respondPin('PUT', errorResponse);
    const { result } = renderHook(() => useSetBookmarkFolderPinMutation(FOLDER_A), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate(true);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(readFolderA()?.pinnedAt).toBeNull();
    expect(queryClient.getQueryState(bookmarkFolderKeys.list)?.isInvalidated).toBe(true);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(TEXTS.messages.error.folderPinFailed);
  });

  it('해제가 실패하면 해제 실패 문구를 띄운다', async () => {
    const errorSpy = vi.spyOn(toast, 'error');
    seedWithPinnedAt(PINNED_AT);
    respondPin('DELETE', errorResponse);
    const { result } = renderHook(() => useSetBookmarkFolderPinMutation(FOLDER_A), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate(false);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(readFolderA()?.pinnedAt).toBe(PINNED_AT);
    expect(errorSpy).toHaveBeenCalledWith(TEXTS.messages.error.folderUnpinFailed);
  });

  // 세 번 누른다(고정→해제→고정). 두 번만 누르면 "첫 클릭 전 상태"와 "두 번째 클릭 뒤 상태"가 같아져, 잘못
  // 되돌려도 화면이 같아 보여 아무것도 증명하지 못한다(interaction.queries.test.ts 연타 describe와 같은 이유)
  it('연타: 중간 요청이 실패해도 되돌리거나 토스트를 띄우지 않고, 마지막 응답 값과 성공 토스트 한 번으로 끝난다', async () => {
    const errorSpy = vi.spyOn(toast, 'error');
    const successSpy = vi.spyOn(toast, 'success');
    seedWithPinnedAt(null);
    const firstPutGate = createResponseGate();
    let putCount = 0;
    respondPin('PUT', async () => {
      putCount += 1;

      if (putCount === 1) {
        await firstPutGate.wait;
        return errorResponse();
      }

      return pinResponse(PINNED_AT);
    });
    respondPin('DELETE', () => pinResponse(null));
    const { result } = renderHook(() => useSetBookmarkFolderPinMutation(FOLDER_A), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate(true);
    });
    act(() => {
      result.current.mutate(false);
    });
    act(() => {
      result.current.mutate(true);
    });
    await waitFor(() => expect(readFolderA()?.pinnedAt).toEqual(expect.any(String)));
    // 요청은 한 줄로 선다 — 첫 응답 전에는 하나뿐이다
    expect(pinRequests).toEqual(['PUT']);

    firstPutGate.release();

    await waitFor(() => expect(pinRequests).toEqual(['PUT', 'DELETE', 'PUT']));
    await waitFor(() => expect(readFolderA()?.pinnedAt).toBe(PINNED_AT));
    expect(errorSpy).not.toHaveBeenCalled();
    // 가운데 DELETE의 성공은 뒤에 PUT이 남아 있어 띄우지 않는다
    await waitFor(() => expect(successSpy).toHaveBeenCalledTimes(1));
    expect(successSpy).toHaveBeenCalledWith(TEXTS.messages.success.folderPinned('개발'));
  });
});
