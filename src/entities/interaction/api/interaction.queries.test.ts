import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse, delay } from 'msw';
import { createElement, type ReactNode } from 'react';
import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
  type InfiniteData,
} from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';
import { rememberMutationAuthEpoch } from '@/shared/lib/react-query/config/mutation-auth-epoch';
import { SessionChangedError } from '@/shared/types/common.type';
import { AuthEpochUtil } from '@/shared/utils/auth-epoch.util';
import { LocalStorageUtil } from '@/shared/utils/storage.util';
import { createTestQueryClient } from '@/test/utils';
import { postKeys } from '@/entities/post/api/post.keys';
import { bookmarkFolderKeys } from '@/entities/bookmark/folder/api/bookmark-folder.keys';
import { useAddBookmarkFolderMutation } from '@/entities/bookmark/folder/api/bookmark-folder.queries';
import { commentKeys } from '@/entities/comment/api/comment.keys';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import type { Post, PostListResponse } from '@/entities/post/model/post.schema';
import type { Comment } from '@/entities/comment/model/comment.schema';
import type { BookmarkFolderListResponse } from '@/entities/bookmark/folder/model/bookmark-folder.schema';
import {
  useBookmarkPostMutation,
  useLikeCommentMutation,
  useLikePostMutation,
} from '@/entities/interaction/api/interaction.queries';

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

const seedFolderList = (
  overrides: Partial<BookmarkFolderListResponse> = {}
): BookmarkFolderListResponse => ({
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
  ...overrides,
});

// 서버 응답을 테스트가 release()를 부를 때까지 붙잡아 둔다. MSW가 바로 응답하면 waitFor가
// 낙관적 중간값을 보기 전에 onSuccess/onError가 값을 덮어써서, 중간 상태를 경쟁 없이 볼 수 없다.
function createResponseGate() {
  let release!: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });

  return { wait, release };
}

// PUT/DELETE /post/{id}/bookmark 성공 응답(BookmarkFoldersResponse). 204로 두면 apiClient가 {}로
// 바꿔 onSuccess가 folderIds를 undefined로 덮으므로 실제 BE처럼 JSON을 돌려준다.
const bookmarkResponse = (isBookmarked: boolean, folderIds: string[] = []) =>
  HttpResponse.json(
    {
      status: 200,
      message: isBookmarked ? '북마크 성공' : '북마크 취소 성공',
      data: { postId: POST_ID, isBookmarked, folderIds },
      timestamp: '',
    },
    { status: 200 }
  );

const bookmarkErrorResponse = () =>
  HttpResponse.json(
    { status: 500, code: 'INTERNAL_SERVER_ERROR', message: 'boom', timestamp: '' },
    { status: 500 }
  );

// 받은 북마크 요청을 순서대로 기록한다 — 핸들러가 실제로 불렸는지와 요청 순서를 함께 단언한다
let bookmarkRequests: Array<{ method: 'PUT' | 'DELETE'; body: string }>;

function respondBookmark(method: 'PUT' | 'DELETE', respond: () => Response | Promise<Response>) {
  const register = method === 'PUT' ? http.put : http.delete;
  server.use(
    register(url(API_ENDPOINTS.post.postBookmark(POST_ID)), async ({ request }) => {
      bookmarkRequests.push({ method, body: await request.text() });
      return respond();
    })
  );
}

beforeEach(() => {
  queryClient = createTestQueryClient({ gcTime: Infinity });
  bookmarkRequests = [];
  // 기본 postHandlers 의 북마크 핸들러는 API_BASE_URL 접두사(/api) 없이 등록돼 있어
  // 테스트 환경(VITE_API_BASE_URL) 요청 경로와 매칭되지 않는다 — url() 로 명시 등록.
  respondBookmark('PUT', () => bookmarkResponse(true));
  respondBookmark('DELETE', () => bookmarkResponse(false));
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
      result.current.mutate(false);
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
      result.current.mutate(false);
    });

    await waitFor(() => {
      const folders = queryClient.getQueryData<BookmarkFolderListResponse>(bookmarkFolderKeys.list);
      expect(folders?.uncategorizedCount).toBe(0);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('미분류 글을 해제하면 /bookmark?folder=uncategorized 목록 캐시에서도 카드가 제거된다', async () => {
    const seededPost: Post = {
      ...mockPost,
      userInteractions: { isLiked: false, isBookmarked: true, bookmarkFolderIds: [] },
      stats: { ...mockPost.stats, bookmarkCount: 5 },
    };
    queryClient.setQueryData(postKeys.detail(POST_ID), seededPost);
    queryClient.setQueryData(bookmarkFolderKeys.list, seedFolderList());

    const seededFolderPosts: InfiniteData<PostListResponse> = {
      pages: [
        { page: 0, size: 10, content: [seededPost], totalElements: 1, totalPages: 1, last: true },
      ],
      pageParams: [0],
    };
    queryClient.setQueryData(bookmarkFolderKeys.posts('uncategorized'), seededFolderPosts);

    const { result } = renderHook(() => useBookmarkPostMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate(false);
    });

    await waitFor(() => {
      const folderPosts = queryClient.getQueryData<InfiniteData<PostListResponse>>(
        bookmarkFolderKeys.posts('uncategorized')
      );
      expect(folderPosts?.pages[0]?.content).toHaveLength(0);
      expect(folderPosts?.pages[0]?.totalElements).toBe(0);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('저장(신규 북마크)이면 미분류로 생성되어 uncategorizedCount가 +1된다', async () => {
    const seededPost: Post = {
      ...mockPost,
      userInteractions: { isLiked: false, isBookmarked: false, bookmarkFolderIds: [] },
      stats: { ...mockPost.stats, bookmarkCount: 5 },
    };
    queryClient.setQueryData(postKeys.detail(POST_ID), seededPost);
    queryClient.setQueryData(bookmarkFolderKeys.list, seedFolderList());

    const { result } = renderHook(() => useBookmarkPostMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate(true);
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

  it('서버 에러 시 post.detail·post.list·folder.list를 롤백한다', async () => {
    respondBookmark('DELETE', bookmarkErrorResponse);

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
    // 메인 피드 목록에도 같은 글이 캐시돼 있는 상태를 재현한다 — onMutate가
    // postKeys.listRoot를 직접 패치하는데, 이걸 스냅샷 없이 onError에서 안 돌려놓는
    // 구멍이 있었다(useLikePostMutation과 같은 종류, 2026-09-10 발견·수정).
    const seededList: InfiniteData<PostListResponse> = {
      pages: [
        {
          page: 0,
          size: 10,
          content: [seededPost],
          totalElements: 1,
          totalPages: 1,
          last: true,
        },
      ],
      pageParams: [0],
    };
    queryClient.setQueryData(postKeys.list(), seededList);

    const { result } = renderHook(() => useBookmarkPostMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate(false);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    const post = queryClient.getQueryData<Post>(postKeys.detail(POST_ID));
    expect(post?.userInteractions.isBookmarked).toBe(true);
    expect(post?.userInteractions.bookmarkFolderIds).toEqual([FOLDER_A, FOLDER_B]);
    expect(post?.stats.bookmarkCount).toBe(10);

    const list = queryClient.getQueryData<InfiniteData<PostListResponse>>(postKeys.list());
    const listedPost = list?.pages[0]?.content.find((p) => p.id === POST_ID);
    expect(listedPost?.userInteractions.isBookmarked).toBe(true);
    expect(listedPost?.stats.bookmarkCount).toBe(10);

    const folders = queryClient.getQueryData<BookmarkFolderListResponse>(bookmarkFolderKeys.list);
    expect(folders?.folders.find((f) => f.id === FOLDER_A)?.bookmarkCount).toBe(2);
    expect(folders?.uncategorizedCount).toBe(1);
  });

  describe('post.detail 캐시 없이 메인 피드 목록에만 있는 경우 (2026-09-11 버그 수정)', () => {
    // post.detail/폴더 게시글 캐시가 전혀 없고 postKeys.listRoot에만 이 글이 있는 상태 —
    // 과거엔 wasBookmarked가 항상 false로 오판돼 "제거"가 "추가"로 잘못 처리됐다
    // (resolveCurrentBookmarkState가 postKeys.listRoot를 후보에서 빠뜨렸던 버그).
    function seedList(post: Post) {
      const seededList: InfiniteData<PostListResponse> = {
        pages: [
          { page: 0, size: 10, content: [post], totalElements: 1, totalPages: 1, last: true },
        ],
        pageParams: [0],
      };
      queryClient.setQueryData(postKeys.list(), seededList);
    }

    it('미분류 글을 제거하면 isBookmarked가 false로 정확히 뒤집힌다', async () => {
      const seededPost: Post = {
        ...mockPost,
        userInteractions: { isLiked: false, isBookmarked: true, bookmarkFolderIds: [] },
        stats: { ...mockPost.stats, bookmarkCount: 5 },
      };
      seedList(seededPost);
      queryClient.setQueryData(bookmarkFolderKeys.list, seedFolderList());

      const { result } = renderHook(() => useBookmarkPostMutation(POST_ID), { wrapper: Wrapper });

      act(() => {
        result.current.mutate(false);
      });

      await waitFor(() => {
        const list = queryClient.getQueryData<InfiniteData<PostListResponse>>(postKeys.list());
        const listedPost = list?.pages[0]?.content.find((p) => p.id === POST_ID);
        expect(listedPost?.userInteractions.isBookmarked).toBe(false);
        expect(listedPost?.stats.bookmarkCount).toBe(4);
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it('폴더 소속 글을 제거하면 폴더 소속만 비우지 않고 isBookmarked도 false로 뒤집힌다', async () => {
      const seededPost: Post = {
        ...mockPost,
        userInteractions: { isLiked: false, isBookmarked: true, bookmarkFolderIds: [FOLDER_A] },
        stats: { ...mockPost.stats, bookmarkCount: 5 },
      };
      seedList(seededPost);
      queryClient.setQueryData(bookmarkFolderKeys.list, seedFolderList());

      const { result } = renderHook(() => useBookmarkPostMutation(POST_ID), { wrapper: Wrapper });

      act(() => {
        result.current.mutate(false);
      });

      await waitFor(() => {
        const list = queryClient.getQueryData<InfiniteData<PostListResponse>>(postKeys.list());
        const listedPost = list?.pages[0]?.content.find((p) => p.id === POST_ID);
        expect(listedPost?.userInteractions.isBookmarked).toBe(false);
        expect(listedPost?.userInteractions.bookmarkFolderIds).toEqual([]);
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  it('해제하면 그 글이 든 폴더 캐시에서 그 카드만 빠지고 총개수가 1 줄며, 그 글이 없는 폴더 캐시는 그대로다', async () => {
    const seededPost: Post = {
      ...mockPost,
      userInteractions: { isLiked: false, isBookmarked: true, bookmarkFolderIds: [FOLDER_A] },
      stats: { ...mockPost.stats, bookmarkCount: 5 },
    };
    const otherInA1: Post = { ...mockPost, id: 'post-uuid-a1' };
    const otherInA2: Post = { ...mockPost, id: 'post-uuid-a2' };
    const otherInB: Post = { ...mockPost, id: 'post-uuid-b' };
    queryClient.setQueryData(postKeys.detail(POST_ID), seededPost);
    queryClient.setQueryData(bookmarkFolderKeys.list, seedFolderList());

    // 폴더 A: 그 글은 첫 페이지가 아닌 두 번째 페이지에 다른 글과 함께 있다(총 3개)
    const folderAPosts: InfiniteData<PostListResponse> = {
      pages: [
        { page: 0, size: 2, content: [otherInA1], totalElements: 3, totalPages: 2, last: false },
        {
          page: 1,
          size: 2,
          content: [seededPost, otherInA2],
          totalElements: 3,
          totalPages: 2,
          last: true,
        },
      ],
      pageParams: [0, 1],
    };
    // 폴더 B: 그 글이 들어 있지 않다
    const folderBPosts: InfiniteData<PostListResponse> = {
      pages: [
        { page: 0, size: 2, content: [otherInB], totalElements: 1, totalPages: 1, last: true },
      ],
      pageParams: [0],
    };
    queryClient.setQueryData(bookmarkFolderKeys.posts(FOLDER_A), folderAPosts);
    queryClient.setQueryData(bookmarkFolderKeys.posts(FOLDER_B), folderBPosts);

    const { result } = renderHook(() => useBookmarkPostMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate(false);
    });

    await waitFor(() => {
      const folderA = queryClient.getQueryData<InfiniteData<PostListResponse>>(
        bookmarkFolderKeys.posts(FOLDER_A)
      );
      expect(folderA?.pages[1]?.content.map((p) => p.id)).toEqual([otherInA2.id]);
    });

    const folderA = queryClient.getQueryData<InfiniteData<PostListResponse>>(
      bookmarkFolderKeys.posts(FOLDER_A)
    );
    expect(folderA?.pages[0]?.content.map((p) => p.id)).toEqual([otherInA1.id]);
    expect(folderA?.pages.map((page) => page.totalElements)).toEqual([2, 2]);

    expect(queryClient.getQueryData(bookmarkFolderKeys.posts(FOLDER_B))).toEqual(folderBPosts);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('저장에 성공하면 폴더 목록과 폴더별 게시글 캐시를 무효화해 서버 값으로 다시 맞춘다', async () => {
    const seededPost: Post = {
      ...mockPost,
      userInteractions: { isLiked: false, isBookmarked: false, bookmarkFolderIds: [] },
      stats: { ...mockPost.stats, bookmarkCount: 5 },
    };
    const uncategorizedPosts: InfiniteData<PostListResponse> = {
      pages: [{ page: 0, size: 10, content: [], totalElements: 0, totalPages: 0, last: true }],
      pageParams: [0],
    };
    queryClient.setQueryData(postKeys.detail(POST_ID), seededPost);
    queryClient.setQueryData(bookmarkFolderKeys.list, seedFolderList());
    queryClient.setQueryData(bookmarkFolderKeys.posts('uncategorized'), uncategorizedPosts);

    expect(queryClient.getQueryState(bookmarkFolderKeys.list)?.isInvalidated).toBe(false);
    expect(
      queryClient.getQueryState(bookmarkFolderKeys.posts('uncategorized'))?.isInvalidated
    ).toBe(false);

    const { result } = renderHook(() => useBookmarkPostMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate(true);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // 낙관적 반영은 추정값이고, 새로 북마크한 글은 미분류 목록을 다시 불러와야 나타난다
    await waitFor(() => {
      expect(queryClient.getQueryState(bookmarkFolderKeys.list)?.isInvalidated).toBe(true);
      expect(
        queryClient.getQueryState(bookmarkFolderKeys.posts('uncategorized'))?.isInvalidated
      ).toBe(true);
    });
  });

  describe('상태 지정·연타 — 같은 글의 북마크 요청은 한 줄로 나가고, 마지막 요청에서만 확정한다', () => {
    function seedDetailAndList(post: Post) {
      queryClient.setQueryData(postKeys.detail(POST_ID), post);
      queryClient.setQueryData<InfiniteData<PostListResponse>>(postKeys.list(), {
        pages: [
          { page: 0, size: 10, content: [post], totalElements: 1, totalPages: 1, last: true },
        ],
        pageParams: [0],
      });
    }

    function seedPost(isBookmarked: boolean, bookmarkFolderIds: string[] = []): Post {
      return {
        ...mockPost,
        userInteractions: { isLiked: false, isBookmarked, bookmarkFolderIds },
        stats: { ...mockPost.stats, bookmarkCount: 5 },
      };
    }

    const readDetail = () => queryClient.getQueryData<Post>(postKeys.detail(POST_ID));

    function gateBookmark(method: 'PUT' | 'DELETE', respond: () => Response) {
      const gate = createResponseGate();
      respondBookmark(method, async () => {
        await gate.wait;
        return respond();
      });
      return gate;
    }

    it('저장은 본문 없는 PUT, 해제는 DELETE로 나간다', async () => {
      seedDetailAndList(seedPost(false));
      const { result } = renderHook(() => useBookmarkPostMutation(POST_ID), { wrapper: Wrapper });

      act(() => {
        result.current.mutate(true);
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      act(() => {
        result.current.mutate(false);
      });
      await waitFor(() => expect(bookmarkRequests).toHaveLength(2));

      expect(bookmarkRequests).toEqual([
        { method: 'PUT', body: '' },
        { method: 'DELETE', body: '' },
      ]);
    });

    it('이미 그 상태로 만들라고 하면 북마크 수와 폴더 목록 수를 바꾸지 않는다', async () => {
      seedDetailAndList(seedPost(true));
      queryClient.setQueryData(bookmarkFolderKeys.list, seedFolderList());
      gateBookmark('PUT', () => bookmarkResponse(true));
      const { result } = renderHook(() => useBookmarkPostMutation(POST_ID), { wrapper: Wrapper });

      act(() => {
        result.current.mutate(true);
      });
      await waitFor(() => expect(bookmarkRequests).toHaveLength(1));

      expect(readDetail()?.stats.bookmarkCount).toBe(5);
      expect(
        queryClient.getQueryData<BookmarkFolderListResponse>(bookmarkFolderKeys.list)
          ?.uncategorizedCount
      ).toBe(1);
    });

    // 다른 기기에서 이미 폴더 A에 저장한 글을 이 기기의 낡은 화면에서 "미분류" 저장한 경우 —
    // 서버는 기존 소속을 유지하고, 화면은 응답의 folderIds로 맞춰진다
    it('낡은 화면에서 저장하면 서버가 돌려준 기존 폴더 소속으로 교정된다', async () => {
      seedDetailAndList(seedPost(false));
      respondBookmark('PUT', () => bookmarkResponse(true, [FOLDER_A]));
      const { result } = renderHook(() => useBookmarkPostMutation(POST_ID), { wrapper: Wrapper });

      act(() => {
        result.current.mutate(true);
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(readDetail()?.userInteractions.isBookmarked).toBe(true);
      expect(readDetail()?.userInteractions.bookmarkFolderIds).toEqual([FOLDER_A]);
    });

    // 화면상 마지막 폴더를 빼며 해제 — 서버가 남은 소속으로 판단하므로, 다른 기기가 그사이 추가한 폴더가
    // 있으면 북마크가 남고 화면은 그 소속으로 맞춰진다(docs/plans/2026-10-14-last-folder-keeps-others.md)
    it('마지막 폴더로 해제하면 폴더 제거 API에 removeBookmarkIfEmpty=true로 나가고, 다른 소속이 남은 응답이면 그 소속으로 교정된다', async () => {
      seedDetailAndList(seedPost(true, [FOLDER_A]));
      const gate = createResponseGate();
      let removeBookmarkIfEmpty: string | null = null;
      server.use(
        http.delete(
          url(API_ENDPOINTS.bookmark.postFolder(POST_ID, FOLDER_A)),
          async ({ request }) => {
            removeBookmarkIfEmpty = new URL(request.url).searchParams.get('removeBookmarkIfEmpty');
            await gate.wait;
            return bookmarkResponse(true, [FOLDER_B]);
          }
        )
      );
      const { result } = renderHook(() => useBookmarkPostMutation(POST_ID), { wrapper: Wrapper });

      act(() => {
        result.current.mutate({ lastFolderId: FOLDER_A });
      });

      // 응답 전에는 해제로 보인다(아이콘이 바로 꺼진다)
      await waitFor(() => expect(readDetail()?.userInteractions.isBookmarked).toBe(false));
      await waitFor(() => expect(removeBookmarkIfEmpty).toBe('true'));
      expect(bookmarkRequests).toEqual([]);

      gate.release();
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(readDetail()?.userInteractions.isBookmarked).toBe(true);
      expect(readDetail()?.userInteractions.bookmarkFolderIds).toEqual([FOLDER_B]);
    });

    it('해제→저장→해제를 연달아 누르면 요청이 순서대로 하나씩 나가고, 중간 응답으로 화면을 덮지 않는다', async () => {
      // 세 번 누른다 — 두 번이면 "첫 클릭 전"과 "두 번째 클릭 뒤" 상태가 같아 잘못 되돌려도 통과한다
      seedDetailAndList(seedPost(true));
      queryClient.setQueryData(bookmarkFolderKeys.list, seedFolderList());
      const isFolderListInvalidated = () =>
        queryClient.getQueryState(bookmarkFolderKeys.list)?.isInvalidated;
      const firstDelete = createResponseGate();
      const lastDelete = createResponseGate();
      let deleteCount = 0;
      respondBookmark('DELETE', async () => {
        deleteCount += 1;
        await (deleteCount === 1 ? firstDelete.wait : lastDelete.wait);
        return bookmarkResponse(false);
      });
      const putGate = gateBookmark('PUT', () => bookmarkResponse(true, [FOLDER_B]));
      const { result } = renderHook(() => useBookmarkPostMutation(POST_ID), { wrapper: Wrapper });

      act(() => {
        result.current.mutate(false);
      });
      act(() => {
        result.current.mutate(true);
      });
      act(() => {
        result.current.mutate(false);
      });
      await waitFor(() => expect(readDetail()?.userInteractions.isBookmarked).toBe(false));
      expect(bookmarkRequests.map((r) => r.method)).toEqual(['DELETE']);

      firstDelete.release();
      await waitFor(() => expect(bookmarkRequests.map((r) => r.method)).toEqual(['DELETE', 'PUT']));
      expect(isFolderListInvalidated()).toBe(false);

      putGate.release();
      await waitFor(() =>
        expect(bookmarkRequests.map((r) => r.method)).toEqual(['DELETE', 'PUT', 'DELETE'])
      );
      // 두 번째 요청(저장, 폴더 B) 응답이 왔지만 마지막 해제가 남아 있어 화면을 덮지도, 무효화하지도 않는다
      expect(readDetail()?.userInteractions.isBookmarked).toBe(false);
      expect(readDetail()?.userInteractions.bookmarkFolderIds).toEqual([]);
      expect(isFolderListInvalidated()).toBe(false);

      lastDelete.release();
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(readDetail()?.userInteractions.isBookmarked).toBe(false);
      expect(readDetail()?.userInteractions.bookmarkFolderIds).toEqual([]);
      expect(isFolderListInvalidated()).toBe(true);
    });

    it('중간 요청이 실패해도 되돌리지 않고, 마지막 요청이 실패하면 되돌린 뒤 4곳을 무효화한다', async () => {
      seedDetailAndList(seedPost(true));
      queryClient.setQueryData(bookmarkFolderKeys.list, seedFolderList());
      queryClient.setQueryData<InfiniteData<PostListResponse>>(
        bookmarkFolderKeys.posts('uncategorized'),
        {
          pages: [{ page: 0, size: 10, content: [], totalElements: 0, totalPages: 0, last: true }],
          pageParams: [0],
        }
      );
      const firstDelete = createResponseGate();
      let deleteCount = 0;
      respondBookmark('DELETE', async () => {
        deleteCount += 1;

        if (deleteCount === 1) {
          await firstDelete.wait;
        }

        return bookmarkErrorResponse();
      });
      const putGate = gateBookmark('PUT', () => bookmarkResponse(true));
      const { result } = renderHook(() => useBookmarkPostMutation(POST_ID), { wrapper: Wrapper });

      act(() => {
        result.current.mutate(false);
      });
      act(() => {
        result.current.mutate(true);
      });
      act(() => {
        result.current.mutate(false);
      });

      firstDelete.release();
      await waitFor(() => expect(bookmarkRequests.map((r) => r.method)).toEqual(['DELETE', 'PUT']));
      // 첫 해제가 실패했지만 첫 클릭 전(저장됨)으로 되돌리지 않고 마지막 클릭 상태(해제) 그대로다
      expect(readDetail()?.userInteractions.isBookmarked).toBe(false);
      expect(queryClient.getQueryState(postKeys.detail(POST_ID))?.isInvalidated).toBe(false);

      putGate.release();
      await waitFor(() => expect(result.current.isError).toBe(true));

      // 마지막(해제) 직전 스냅샷 = 두 번째 클릭(저장)의 낙관적 상태로 되돌리고 서버 값으로 다시 맞춘다
      expect(readDetail()?.userInteractions.isBookmarked).toBe(true);
      expect(queryClient.getQueryState(postKeys.detail(POST_ID))?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(postKeys.list())?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(bookmarkFolderKeys.list)?.isInvalidated).toBe(true);
      expect(
        queryClient.getQueryState(bookmarkFolderKeys.posts('uncategorized'))?.isInvalidated
      ).toBe(true);
    });

    // 되돌리기 토스트가 다이얼로그보다 오래 남아, 되돌리기(폴더 추가)와 다시 연 다이얼로그의 해제가 섞일 수 있다
    it('폴더 추가 직후 해제하면 요청이 순서대로 나가고, 앞선 폴더 추가의 성공 처리는 건너뛴다', async () => {
      seedDetailAndList(seedPost(true, [FOLDER_A]));
      const addGate = createResponseGate();
      const order: string[] = [];
      server.use(
        http.post(url(API_ENDPOINTS.bookmark.postFolder(POST_ID, FOLDER_A)), async () => {
          order.push('ADD');
          await addGate.wait;
          return HttpResponse.json({
            status: 200,
            message: '',
            data: { postId: POST_ID, isBookmarked: true, folderIds: [FOLDER_A] },
            timestamp: '',
          });
        })
      );
      const deleteGate = createResponseGate();
      respondBookmark('DELETE', async () => {
        order.push('DELETE');
        await deleteGate.wait;
        return bookmarkResponse(false);
      });
      const { result } = renderHook(
        () => ({
          add: useAddBookmarkFolderMutation(POST_ID),
          bookmark: useBookmarkPostMutation(POST_ID),
        }),
        { wrapper: Wrapper }
      );

      // 되돌리기(폴더 추가)를 누른 뒤, 그 요청이 아직 진행 중일 때 다이얼로그를 다시 열어 해제한다
      act(() => {
        result.current.add.mutate(FOLDER_A);
      });
      await waitFor(() => expect(order).toEqual(['ADD']));
      act(() => {
        result.current.bookmark.mutate(false);
      });
      await waitFor(() => expect(readDetail()?.userInteractions.isBookmarked).toBe(false));
      expect(order).toEqual(['ADD']);

      addGate.release();
      await waitFor(() => expect(result.current.add.isSuccess).toBe(true));
      await waitFor(() => expect(order).toEqual(['ADD', 'DELETE']));
      // 폴더 추가가 끝났지만 해제가 남아 있어 성공 처리(상세·피드까지 전체 무효화 → 재조회가 해제를
      // 덮을 수 있음)를 건너뛴다
      expect(queryClient.getQueryState(postKeys.detail(POST_ID))?.isInvalidated).toBe(false);
      expect(readDetail()?.userInteractions.isBookmarked).toBe(false);

      deleteGate.release();
      await waitFor(() => expect(result.current.bookmark.isSuccess).toBe(true));
      expect(readDetail()?.userInteractions.isBookmarked).toBe(false);
    });
  });
});

describe('useLikePostMutation', () => {
  const likeResponse = (isLiked: boolean, likeCount: number) =>
    HttpResponse.json(
      {
        status: 200,
        message: isLiked ? '좋아요 성공' : '좋아요 취소 성공',
        data: { isLiked, likeCount },
        timestamp: '',
      },
      { status: 200 }
    );

  const errorResponse = () =>
    HttpResponse.json(
      { status: 500, code: 'INTERNAL_SERVER_ERROR', message: 'boom', timestamp: '' },
      { status: 500 }
    );

  // 받은 좋아요 요청을 메서드 순서대로 기록한다 — 경로·메서드가 어긋나면 MSW가 경고만 하고
  // 네트워크 에러로 넘어가(setup.ts onUnhandledRequest: 'warn') 롤백 테스트가 엉뚱한 이유로
  // 통과할 수 있어서, 핸들러가 실제로 불렸는지 함께 단언한다.
  let likeRequests: Array<'PUT' | 'DELETE'>;

  function respondLike(method: 'PUT' | 'DELETE', respond: () => Response | Promise<Response>) {
    const register = method === 'PUT' ? http.put : http.delete;
    server.use(
      register(url(API_ENDPOINTS.post.postLike(POST_ID)), async () => {
        likeRequests.push(method);
        return respond();
      })
    );
  }

  beforeEach(() => {
    likeRequests = [];
    respondLike('PUT', () => likeResponse(true, 15));
    respondLike('DELETE', () => likeResponse(false, 14));
  });

  const OTHER_POST: Post = {
    ...mockPost,
    id: 'post-uuid-other',
    userInteractions: { isLiked: false, isBookmarked: false, bookmarkFolderIds: [] },
    stats: { ...mockPost.stats, likeCount: 3 },
  };

  function seedPost(isLiked: boolean, likeCount = 10): Post {
    return {
      ...mockPost,
      userInteractions: { isLiked, isBookmarked: false, bookmarkFolderIds: [] },
      stats: { ...mockPost.stats, likeCount },
    };
  }

  function seedLikeList(posts: Post[]) {
    const seededList: InfiniteData<PostListResponse> = {
      pages: [
        {
          page: 0,
          size: 10,
          content: posts,
          totalElements: posts.length,
          totalPages: 1,
          last: true,
        },
      ],
      pageParams: [0],
    };
    queryClient.setQueryData(postKeys.list(), seededList);
  }

  function findListedPost(postId: Post['id']) {
    const list = queryClient.getQueryData<InfiniteData<PostListResponse>>(postKeys.list());
    return list?.pages[0]?.content.find((p) => p.id === postId);
  }

  function readDetail() {
    return queryClient.getQueryData<Post>(postKeys.detail(POST_ID));
  }

  it('좋아요 PUT은 본문 없이 보낸다(상태가 경로에 다 들어 있어 BE가 본문을 읽지 않는다)', async () => {
    let putBody: string | undefined;
    server.use(
      http.put(url(API_ENDPOINTS.post.postLike(POST_ID)), async ({ request }) => {
        putBody = await request.text();
        return likeResponse(true, 1);
      })
    );

    const { result } = renderHook(() => useLikePostMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate(true);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(putBody).toBe('');
  });

  it('서버가 likeCount=15를 반환하면 낙관적 ±1(11)이 15로 교정된다', async () => {
    const seededPost = seedPost(false);
    queryClient.setQueryData(postKeys.detail(POST_ID), seededPost);
    seedLikeList([seededPost]);

    const { result } = renderHook(() => useLikePostMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate(true);
    });

    // onSuccess 이후 서버 권위값(15)으로 교정됐는지 확인
    // (낙관적 업데이트 10→11, 교정 11→15)
    await waitFor(() => expect(readDetail()?.stats.likeCount).toBe(15));

    expect(likeRequests).toEqual(['PUT']);
    expect(readDetail()?.userInteractions.isLiked).toBe(true);
    expect(findListedPost(POST_ID)?.stats.likeCount).toBe(15);
    expect(findListedPost(POST_ID)?.userInteractions.isLiked).toBe(true);
  });

  it('서버 에러 시 detail + 목록 스냅샷으로 롤백된다', async () => {
    respondLike('PUT', errorResponse);
    const seededPost = seedPost(false);
    queryClient.setQueryData(postKeys.detail(POST_ID), seededPost);
    seedLikeList([seededPost]);

    const { result } = renderHook(() => useLikePostMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate(true);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(likeRequests).toEqual(['PUT']);
    expect(readDetail()?.stats.likeCount).toBe(10);
    expect(readDetail()?.userInteractions.isLiked).toBe(false);
    expect(findListedPost(POST_ID)?.stats.likeCount).toBe(10);
    expect(findListedPost(POST_ID)?.userInteractions.isLiked).toBe(false);
  });

  it('서버 응답 전에 상세·목록의 그 글만 좋아요 수가 1 늘고 좋아요 상태가 켜진다', async () => {
    respondLike('PUT', async () => {
      await delay('infinite');
      return likeResponse(true, 15);
    });
    const seededPost: Post = {
      ...mockPost,
      userInteractions: { isLiked: false, isBookmarked: true, bookmarkFolderIds: [FOLDER_A] },
      stats: { ...mockPost.stats, likeCount: 10 },
    };
    queryClient.setQueryData(postKeys.detail(POST_ID), seededPost);
    seedLikeList([seededPost, OTHER_POST]);

    const { result } = renderHook(() => useLikePostMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate(true);
    });

    await waitFor(() => {
      expect(readDetail()?.stats.likeCount).toBe(11);
      expect(readDetail()?.userInteractions.isLiked).toBe(true);
    });

    // 좋아요는 북마크 상태를 건드리지 않는다
    expect(readDetail()?.userInteractions.isBookmarked).toBe(true);
    expect(readDetail()?.userInteractions.bookmarkFolderIds).toEqual([FOLDER_A]);

    const listedPost = findListedPost(POST_ID);
    expect(listedPost?.stats.likeCount).toBe(11);
    expect(listedPost?.userInteractions.isLiked).toBe(true);
    expect(listedPost?.userInteractions.isBookmarked).toBe(true);
    expect(findListedPost(OTHER_POST.id)).toEqual(OTHER_POST);
  });

  it('이미 좋아요한 글은 서버 응답 전에 좋아요 수가 1 줄고 좋아요 상태가 꺼진다', async () => {
    respondLike('DELETE', async () => {
      await delay('infinite');
      return likeResponse(false, 9);
    });
    const seededPost = seedPost(true);
    queryClient.setQueryData(postKeys.detail(POST_ID), seededPost);
    seedLikeList([seededPost]);

    const { result } = renderHook(() => useLikePostMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate(false);
    });

    await waitFor(() => {
      expect(readDetail()?.stats.likeCount).toBe(9);
      expect(readDetail()?.userInteractions.isLiked).toBe(false);
    });

    expect(likeRequests).toEqual(['DELETE']);
    expect(findListedPost(POST_ID)?.stats.likeCount).toBe(9);
    expect(findListedPost(POST_ID)?.userInteractions.isLiked).toBe(false);
  });

  it('이미 그 상태로 만들라고 하면 응답 전에도 좋아요 수를 바꾸지 않는다', async () => {
    respondLike('PUT', async () => {
      await delay('infinite');
      return likeResponse(true, 10);
    });
    queryClient.setQueryData(postKeys.detail(POST_ID), seedPost(true));

    const { result } = renderHook(() => useLikePostMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate(true);
    });

    await waitFor(() => expect(likeRequests).toEqual(['PUT']));

    expect(readDetail()?.stats.likeCount).toBe(10);
    expect(readDetail()?.userInteractions.isLiked).toBe(true);
  });

  it('응답 전에는 +1(11)이 보이고, 응답이 오면 서버 값(15)으로 바뀌며 목록의 다른 글은 그대로다', async () => {
    const gate = createResponseGate();
    respondLike('PUT', async () => {
      await gate.wait;
      return likeResponse(true, 15);
    });
    const seededPost = seedPost(false);
    queryClient.setQueryData(postKeys.detail(POST_ID), seededPost);
    seedLikeList([seededPost, OTHER_POST]);

    const { result } = renderHook(() => useLikePostMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate(true);
    });

    await waitFor(() => {
      expect(readDetail()?.stats.likeCount).toBe(11);
      expect(readDetail()?.userInteractions.isLiked).toBe(true);
      expect(findListedPost(POST_ID)?.stats.likeCount).toBe(11);
      expect(findListedPost(POST_ID)?.userInteractions.isLiked).toBe(true);
    });

    gate.release();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(readDetail()?.stats.likeCount).toBe(15);
    expect(readDetail()?.userInteractions.isLiked).toBe(true);
    expect(findListedPost(POST_ID)?.stats.likeCount).toBe(15);
    expect(findListedPost(POST_ID)?.userInteractions.isLiked).toBe(true);
    expect(findListedPost(OTHER_POST.id)).toEqual(OTHER_POST);
  });

  it('실패하면 응답 전에 반영됐던 +1과 좋아요 상태가 상세·목록 모두 원래대로 돌아간다', async () => {
    const gate = createResponseGate();
    respondLike('PUT', async () => {
      await gate.wait;
      return errorResponse();
    });
    const seededPost = seedPost(false);
    queryClient.setQueryData(postKeys.detail(POST_ID), seededPost);
    seedLikeList([seededPost]);

    const { result } = renderHook(() => useLikePostMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate(true);
    });

    await waitFor(() => {
      expect(readDetail()?.stats.likeCount).toBe(11);
      expect(readDetail()?.userInteractions.isLiked).toBe(true);
      expect(findListedPost(POST_ID)?.stats.likeCount).toBe(11);
      expect(findListedPost(POST_ID)?.userInteractions.isLiked).toBe(true);
    });

    gate.release();

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(readDetail()?.stats.likeCount).toBe(10);
    expect(readDetail()?.userInteractions.isLiked).toBe(false);
    expect(findListedPost(POST_ID)?.stats.likeCount).toBe(10);
    expect(findListedPost(POST_ID)?.userInteractions.isLiked).toBe(false);
  });

  it('상세 캐시 없이 목록에만 있는 글도 좋아요가 반영되고, 상세 캐시를 새로 만들지 않는다', async () => {
    seedLikeList([seedPost(false)]);

    const { result } = renderHook(() => useLikePostMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate(true);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(findListedPost(POST_ID)?.stats.likeCount).toBe(15);
    expect(findListedPost(POST_ID)?.userInteractions.isLiked).toBe(true);
    expect(readDetail()).toBeUndefined();
  });

  it('피드 목록 조회가 실패해 데이터 없는 목록 캐시가 남아 있어도 상세 좋아요가 반영된다', async () => {
    await queryClient.prefetchInfiniteQuery({
      queryKey: postKeys.list(),
      queryFn: () => Promise.reject(new Error('목록 조회 실패')),
      initialPageParam: 0,
    });
    expect(queryClient.getQueryState(postKeys.list())?.status).toBe('error');
    expect(queryClient.getQueryData(postKeys.list())).toBeUndefined();

    queryClient.setQueryData(postKeys.detail(POST_ID), seedPost(false));

    const { result } = renderHook(() => useLikePostMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate(true);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(readDetail()?.stats.likeCount).toBe(15);
    expect(readDetail()?.userInteractions.isLiked).toBe(true);
  });

  // 북마크 화면(BookmarkPage)은 폴더 캐시로 카드를 그린다 — 상세·피드만 고치면 거기선 안 바뀌었다
  it('북마크 폴더 목록 캐시의 그 글도 좋아요가 바로 반영되고 서버 값으로 교정된다', async () => {
    const gate = createResponseGate();
    respondLike('PUT', async () => {
      await gate.wait;
      return likeResponse(true, 15);
    });
    const folderPosts: InfiniteData<PostListResponse> = {
      pages: [
        {
          page: 0,
          size: 10,
          content: [seedPost(false), OTHER_POST],
          totalElements: 2,
          totalPages: 1,
          last: true,
        },
      ],
      pageParams: [0],
    };
    queryClient.setQueryData(bookmarkFolderKeys.posts('all'), folderPosts);
    const findFolderPost = (postId: Post['id']) =>
      queryClient
        .getQueryData<InfiniteData<PostListResponse>>(bookmarkFolderKeys.posts('all'))
        ?.pages[0]?.content.find((p) => p.id === postId);

    const { result } = renderHook(() => useLikePostMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate(true);
    });

    await waitFor(() => {
      expect(findFolderPost(POST_ID)?.userInteractions.isLiked).toBe(true);
      expect(findFolderPost(POST_ID)?.stats.likeCount).toBe(11);
    });

    gate.release();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(findFolderPost(POST_ID)?.stats.likeCount).toBe(15);
    expect(findFolderPost(OTHER_POST.id)).toEqual(OTHER_POST);
  });

  describe('연타 — 같은 글의 요청은 한 줄로 나가고, 마지막 요청이 끝날 때 화면을 확정한다', () => {
    function gateLike(method: 'PUT' | 'DELETE', respond: () => Response) {
      const gate = createResponseGate();
      respondLike(method, async () => {
        await gate.wait;
        return respond();
      });
      return gate;
    }

    function renderWithPost(post: Post) {
      queryClient.setQueryData(postKeys.detail(POST_ID), post);
      seedLikeList([post]);
      return renderHook(() => useLikePostMutation(POST_ID), { wrapper: Wrapper });
    }

    it('두 번째 요청은 첫 요청의 응답이 온 뒤에야 나가고, 화면은 클릭마다 바로 바뀐다', async () => {
      const putGate = gateLike('PUT', () => likeResponse(true, 11));
      const { result } = renderWithPost(seedPost(false));

      act(() => {
        result.current.mutate(true);
      });
      await waitFor(() => expect(likeRequests).toEqual(['PUT']));

      act(() => {
        result.current.mutate(false);
      });

      // 두 번째 클릭의 화면 반영은 응답을 기다리지 않는다
      await waitFor(() => {
        expect(readDetail()?.userInteractions.isLiked).toBe(false);
        expect(readDetail()?.stats.likeCount).toBe(10);
      });
      // 요청은 아직 하나뿐이다 — 첫 응답이 와야 DELETE가 나간다
      expect(likeRequests).toEqual(['PUT']);

      putGate.release();

      await waitFor(() => expect(likeRequests).toEqual(['PUT', 'DELETE']));
    });

    it('(a) 첫 응답이 와도 뒤 요청이 남아 있으면 화면을 덮어쓰지 않고, 마지막 응답 값으로 끝난다', async () => {
      const putGate = gateLike('PUT', () => likeResponse(true, 11));
      // 그 사이 다른 사람이 좋아요를 눌러 서버 수가 20이 된 상황
      const deleteGate = gateLike('DELETE', () => likeResponse(false, 20));
      const { result } = renderWithPost(seedPost(false));

      act(() => {
        result.current.mutate(true);
      });
      act(() => {
        result.current.mutate(false);
      });
      await waitFor(() => expect(readDetail()?.userInteractions.isLiked).toBe(false));

      putGate.release();
      await waitFor(() => expect(likeRequests).toEqual(['PUT', 'DELETE']));

      // 첫 응답(켜짐, 11)으로 깜빡이지 않는다
      expect(readDetail()?.userInteractions.isLiked).toBe(false);
      expect(readDetail()?.stats.likeCount).toBe(10);

      deleteGate.release();

      await waitFor(() => expect(readDetail()?.stats.likeCount).toBe(20));
      expect(readDetail()?.userInteractions.isLiked).toBe(false);
      expect(findListedPost(POST_ID)?.stats.likeCount).toBe(20);
    });

    it('(b) 중간 요청이 실패해도 되돌리지 않고, 마지막 요청이 성공하면 그 응답 값으로 끝난다', async () => {
      // 세 번 누른다(켜기→끄기→켜기). 두 번만 누르면 "첫 클릭 전 상태"와 "두 번째 클릭 뒤 상태"가
      // 같아져, 잘못 되돌려도 화면이 같아 보여 이 테스트가 아무것도 증명하지 못한다.
      const firstPutGate = createResponseGate();
      let putCount = 0;
      respondLike('PUT', async () => {
        putCount += 1;

        if (putCount === 1) {
          await firstPutGate.wait;
          return errorResponse();
        }

        return likeResponse(true, 30);
      });
      const deleteGate = gateLike('DELETE', () => likeResponse(false, 29));
      const { result } = renderWithPost(seedPost(false));

      act(() => {
        result.current.mutate(true);
      });
      act(() => {
        result.current.mutate(false);
      });
      act(() => {
        result.current.mutate(true);
      });
      await waitFor(() => expect(readDetail()?.userInteractions.isLiked).toBe(true));

      firstPutGate.release();
      await waitFor(() => expect(likeRequests).toEqual(['PUT', 'DELETE']));

      // 첫 요청이 실패했지만 첫 클릭 전(꺼짐, 10)으로 되돌리지 않고 마지막 클릭 상태 그대로다
      expect(readDetail()?.userInteractions.isLiked).toBe(true);
      expect(readDetail()?.stats.likeCount).toBe(11);

      deleteGate.release();

      await waitFor(() => expect(likeRequests).toEqual(['PUT', 'DELETE', 'PUT']));
      await waitFor(() => expect(readDetail()?.stats.likeCount).toBe(30));
      expect(readDetail()?.userInteractions.isLiked).toBe(true);
    });

    it('(c) 앞 요청이 성공하고 뒤 요청이 실패하면 되돌린 뒤 다시 조회하도록 무효화한다', async () => {
      respondLike('PUT', () => likeResponse(true, 11));
      respondLike('DELETE', errorResponse);
      const { result } = renderWithPost(seedPost(false));

      act(() => {
        result.current.mutate(true);
      });
      act(() => {
        result.current.mutate(false);
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(likeRequests).toEqual(['PUT', 'DELETE']);
      // 뒤 요청 직전 상태(켜짐, 11)로 되돌린다 — 앞 요청이 성공했으니 서버와 같다
      expect(readDetail()?.userInteractions.isLiked).toBe(true);
      expect(readDetail()?.stats.likeCount).toBe(11);
      expect(queryClient.getQueryState(postKeys.detail(POST_ID))?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(postKeys.list())?.isInvalidated).toBe(true);
    });

    it('(d) 둘 다 실패하면 되돌린 값이 서버와 다를 수 있어 다시 조회하도록 무효화한다', async () => {
      respondLike('PUT', errorResponse);
      respondLike('DELETE', errorResponse);
      const folderPostsKey = bookmarkFolderKeys.posts('all');
      queryClient.setQueryData<InfiniteData<PostListResponse>>(folderPostsKey, {
        pages: [
          {
            page: 0,
            size: 10,
            content: [seedPost(false)],
            totalElements: 1,
            totalPages: 1,
            last: true,
          },
        ],
        pageParams: [0],
      });
      const readFolderPost = () =>
        queryClient.getQueryData<InfiniteData<PostListResponse>>(folderPostsKey)?.pages[0]
          ?.content[0];
      const { result } = renderWithPost(seedPost(false));

      act(() => {
        result.current.mutate(true);
      });
      act(() => {
        result.current.mutate(false);
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(likeRequests).toEqual(['PUT', 'DELETE']);
      // 북마크 폴더 캐시도 마지막 요청 직전 스냅샷(켜짐, 11)으로 되돌린다
      expect(readFolderPost()?.userInteractions.isLiked).toBe(true);
      expect(readFolderPost()?.stats.likeCount).toBe(11);
      // 화면이 서버(꺼짐, 10)와 어긋난 채 남지 않도록 상세·피드·폴더 캐시를 무효화한다
      expect(queryClient.getQueryState(postKeys.detail(POST_ID))?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(postKeys.list())?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(folderPostsKey)?.isInvalidated).toBe(true);
    });

    it('(e) 줄에서 기다리는 사이 다른 계정이 되면 뒤 요청은 보내지 않고 실패로 끝나, 마지막 요청으로서 되돌린다', async () => {
      // 운영 queryClient.ts처럼 누른 순간의 인증 세대를 기록하는 전역 onMutate를 단다
      queryClient = new QueryClient({
        mutationCache: new MutationCache({
          onMutate: (_variables, _mutation, context) => rememberMutationAuthEpoch(context),
        }),
        defaultOptions: { queries: { retry: 0, gcTime: Infinity }, mutations: { retry: 0 } },
      });
      AuthEpochUtil.markLogin();
      const putGate = gateLike('PUT', () => likeResponse(true, 11));
      const { result } = renderWithPost(seedPost(false));

      act(() => {
        result.current.mutate(true);
      });
      act(() => {
        result.current.mutate(false);
      });
      await waitFor(() => expect(likeRequests).toEqual(['PUT']));

      // 다른 탭에서 다른 계정으로 로그인했다
      LocalStorageUtil.setItem(STORAGE_KEYS.AUTH.EPOCH, 'in:other-tab');
      putGate.release();

      // 끝나지 않은 채 남지 않는다 - 결과를 기다리던 화면(북마크 폴더 대화상자 등)이 풀린다
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBeInstanceOf(SessionChangedError);
      expect(likeRequests).toEqual(['PUT']);
      // 뒤 요청 직전 스냅샷(켜짐, 11)으로 되돌리고, 서버 값으로 다시 맞추도록 무효화한다
      expect(readDetail()?.userInteractions.isLiked).toBe(true);
      expect(readDetail()?.stats.likeCount).toBe(11);
      expect(queryClient.getQueryState(postKeys.detail(POST_ID))?.isInvalidated).toBe(true);
    });
  });
});

describe('useLikeCommentMutation', () => {
  const COMMENT_ID = 'comment-uuid-1';

  it('중간 요청이 실패해도 되돌리지 않고, 마지막 요청이 실패하면 되돌린 뒤 댓글 목록을 무효화한다', async () => {
    // 세 번 누른다(켜기→끄기→켜기) — 이유는 useLikePostMutation (b) 테스트 참고
    const requests: Array<'PUT' | 'DELETE'> = [];
    const firstPutGate = createResponseGate();
    const deleteGate = createResponseGate();
    const failure = () =>
      HttpResponse.json({ status: 500, code: 'X', message: '', timestamp: '' }, { status: 500 });
    server.use(
      http.put(url(API_ENDPOINTS.post.commentLike(COMMENT_ID)), async () => {
        requests.push('PUT');

        if (requests.length === 1) {
          await firstPutGate.wait;
        }

        return failure();
      }),
      http.delete(url(API_ENDPOINTS.post.commentLike(COMMENT_ID)), async () => {
        requests.push('DELETE');
        await deleteGate.wait;
        return new HttpResponse(null, { status: 204 });
      })
    );
    const seededComments = [
      { id: COMMENT_ID, isLiked: false, likeCount: 2, replies: [] },
    ] as unknown as Comment[];
    queryClient.setQueryData(commentKeys.list(POST_ID), seededComments);
    const readComment = () => queryClient.getQueryData<Comment[]>(commentKeys.list(POST_ID))?.[0];

    const { result } = renderHook(() => useLikeCommentMutation(COMMENT_ID, POST_ID), {
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

    firstPutGate.release();
    await waitFor(() => expect(requests).toEqual(['PUT', 'DELETE']));

    // 첫 요청이 실패했지만 첫 클릭 전(꺼짐, 2)으로 되돌리지 않는다
    expect(readComment()?.isLiked).toBe(true);
    expect(readComment()?.likeCount).toBe(3);

    deleteGate.release();
    await waitFor(() => expect(requests).toEqual(['PUT', 'DELETE', 'PUT']));
    await waitFor(() => expect(result.current.isError).toBe(true));

    // 마지막 PUT 직전 상태(꺼짐, 2 — 두 번째 클릭의 낙관적 상태)로 되돌리고 다시 조회하게 한다
    expect(readComment()?.isLiked).toBe(false);
    expect(readComment()?.likeCount).toBe(2);
    expect(queryClient.getQueryState(commentKeys.list(POST_ID))?.isInvalidated).toBe(true);
  });
});
