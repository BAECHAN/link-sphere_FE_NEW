import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { createQueryClientWithErrorToasts, createTestQueryClient } from '@/test/utils';
import { toast } from '@/shared/lib/toast/toast';
import { SERVER_ERROR_CODE } from '@/shared/config/error-code';
import { TEXTS } from '@/shared/config/texts';
import { ApiError, NetworkError } from '@/shared/types/common.type';
import { postKeys } from '@/entities/post/api/post.keys';
import { bookmarkFolderKeys } from '@/entities/bookmark/folder/api/bookmark-folder.keys';
import { mockBookmarkFolder } from '@/mocks/fixtures/bookmark-folder.fixtures';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import type { Post } from '@/entities/post/model/post.schema';
import type {
  BookmarkFolder,
  BookmarkFoldersResponse,
  BookmarkFolderListResponse,
} from '@/entities/bookmark/folder/model/bookmark-folder.schema';
import {
  prefetchBookmarkFolderList,
  prefetchBookmarkFolderPosts,
  useAddBookmarkFolderMutation,
  useBookmarkFolderListQuery,
  useBookmarkFolderPostsInfiniteQuery,
  useClearBookmarkFoldersMutation,
  useCreateBookmarkFolderMutation,
  useDeleteBookmarkFolderMutation,
  useRemoveBookmarkFolderMutation,
  useSetBookmarkFolderPinMutation,
  useUpdateBookmarkFolderMutation,
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

  it('실패하면 되돌리고 목록을 다시 조회하도록 무효화하며 닫을 때까지 남는 실패 토스트를 한 번 띄운다', async () => {
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
    expect(errorSpy).toHaveBeenCalledWith(TEXTS.messages.error.folderPinFailed, {
      id: 'bookmark-folder-pin-error',
      duration: Infinity,
    });
  });

  it('다시 보내는 동안에는 되돌리지도 안내하지도 않고, 다시 보낸 요청도 응답이 없으면 그때 되돌린다', async () => {
    const errorSpy = vi.spyOn(toast, 'error');
    seedWithPinnedAt(null);
    const gate = createResponseGate();
    let putCount = 0;
    respondPin('PUT', async () => {
      putCount += 1;

      if (putCount > 1) {
        await gate.wait;
      }

      return HttpResponse.error();
    });
    const { result } = renderHook(() => useSetBookmarkFolderPinMutation(FOLDER_A), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate(true);
    });

    await waitFor(() => expect(pinRequests).toEqual(['PUT', 'PUT']));
    expect(readFolderA()?.pinnedAt).not.toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();

    gate.release();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(readFolderA()?.pinnedAt).toBeNull();
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('끝내 응답을 못 받으면 되돌리고 무효화하며 실패라고 단정하지 않는 토스트를 한 번 띄운다', async () => {
    const errorSpy = vi.spyOn(toast, 'error');
    seedWithPinnedAt(null);
    respondPin('PUT', () => HttpResponse.error());
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
    expect(errorSpy).toHaveBeenCalledWith(TEXTS.messages.error.outcomeUnknown, {
      id: 'bookmark-folder-pin-error',
      duration: Infinity,
    });
  });

  it('해제가 실패하면 고정 실패와 같은 id로 해제 실패 문구를 띄운다', async () => {
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
    expect(errorSpy).toHaveBeenCalledWith(TEXTS.messages.error.folderUnpinFailed, {
      id: 'bookmark-folder-pin-error',
      duration: Infinity,
    });
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

// 북마크 버튼·폴더 행 hover의 미리 받기는 실패해도 토스트를 띄우지 않고 실패한 쿼리를 지운다 - hover마다 같은 실패
// 토스트가 쌓이지 않게, 창·목록이 열리면 새로 요청하게(상세 카드 hover의 prefetchPostDetail과 같은 이유)
describe('북마크 hover 미리 받기', () => {
  const FOLDER_LIST_PATH = API_ENDPOINTS.bookmark.folders;
  const FOLDER_POSTS_PATH = API_ENDPOINTS.bookmark.folderPosts(FOLDER_A);
  let errorToasts: string[];

  beforeEach(() => {
    ({ queryClient, errorToasts } = createQueryClientWithErrorToasts());
  });

  function failWith500(path: string, { delayMs = 0 } = {}) {
    server.use(
      http.get(url(path), async () => {
        if (delayMs > 0) {
          await delay(delayMs);
        }

        return HttpResponse.json(
          { status: 500, code: 'SERVER_ERROR', message: 'fail', timestamp: '' },
          { status: 500 }
        );
      })
    );
  }

  async function hoverAndSettle(prefetch: () => void) {
    prefetch();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  }

  it('폴더 목록 미리 받기가 hover마다 실패해도 토스트를 띄우지 않고, 실패한 쿼리를 지운다', async () => {
    failWith500(FOLDER_LIST_PATH);
    const hover = () => hoverAndSettle(() => prefetchBookmarkFolderList(queryClient));

    await hover();
    await hover();
    await hover();

    expect(errorToasts).toEqual([]);
    expect(queryClient.getQueryState(bookmarkFolderKeys.list)).toBeUndefined();
  });

  // 피드 카드·글 작성 폼은 폴더 창을 닫힌 채 마운트해 꺼진 구독자(enabled: false)로 목록을 지켜본다. 요청 상태가
  // 바뀌면 다시 그려지며 쿼리 meta를 자기 것으로 덮어써(query-core 5.90.16 queryObserver.js:94) 미리 받기가 단
  // manualErrorHandling이 지워진다 - 그래서 실패 순간 켜진 구독자가 있는지로 판정한다
  function renderFolderDialogObserver() {
    return renderHook(
      ({ open }) => {
        const { isLoading, isFetching } = useBookmarkFolderListQuery({ enabled: open });

        return { isLoading, isFetching };
      },
      { wrapper: Wrapper, initialProps: { open: false } }
    );
  }

  it('닫힌 창이 목록을 지켜보는 동안 hover 미리 받기가 실패해도 토스트를 띄우지 않는다', async () => {
    failWith500(FOLDER_LIST_PATH);
    renderFolderDialogObserver();
    const hover = () => hoverAndSettle(() => prefetchBookmarkFolderList(queryClient));

    await hover();
    await hover();
    await hover();

    expect(errorToasts).toEqual([]);
  });

  it('창을 열었다가 요청이 끝나기 전에 닫으면 알리지 않고, 다시 열면 스켈레톤부터 새로 요청해 알린다', async () => {
    failWith500(FOLDER_LIST_PATH, { delayMs: 100 });
    const { result, rerender } = renderFolderDialogObserver();

    rerender({ open: true });
    await waitFor(() => expect(result.current.isFetching).toBe(true));
    rerender({ open: false });
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    expect(errorToasts).toEqual([]);

    rerender({ open: true });
    await waitFor(() => expect(result.current.isLoading).toBe(true));
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    expect(errorToasts).toHaveLength(1);
  });

  // 쿼리 옵션은 쿼리당 한 벌이라 마지막에 그려진 구독자의 meta가 남는다 - 열린 창 뒤에 닫힌 창이 그려져도 알린다
  it('열린 창이 하나라도 있으면 실패를 알린다(토스트 1회)', async () => {
    failWith500(FOLDER_LIST_PATH, { delayMs: 50 });
    const { result } = renderHook(
      () => {
        const openDialog = useBookmarkFolderListQuery({ enabled: true });
        const closedDialog = useBookmarkFolderListQuery({ enabled: false });

        return { isError: openDialog.isError, isFetching: closedDialog.isFetching };
      },
      { wrapper: Wrapper }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(errorToasts).toHaveLength(1);
  });

  // 창이 요청을 이어받았으면 창의 실패라 지우지 않고 토스트를 한 번 띄운다
  it('폴더 목록을 미리 받는 중에 창이 열린 뒤 실패하면 창이 처리한다(토스트 1회)', async () => {
    failWith500(FOLDER_LIST_PATH, { delayMs: 100 });

    prefetchBookmarkFolderList(queryClient);
    const { result } = renderHook(() => useBookmarkFolderListQuery(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(errorToasts).toHaveLength(1);
    expect(queryClient.getQueryState(bookmarkFolderKeys.list)?.status).toBe('error');
  });

  it('폴더 글 미리 받기가 hover마다 실패해도 토스트를 띄우지 않고, 실패한 쿼리를 지운다', async () => {
    failWith500(FOLDER_POSTS_PATH);
    const hover = () =>
      hoverAndSettle(() => prefetchBookmarkFolderPosts(queryClient, FOLDER_A, 'latest'));

    await hover();
    await hover();

    expect(errorToasts).toEqual([]);
    expect(queryClient.getQueryState(bookmarkFolderKeys.posts(FOLDER_A, 'latest'))).toBeUndefined();
  });

  it('폴더 글을 미리 받는 중에 목록이 열린 뒤 실패하면 목록이 처리한다(토스트 1회)', async () => {
    failWith500(FOLDER_POSTS_PATH, { delayMs: 100 });

    prefetchBookmarkFolderPosts(queryClient, FOLDER_A, 'latest');
    const { result } = renderHook(() => useBookmarkFolderPostsInfiniteQuery(FOLDER_A, 'latest'), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(errorToasts).toHaveLength(1);
    expect(queryClient.getQueryState(bookmarkFolderKeys.posts(FOLDER_A, 'latest'))?.status).toBe(
      'error'
    );
  });
});

describe('useCreateBookmarkFolderMutation - 다시 보낸 요청의 이름 대조', () => {
  const FOLDER_NAME = '새 폴더';
  const createdFolder = { ...mockBookmarkFolder, id: 'created-folder-id', name: FOLDER_NAME };
  const duplicateName = () =>
    HttpResponse.json(
      {
        status: 409,
        code: SERVER_ERROR_CODE.DUPLICATE_FOLDER_NAME,
        message: '',
        timestamp: '',
      },
      { status: 409 }
    );

  /** POST는 차례대로 응답하고(마지막 응답을 반복) GET 목록은 주어진 응답으로 답한다. 요청 수를 돌려준다 */
  const respond = (posts: (() => Response)[], list: () => Response) => {
    const calls = { post: 0, list: 0 };

    server.use(
      http.post(url(API_ENDPOINTS.bookmark.folders), () => {
        calls.post += 1;

        return posts[Math.min(calls.post, posts.length) - 1]!();
      }),
      http.get(url(API_ENDPOINTS.bookmark.folders), () => {
        calls.list += 1;

        return list();
      })
    );

    return calls;
  };

  const listWith = (folders: BookmarkFolder[]) => () =>
    HttpResponse.json(
      { status: 200, message: 'ok', data: { folders, uncategorizedCount: 0 }, timestamp: '' },
      { status: 200 }
    );

  const create = async () => {
    const { result } = renderHook(() => useCreateBookmarkFolderMutation(), { wrapper: Wrapper });
    let outcome: { data?: unknown; error?: unknown } = {};

    await act(async () => {
      outcome = await result.current.mutateAsync({ name: FOLDER_NAME }).then(
        (data) => ({ data }),
        (error: unknown) => ({ error })
      );
    });

    return outcome;
  };

  it('끊긴 뒤 409이고 목록에 같은 이름이 있으면 그 폴더를 결과로 쓴다', async () => {
    const calls = respond([() => HttpResponse.error(), duplicateName], listWith([createdFolder]));

    const { data, error } = await create();

    expect(error).toBeUndefined();
    expect(data).toMatchObject({ id: createdFolder.id, name: FOLDER_NAME });
    expect(calls).toEqual({ post: 2, list: 1 });
  });

  it('끊긴 뒤 409인데 목록에 같은 이름이 없으면 409를 그대로 던진다', async () => {
    const calls = respond([() => HttpResponse.error(), duplicateName], listWith([]));

    const { error } = await create();

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe(SERVER_ERROR_CODE.DUPLICATE_FOLDER_NAME);
    expect(calls).toEqual({ post: 2, list: 1 });
  });

  it('처음부터 409면 진짜 중복이라 목록을 조회하지 않는다', async () => {
    const calls = respond([duplicateName], listWith([createdFolder]));

    const { error } = await create();

    expect((error as ApiError).code).toBe(SERVER_ERROR_CODE.DUPLICATE_FOLDER_NAME);
    expect(calls).toEqual({ post: 1, list: 0 });
  });

  it('대조 조회도 끊기면 결과를 모르는 채로 끝나 더 보내지 않고 화면을 다시 받는다', async () => {
    queryClient.setQueryData(bookmarkFolderKeys.list, { folders: [], uncategorizedCount: 0 });
    const calls = respond([() => HttpResponse.error(), duplicateName], () => HttpResponse.error());

    const { error } = await create();

    expect(error).toBeInstanceOf(NetworkError);
    expect(calls).toEqual({ post: 2, list: 1 });
    expect(queryClient.getQueryState(bookmarkFolderKeys.list)?.isInvalidated).toBe(true);
  });
});

describe('useDeleteBookmarkFolderMutation - 응답을 못 받았을 때', () => {
  const FOLDER_ID = 'folder-uuid-1';

  it('끊긴 뒤 다시 보낸 요청이 404면 실패가 아니라 이미 삭제 안내 1개로 끝난다', async () => {
    const errorSpy = vi.spyOn(toast, 'error');
    const infoSpy = vi.spyOn(toast, 'info');
    const responses = [
      () => HttpResponse.error(),
      () =>
        HttpResponse.json(
          { status: 404, code: SERVER_ERROR_CODE.FOLDER_NOT_FOUND, message: '', timestamp: '' },
          { status: 404 }
        ),
    ];
    let requestCount = 0;

    server.use(
      http.delete(url(API_ENDPOINTS.bookmark.folder(FOLDER_ID)), () => {
        requestCount += 1;

        return responses[requestCount - 1]!();
      })
    );
    const { result } = renderHook(() => useDeleteBookmarkFolderMutation(FOLDER_ID), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(requestCount).toBe(2);
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy.mock.calls[0]?.[0]).toBe(TEXTS.messages.info.folderAlreadyDeleted);
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe('useUpdateBookmarkFolderMutation - 응답을 못 받았을 때', () => {
  it('끝내 응답을 못 받으면 낙관적 이름을 되돌린 뒤 목록을 다시 받는다', async () => {
    const seeded = { folders: [mockBookmarkFolder], uncategorizedCount: 0 };

    queryClient.setQueryData(bookmarkFolderKeys.list, seeded);
    server.use(
      http.patch(url(API_ENDPOINTS.bookmark.folder(mockBookmarkFolder.id)), () =>
        HttpResponse.error()
      )
    );
    const { result } = renderHook(() => useUpdateBookmarkFolderMutation(mockBookmarkFolder.id), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({ name: '새 이름' }).catch(() => undefined);
    });

    expect(queryClient.getQueryData(bookmarkFolderKeys.list)).toEqual(seeded);
    expect(queryClient.getQueryState(bookmarkFolderKeys.list)?.isInvalidated).toBe(true);
  });
});
