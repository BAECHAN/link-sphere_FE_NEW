import {
  InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { bookmarkFolderApi } from '@/entities/bookmark/folder/api/bookmark-folder.api';
import {
  bookmarkFolderInvalidateQueries,
  bookmarkFolderKeys,
  bookmarkFolderMutationKeys,
  handleBookmarkFolderChangeSuccess,
  handleBookmarkFolderCreateSuccess,
  handleBookmarkFolderDeleteSuccess,
  handleBookmarkFolderReorderSuccess,
  handleBookmarkFolderUpdateSuccess,
} from '@/entities/bookmark/folder/api/bookmark-folder.keys';
import {
  BookmarkFolderKey,
  BookmarkFolderListResponse,
  BookmarkFolderSort,
  CreateBookmarkFolderRequest,
  ReorderBookmarkFoldersRequest,
  UpdateBookmarkFolderRequest,
} from '@/entities/bookmark/folder/model/bookmark-folder.schema';
import { POST_PAGE_SIZE } from '@/entities/post/config/post.const';
import { postInvalidateQueries, postKeys } from '@/entities/post/api/post.keys';
import { Post, PostListResponse } from '@/entities/post/model/post.schema';
import { PaginationRequest } from '@/shared/types/common.type';

// ==================== Queries ====================

export const useBookmarkFolderListQuery = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: bookmarkFolderKeys.list,
    queryFn: bookmarkFolderApi.fetchBookmarkFolderList,
    enabled: options?.enabled ?? true,
  });
};

export const useBookmarkFolderPostsInfiniteQuery = (
  folderKey: BookmarkFolderKey,
  sort?: BookmarkFolderSort,
  search?: string
) => {
  return useInfiniteQuery({
    queryKey: bookmarkFolderKeys.posts(folderKey, sort, search),
    queryFn: ({ pageParam }: { pageParam: PaginationRequest['page'] }) =>
      bookmarkFolderApi.fetchBookmarkFolderPosts(folderKey, {
        page: pageParam,
        size: POST_PAGE_SIZE,
        sort,
        search,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => (lastPage.last ? undefined : lastPage.page + 1),
    select: (data) => {
      const seen = new Set<string>();
      const posts = data.pages
        .flatMap((page) => page.content)
        .filter((post) => (seen.has(post.id) ? false : seen.add(post.id) && true));
      return {
        pages: data.pages,
        pageParams: data.pageParams,
        posts,
        totalElements: data.pages[0]?.totalElements ?? 0,
        correctedSearch: data.pages[0]?.correctedSearch,
      };
    },
  });
};

/** hover 시 폴더 게시글 첫 페이지 미리 로드 — useBookmarkFolderPostsInfiniteQuery 와 동일 키/queryFn */
export const prefetchBookmarkFolderPosts = (
  queryClient: QueryClient,
  folderKey: BookmarkFolderKey,
  sort?: BookmarkFolderSort,
  search?: string
) => {
  queryClient.prefetchInfiniteQuery({
    queryKey: bookmarkFolderKeys.posts(folderKey, sort, search),
    queryFn: ({ pageParam }: { pageParam: PaginationRequest['page'] }) =>
      bookmarkFolderApi.fetchBookmarkFolderPosts(folderKey, {
        page: pageParam,
        size: POST_PAGE_SIZE,
        sort,
        search,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage: PostListResponse) =>
      lastPage.last ? undefined : lastPage.page + 1,
  });
};

// ==================== Mutations ====================

export const useCreateBookmarkFolderMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: bookmarkFolderMutationKeys.create,
    mutationFn: (payload: CreateBookmarkFolderRequest) =>
      bookmarkFolderApi.createBookmarkFolder(payload),
    meta: { manualErrorHandling: true },
    onSuccess: () => {
      handleBookmarkFolderCreateSuccess(queryClient);
    },
  });
};

export const useUpdateBookmarkFolderMutation = (folderId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: bookmarkFolderMutationKeys.update(folderId),
    mutationFn: (payload: UpdateBookmarkFolderRequest) =>
      bookmarkFolderApi.updateBookmarkFolder(folderId, payload),
    meta: { manualErrorHandling: true },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: bookmarkFolderKeys.list });
      const previous = queryClient.getQueryData<BookmarkFolderListResponse>(
        bookmarkFolderKeys.list
      );
      if (previous) {
        queryClient.setQueryData<BookmarkFolderListResponse>(bookmarkFolderKeys.list, {
          ...previous,
          folders: previous.folders.map((f) =>
            f.id === folderId ? { ...f, name: payload.name } : f
          ),
        });
      }
      return { previous };
    },
    onError: (_err, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(bookmarkFolderKeys.list, context.previous);
      }
    },
    onSuccess: () => {
      handleBookmarkFolderUpdateSuccess(queryClient);
    },
  });
};

export const useDeleteBookmarkFolderMutation = (folderId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: bookmarkFolderMutationKeys.delete(folderId),
    mutationFn: () => bookmarkFolderApi.deleteBookmarkFolder(folderId),
    meta: { manualErrorHandling: true },
    onSuccess: () => {
      handleBookmarkFolderDeleteSuccess(queryClient);
    },
  });
};

export const useReorderBookmarkFoldersMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: bookmarkFolderMutationKeys.reorder,
    mutationFn: (payload: ReorderBookmarkFoldersRequest) =>
      bookmarkFolderApi.reorderBookmarkFolders(payload),
    meta: { manualErrorHandling: true },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: bookmarkFolderKeys.list });
      const previous = queryClient.getQueryData<BookmarkFolderListResponse>(
        bookmarkFolderKeys.list
      );
      if (previous) {
        const byId = new Map(previous.folders.map((f) => [f.id, f]));
        const next = payload.folderIds
          .map((id, idx) => {
            const f = byId.get(id);
            return f ? { ...f, sortOrder: idx } : null;
          })
          .filter((f): f is NonNullable<typeof f> => f !== null);
        queryClient.setQueryData<BookmarkFolderListResponse>(bookmarkFolderKeys.list, {
          ...previous,
          folders: next,
        });
      }
      return { previous };
    },
    onError: (_err, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(bookmarkFolderKeys.list, context.previous);
      }
    },
    onSuccess: () => {
      handleBookmarkFolderReorderSuccess(queryClient);
    },
  });
};

// ── 폴더 소속 변경 (추가/제거/전체해제) 공용 낙관적 갱신 헬퍼 ──────────

/**
 * post.detail 캐시에 없으면(북마크 화면 등에서 상세를 연 적이 없는 경우) 현재 열려있는
 * 폴더별 게시글 캐시에서 이 글을 찾아 현재 북마크 상태를 읽는다. 둘 다 없으면 기본값.
 */
function resolveCurrentBookmarkState(
  queryClient: QueryClient,
  postId: string
): {
  isBookmarked: boolean;
  folderIds: string[];
} {
  const cachedDetail = queryClient.getQueryData<Post>(postKeys.detail(postId));
  if (cachedDetail) {
    return {
      isBookmarked: cachedDetail.userInteractions.isBookmarked,
      folderIds: cachedDetail.userInteractions.bookmarkFolderIds,
    };
  }
  const cachedFolderPost = queryClient
    .getQueriesData<InfiniteData<PostListResponse>>({ queryKey: bookmarkFolderKeys.postsRoot })
    .flatMap(([, data]) => data?.pages.flatMap((page) => page.content) ?? [])
    .find((post) => post.id === postId);
  if (cachedFolderPost) {
    return {
      isBookmarked: cachedFolderPost.userInteractions.isBookmarked,
      folderIds: cachedFolderPost.userInteractions.bookmarkFolderIds,
    };
  }
  return { isBookmarked: false, folderIds: [] };
}

interface PostBookmarkPatch {
  isBookmarked?: boolean;
  folderIds?: string[];
  bookmarkCountDelta?: number;
}

/**
 * post.detail + 모든 post.list(infinite) 페이지에서 이 글의 userInteractions/stats 를 패치한다.
 * 반환값은 post.detail 의 이전 상태 — onError 롤백용.
 */
function patchPostBookmarkCaches(
  queryClient: QueryClient,
  postId: string,
  patch: PostBookmarkPatch
): Post | undefined {
  const applyPatch = (post: Post): Post => ({
    ...post,
    userInteractions: {
      ...post.userInteractions,
      ...(patch.isBookmarked !== undefined && { isBookmarked: patch.isBookmarked }),
      ...(patch.folderIds !== undefined && { bookmarkFolderIds: patch.folderIds }),
    },
    stats: {
      ...post.stats,
      bookmarkCount: Math.max(0, post.stats.bookmarkCount + (patch.bookmarkCountDelta ?? 0)),
    },
  });

  const previousPost = queryClient.getQueryData<Post>(postKeys.detail(postId));
  if (previousPost) {
    queryClient.setQueryData<Post>(postKeys.detail(postId), applyPatch(previousPost));
  }

  queryClient.setQueriesData<InfiniteData<PostListResponse>>(
    { queryKey: postKeys.listRoot },
    (oldData) => {
      if (!oldData) {
        return oldData;
      }
      return {
        ...oldData,
        pages: oldData.pages.map((page) => ({
          ...page,
          content: page.content.map((post) => (post.id === postId ? applyPatch(post) : post)),
        })),
      };
    }
  );

  return previousPost;
}

/** 특정 folderKey 의 모든 정렬/검색 캐시에서 postId 카드를 즉시 제거한다 (삽입은 하지 않음 — 위치를 모르므로). */
function removePostFromFolderPostsCache(
  queryClient: QueryClient,
  folderKey: BookmarkFolderKey,
  postId: string
) {
  queryClient.setQueriesData<InfiniteData<PostListResponse>>(
    { queryKey: [...bookmarkFolderKeys.postsRoot, folderKey] },
    (oldData) => {
      if (!oldData) {
        return oldData;
      }
      const contains = oldData.pages.some((page) =>
        page.content.some((post) => post.id === postId)
      );
      if (!contains) {
        return oldData;
      }
      return {
        ...oldData,
        pages: oldData.pages.map((page) => ({
          ...page,
          content: page.content.filter((post) => post.id !== postId),
          totalElements: Math.max(0, page.totalElements - 1),
        })),
      };
    }
  );
}

async function cancelBookmarkFolderQueries(queryClient: QueryClient, postId: string) {
  await queryClient.cancelQueries({ queryKey: postKeys.detail(postId) });
  await queryClient.cancelQueries({ queryKey: postKeys.listRoot });
  await queryClient.cancelQueries({ queryKey: bookmarkFolderKeys.list });
  await queryClient.cancelQueries({ queryKey: bookmarkFolderKeys.postsRoot });
}

interface BookmarkFolderMutationContext {
  previousPost: Post | undefined;
  previousFolderList: BookmarkFolderListResponse | undefined;
}

/** post.list 는 스냅샷을 보존하지 않고 무효화로 복구한다 (롤백 데이터 보존 비용 회피) — 기존 관례와 동일. */
function rollbackBookmarkFolderMutation(
  queryClient: QueryClient,
  postId: string,
  context: BookmarkFolderMutationContext | undefined
) {
  if (context?.previousPost) {
    queryClient.setQueryData(postKeys.detail(postId), context.previousPost);
  }
  if (context?.previousFolderList) {
    queryClient.setQueryData(bookmarkFolderKeys.list, context.previousFolderList);
  }
  bookmarkFolderInvalidateQueries.postsRoot(queryClient);
  postInvalidateQueries.list(queryClient);
}

/**
 * 폴더에 추가 (단건) — 북마크가 없으면 BE 가 자동 생성한다 ("북마크 보장 + 소속 보장").
 *
 * Optimistic update:
 * - post.detail/list: bookmarkFolderIds 에 folderId 추가, isBookmarked=true, 미북마크였다면 bookmarkCount +1
 * - folder.list: 그 폴더 bookmarkCount +1(신규 소속일 때만), 미분류를 떠나면 uncategorizedCount -1
 * - folder.posts: 미분류를 떠나는 경우에만 'uncategorized' 캐시에서 카드 제거. 새 폴더/전체 캐시엔 삽입하지
 *   않는다 — sort=title/views/관련도 정렬에서 위치를 알 수 없어서. 등장은 성공 후 postsRoot 무효화가 처리.
 */
export const useAddBookmarkFolderMutation = (postId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: bookmarkFolderMutationKeys.addBookmarkFolder(postId),
    mutationFn: (folderId: string) => bookmarkFolderApi.addBookmarkFolder(postId, folderId),
    meta: { manualErrorHandling: true },

    onMutate: async (folderId): Promise<BookmarkFolderMutationContext> => {
      await cancelBookmarkFolderQueries(queryClient, postId);

      const { isBookmarked: wasBookmarked, folderIds: prevIds } = resolveCurrentBookmarkState(
        queryClient,
        postId
      );
      const alreadyInFolder = prevIds.includes(folderId);
      const leavesUncategorized = wasBookmarked && prevIds.length === 0;

      const previousFolderList = queryClient.getQueryData<BookmarkFolderListResponse>(
        bookmarkFolderKeys.list
      );

      const previousPost = patchPostBookmarkCaches(queryClient, postId, {
        isBookmarked: true,
        folderIds: alreadyInFolder ? prevIds : [...prevIds, folderId],
        bookmarkCountDelta: wasBookmarked ? 0 : 1,
      });

      if (previousFolderList) {
        queryClient.setQueryData<BookmarkFolderListResponse>(bookmarkFolderKeys.list, {
          ...previousFolderList,
          uncategorizedCount: Math.max(
            0,
            previousFolderList.uncategorizedCount + (leavesUncategorized ? -1 : 0)
          ),
          folders: previousFolderList.folders.map((f) =>
            f.id === folderId && !alreadyInFolder ? { ...f, bookmarkCount: f.bookmarkCount + 1 } : f
          ),
        });
      }

      if (leavesUncategorized) {
        removePostFromFolderPostsCache(queryClient, 'uncategorized', postId);
      }

      return { previousPost, previousFolderList };
    },

    onError: (_err, _folderId, context) => {
      rollbackBookmarkFolderMutation(queryClient, postId, context);
    },

    onSuccess: () => {
      handleBookmarkFolderChangeSuccess(queryClient, postId);
    },
  });
};

/**
 * 그 폴더에서만 제거 — 북마크 자체는 유지 (마지막 폴더였어도 미분류로 생존).
 *
 * Optimistic update:
 * - post.detail/list: bookmarkFolderIds 에서 folderId 제외, isBookmarked/bookmarkCount 는 불변
 * - folder.list: 그 폴더 bookmarkCount -1, 마지막 폴더였다면 uncategorizedCount +1
 * - folder.posts: 그 폴더 캐시에서만 카드 제거 (전체 캐시는 그대로 — 여전히 북마크 상태이므로)
 */
export const useRemoveBookmarkFolderMutation = (postId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: bookmarkFolderMutationKeys.removeBookmarkFolder(postId),
    mutationFn: (folderId: string) => bookmarkFolderApi.removeBookmarkFolder(postId, folderId),
    meta: { manualErrorHandling: true },

    onMutate: async (folderId): Promise<BookmarkFolderMutationContext> => {
      await cancelBookmarkFolderQueries(queryClient, postId);

      const { folderIds: prevIds } = resolveCurrentBookmarkState(queryClient, postId);
      const wasLastFolder = prevIds.length === 1 && prevIds[0] === folderId;

      const previousFolderList = queryClient.getQueryData<BookmarkFolderListResponse>(
        bookmarkFolderKeys.list
      );

      const previousPost = patchPostBookmarkCaches(queryClient, postId, {
        folderIds: prevIds.filter((id) => id !== folderId),
      });

      if (previousFolderList) {
        queryClient.setQueryData<BookmarkFolderListResponse>(bookmarkFolderKeys.list, {
          ...previousFolderList,
          uncategorizedCount: previousFolderList.uncategorizedCount + (wasLastFolder ? 1 : 0),
          folders: previousFolderList.folders.map((f) =>
            f.id === folderId ? { ...f, bookmarkCount: Math.max(0, f.bookmarkCount - 1) } : f
          ),
        });
      }

      removePostFromFolderPostsCache(queryClient, folderId, postId);

      return { previousPost, previousFolderList };
    },

    onError: (_err, _folderId, context) => {
      rollbackBookmarkFolderMutation(queryClient, postId, context);
    },

    onSuccess: () => {
      handleBookmarkFolderChangeSuccess(queryClient, postId);
    },
  });
};

/**
 * 폴더 소속 전부 해제 → 미분류로. 북마크 자체는 건드리지 않는다 (미분류 행 탭, 폴더 1개 이상 소속일 때).
 *
 * Optimistic update:
 * - post.detail/list: bookmarkFolderIds = []
 * - folder.list: 이전에 속해있던 모든 폴더 bookmarkCount -1, uncategorizedCount +1
 * - folder.posts: 이전에 속해있던 모든 폴더 캐시에서 카드 제거
 */
export const useClearBookmarkFoldersMutation = (postId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: bookmarkFolderMutationKeys.clearBookmarkFolders(postId),
    mutationFn: () => bookmarkFolderApi.clearBookmarkFolders(postId),
    meta: { manualErrorHandling: true },

    onMutate: async (): Promise<BookmarkFolderMutationContext> => {
      await cancelBookmarkFolderQueries(queryClient, postId);

      const { folderIds: prevIds } = resolveCurrentBookmarkState(queryClient, postId);

      const previousFolderList = queryClient.getQueryData<BookmarkFolderListResponse>(
        bookmarkFolderKeys.list
      );

      const previousPost = patchPostBookmarkCaches(queryClient, postId, { folderIds: [] });

      if (previousFolderList && prevIds.length > 0) {
        const prevIdSet = new Set(prevIds);
        queryClient.setQueryData<BookmarkFolderListResponse>(bookmarkFolderKeys.list, {
          ...previousFolderList,
          uncategorizedCount: previousFolderList.uncategorizedCount + 1,
          folders: previousFolderList.folders.map((f) =>
            prevIdSet.has(f.id) ? { ...f, bookmarkCount: Math.max(0, f.bookmarkCount - 1) } : f
          ),
        });
      }

      prevIds.forEach((folderId) => removePostFromFolderPostsCache(queryClient, folderId, postId));

      return { previousPost, previousFolderList };
    },

    onError: (_err, _variables, context) => {
      rollbackBookmarkFolderMutation(queryClient, postId, context);
    },

    onSuccess: () => {
      handleBookmarkFolderChangeSuccess(queryClient, postId);
    },
  });
};
