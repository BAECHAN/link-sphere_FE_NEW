import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse, delay } from 'msw';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, type InfiniteData } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { createTestQueryClient } from '@/test/utils';
import { postKeys } from '@/entities/post/api/post.keys';
import { bookmarkFolderKeys } from '@/entities/bookmark/folder/api/bookmark-folder.keys';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import type { Post, PostListResponse } from '@/entities/post/model/post.schema';
import type { BookmarkFolderListResponse } from '@/entities/bookmark/folder/model/bookmark-folder.schema';
import {
  useBookmarkPostMutation,
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
      result.current.mutate();
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

  it('서버 에러 시 post.detail·post.list·folder.list를 롤백한다', async () => {
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
      result.current.mutate();
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
        result.current.mutate();
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
        result.current.mutate();
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
      result.current.mutate();
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

  it('토글에 성공하면 폴더 목록과 폴더별 게시글 캐시를 무효화해 서버 값으로 다시 맞춘다', async () => {
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
      result.current.mutate();
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
});

describe('useLikePostMutation', () => {
  beforeEach(() => {
    server.use(
      http.post(url(API_ENDPOINTS.post.togglePostLike(POST_ID)), () =>
        HttpResponse.json(
          {
            status: 200,
            message: '좋아요 성공',
            data: { isLiked: true, likeCount: 15 },
            timestamp: new Date().toISOString(),
          },
          { status: 200 }
        )
      )
    );
  });

  it('서버가 likeCount=15를 반환하면 낙관적 ±1(11)이 15로 교정된다', async () => {
    const seededPost: Post = {
      ...mockPost,
      userInteractions: { isLiked: false, isBookmarked: false, bookmarkFolderIds: [] },
      stats: { ...mockPost.stats, likeCount: 10 },
    };
    queryClient.setQueryData(postKeys.detail(POST_ID), seededPost);

    const seededList: InfiniteData<PostListResponse> = {
      pages: [
        { page: 0, size: 10, content: [seededPost], totalElements: 1, totalPages: 1, last: true },
      ],
      pageParams: [0],
    };
    queryClient.setQueryData(postKeys.list(), seededList);

    const { result } = renderHook(() => useLikePostMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate();
    });

    // onSuccess 이후 서버 권위값(15)으로 교정됐는지 확인
    // (낙관적 업데이트 10→11, 교정 11→15)
    await waitFor(() => {
      const post = queryClient.getQueryData<Post>(postKeys.detail(POST_ID));
      expect(post?.stats.likeCount).toBe(15);
    });

    const post = queryClient.getQueryData<Post>(postKeys.detail(POST_ID));
    expect(post?.userInteractions.isLiked).toBe(true);

    const list = queryClient.getQueryData<InfiniteData<PostListResponse>>(postKeys.list());
    const listedPost = list?.pages[0]?.content.find((p) => p.id === POST_ID);
    expect(listedPost?.stats.likeCount).toBe(15);
    expect(listedPost?.userInteractions.isLiked).toBe(true);
  });

  it('서버 에러 시 detail + 목록 스냅샷으로 롤백된다', async () => {
    server.use(
      http.post(url(API_ENDPOINTS.post.togglePostLike(POST_ID)), () =>
        HttpResponse.json(
          { status: 500, code: 'INTERNAL_SERVER_ERROR', message: 'boom', timestamp: '' },
          { status: 500 }
        )
      )
    );

    const seededPost: Post = {
      ...mockPost,
      userInteractions: { isLiked: false, isBookmarked: false, bookmarkFolderIds: [] },
      stats: { ...mockPost.stats, likeCount: 10 },
    };
    queryClient.setQueryData(postKeys.detail(POST_ID), seededPost);

    const seededList: InfiniteData<PostListResponse> = {
      pages: [
        { page: 0, size: 10, content: [seededPost], totalElements: 1, totalPages: 1, last: true },
      ],
      pageParams: [0],
    };
    queryClient.setQueryData(postKeys.list(), seededList);

    const { result } = renderHook(() => useLikePostMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    const post = queryClient.getQueryData<Post>(postKeys.detail(POST_ID));
    expect(post?.stats.likeCount).toBe(10);
    expect(post?.userInteractions.isLiked).toBe(false);

    const list = queryClient.getQueryData<InfiniteData<PostListResponse>>(postKeys.list());
    const listedPost = list?.pages[0]?.content.find((p) => p.id === POST_ID);
    expect(listedPost?.stats.likeCount).toBe(10);
    expect(listedPost?.userInteractions.isLiked).toBe(false);
  });

  const OTHER_POST: Post = {
    ...mockPost,
    id: 'post-uuid-other',
    userInteractions: { isLiked: false, isBookmarked: false, bookmarkFolderIds: [] },
    stats: { ...mockPost.stats, likeCount: 3 },
  };

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

  function gateLikeResponse(respond: () => Response) {
    const gate = createResponseGate();
    server.use(
      http.post(url(API_ENDPOINTS.post.togglePostLike(POST_ID)), async () => {
        await gate.wait;
        return respond();
      })
    );
    return gate;
  }

  const likeSuccessResponse = () =>
    HttpResponse.json(
      {
        status: 200,
        message: '좋아요 성공',
        data: { isLiked: true, likeCount: 15 },
        timestamp: '',
      },
      { status: 200 }
    );

  it('서버 응답 전에 상세·목록의 그 글만 좋아요 수가 1 늘고 좋아요 상태가 켜진다', async () => {
    server.use(
      http.post(url(API_ENDPOINTS.post.togglePostLike(POST_ID)), async () => {
        await delay('infinite');
      })
    );
    const seededPost: Post = {
      ...mockPost,
      userInteractions: { isLiked: false, isBookmarked: true, bookmarkFolderIds: [FOLDER_A] },
      stats: { ...mockPost.stats, likeCount: 10 },
    };
    queryClient.setQueryData(postKeys.detail(POST_ID), seededPost);
    seedLikeList([seededPost, OTHER_POST]);

    const { result } = renderHook(() => useLikePostMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      const post = queryClient.getQueryData<Post>(postKeys.detail(POST_ID));
      expect(post?.stats.likeCount).toBe(11);
      expect(post?.userInteractions.isLiked).toBe(true);
    });

    // 좋아요는 북마크 상태를 건드리지 않는다
    const post = queryClient.getQueryData<Post>(postKeys.detail(POST_ID));
    expect(post?.userInteractions.isBookmarked).toBe(true);
    expect(post?.userInteractions.bookmarkFolderIds).toEqual([FOLDER_A]);

    const listedPost = findListedPost(POST_ID);
    expect(listedPost?.stats.likeCount).toBe(11);
    expect(listedPost?.userInteractions.isLiked).toBe(true);
    expect(listedPost?.userInteractions.isBookmarked).toBe(true);
    expect(findListedPost(OTHER_POST.id)).toEqual(OTHER_POST);
  });

  it('이미 좋아요한 글은 서버 응답 전에 좋아요 수가 1 줄고 좋아요 상태가 꺼진다', async () => {
    server.use(
      http.post(url(API_ENDPOINTS.post.togglePostLike(POST_ID)), async () => {
        await delay('infinite');
      })
    );
    const seededPost: Post = {
      ...mockPost,
      userInteractions: { isLiked: true, isBookmarked: false, bookmarkFolderIds: [] },
      stats: { ...mockPost.stats, likeCount: 10 },
    };
    queryClient.setQueryData(postKeys.detail(POST_ID), seededPost);
    seedLikeList([seededPost]);

    const { result } = renderHook(() => useLikePostMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      const post = queryClient.getQueryData<Post>(postKeys.detail(POST_ID));
      expect(post?.stats.likeCount).toBe(9);
      expect(post?.userInteractions.isLiked).toBe(false);
    });

    const listedPost = findListedPost(POST_ID);
    expect(listedPost?.stats.likeCount).toBe(9);
    expect(listedPost?.userInteractions.isLiked).toBe(false);
  });

  it('응답 전에는 +1(11)이 보이고, 응답이 오면 서버 값(15)으로 바뀌며 목록의 다른 글은 그대로다', async () => {
    const gate = gateLikeResponse(likeSuccessResponse);
    const seededPost: Post = {
      ...mockPost,
      userInteractions: { isLiked: false, isBookmarked: false, bookmarkFolderIds: [] },
      stats: { ...mockPost.stats, likeCount: 10 },
    };
    queryClient.setQueryData(postKeys.detail(POST_ID), seededPost);
    seedLikeList([seededPost, OTHER_POST]);

    const { result } = renderHook(() => useLikePostMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      const post = queryClient.getQueryData<Post>(postKeys.detail(POST_ID));
      expect(post?.stats.likeCount).toBe(11);
      expect(post?.userInteractions.isLiked).toBe(true);
      expect(findListedPost(POST_ID)?.stats.likeCount).toBe(11);
      expect(findListedPost(POST_ID)?.userInteractions.isLiked).toBe(true);
    });

    gate.release();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const post = queryClient.getQueryData<Post>(postKeys.detail(POST_ID));
    expect(post?.stats.likeCount).toBe(15);
    expect(post?.userInteractions.isLiked).toBe(true);

    const listedPost = findListedPost(POST_ID);
    expect(listedPost?.stats.likeCount).toBe(15);
    expect(listedPost?.userInteractions.isLiked).toBe(true);
    expect(findListedPost(OTHER_POST.id)).toEqual(OTHER_POST);
  });

  it('실패하면 응답 전에 반영됐던 +1과 좋아요 상태가 상세·목록 모두 원래대로 돌아간다', async () => {
    const gate = gateLikeResponse(() =>
      HttpResponse.json(
        { status: 500, code: 'INTERNAL_SERVER_ERROR', message: 'boom', timestamp: '' },
        { status: 500 }
      )
    );
    const seededPost: Post = {
      ...mockPost,
      userInteractions: { isLiked: false, isBookmarked: false, bookmarkFolderIds: [] },
      stats: { ...mockPost.stats, likeCount: 10 },
    };
    queryClient.setQueryData(postKeys.detail(POST_ID), seededPost);
    seedLikeList([seededPost]);

    const { result } = renderHook(() => useLikePostMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      const post = queryClient.getQueryData<Post>(postKeys.detail(POST_ID));
      expect(post?.stats.likeCount).toBe(11);
      expect(post?.userInteractions.isLiked).toBe(true);
      expect(findListedPost(POST_ID)?.stats.likeCount).toBe(11);
      expect(findListedPost(POST_ID)?.userInteractions.isLiked).toBe(true);
    });

    gate.release();

    await waitFor(() => expect(result.current.isError).toBe(true));

    const post = queryClient.getQueryData<Post>(postKeys.detail(POST_ID));
    expect(post?.stats.likeCount).toBe(10);
    expect(post?.userInteractions.isLiked).toBe(false);

    const listedPost = findListedPost(POST_ID);
    expect(listedPost?.stats.likeCount).toBe(10);
    expect(listedPost?.userInteractions.isLiked).toBe(false);
  });

  it('상세 캐시 없이 목록에만 있는 글도 좋아요가 반영되고, 상세 캐시를 새로 만들지 않는다', async () => {
    const seededPost: Post = {
      ...mockPost,
      userInteractions: { isLiked: false, isBookmarked: false, bookmarkFolderIds: [] },
      stats: { ...mockPost.stats, likeCount: 10 },
    };
    seedLikeList([seededPost]);

    const { result } = renderHook(() => useLikePostMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const listedPost = findListedPost(POST_ID);
    expect(listedPost?.stats.likeCount).toBe(15);
    expect(listedPost?.userInteractions.isLiked).toBe(true);
    expect(queryClient.getQueryData(postKeys.detail(POST_ID))).toBeUndefined();
  });

  it('피드 목록 조회가 실패해 데이터 없는 목록 캐시가 남아 있어도 상세 좋아요가 반영된다', async () => {
    await queryClient.prefetchInfiniteQuery({
      queryKey: postKeys.list(),
      queryFn: () => Promise.reject(new Error('목록 조회 실패')),
      initialPageParam: 0,
    });
    expect(queryClient.getQueryState(postKeys.list())?.status).toBe('error');
    expect(queryClient.getQueryData(postKeys.list())).toBeUndefined();

    const seededPost: Post = {
      ...mockPost,
      userInteractions: { isLiked: false, isBookmarked: false, bookmarkFolderIds: [] },
      stats: { ...mockPost.stats, likeCount: 10 },
    };
    queryClient.setQueryData(postKeys.detail(POST_ID), seededPost);

    const { result } = renderHook(() => useLikePostMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const post = queryClient.getQueryData<Post>(postKeys.detail(POST_ID));
    expect(post?.stats.likeCount).toBe(15);
    expect(post?.userInteractions.isLiked).toBe(true);
  });
});
