import {
  InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { queryClient } from '@/shared/lib/react-query/config/queryClient';
import { folderApi } from '@/entities/folder/api/folder.api';
import {
  folderInvalidateQueries,
  folderKeys,
  folderMutationKeys,
  handleFolderCreateSuccess,
  handleFolderDeleteSuccess,
  handleFolderReorderSuccess,
  handleFolderUpdateSuccess,
  handleMoveBookmarkSuccess,
} from '@/entities/folder/api/folder.keys';
import {
  CreateFolderRequest,
  FolderKey,
  FolderList,
  FolderSort,
  MoveBookmarkRequest,
  ReorderFoldersRequest,
  UpdateFolderRequest,
} from '@/entities/folder/model/folder.schema';
import { POST_PAGE_SIZE } from '@/entities/post/config/const';
import { postKeys } from '@/entities/post/api/post.keys';
import { Post, PostListResponse } from '@/entities/post/model/post.schema';
import { PaginationRequest } from '@/shared/api/common.schema';

// ==================== Queries ====================

export const useFolderListQuery = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: folderKeys.list,
    queryFn: folderApi.fetchFolderList,
    enabled: options?.enabled ?? true,
  });
};

export const useSuspenseFolderListQuery = () => {
  return useSuspenseQuery({
    queryKey: folderKeys.list,
    queryFn: folderApi.fetchFolderList,
  });
};

export const useFolderPostsInfiniteQuery = (
  folderKey: FolderKey,
  sort?: FolderSort,
  search?: string
) => {
  return useInfiniteQuery({
    queryKey: folderKeys.posts(folderKey, sort, search),
    queryFn: ({ pageParam }: { pageParam: PaginationRequest['page'] }) =>
      folderApi.fetchFolderPosts(folderKey, {
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
      };
    },
  });
};

// ==================== Mutations ====================

export const useCreateFolderMutation = () => {
  return useMutation({
    mutationKey: folderMutationKeys.create,
    mutationFn: (payload: CreateFolderRequest) => folderApi.createFolder(payload),
    meta: { manualErrorHandling: true },
    onSuccess: () => {
      handleFolderCreateSuccess();
    },
  });
};

export const useUpdateFolderMutation = (folderId: string) => {
  return useMutation({
    mutationKey: folderMutationKeys.update(folderId),
    mutationFn: (payload: UpdateFolderRequest) => folderApi.updateFolder(folderId, payload),
    meta: { manualErrorHandling: true },
    onSuccess: () => {
      handleFolderUpdateSuccess();
    },
  });
};

export const useDeleteFolderMutation = (folderId: string) => {
  return useMutation({
    mutationKey: folderMutationKeys.delete(folderId),
    mutationFn: () => folderApi.deleteFolder(folderId),
    meta: { manualErrorHandling: true },
    onSuccess: () => {
      handleFolderDeleteSuccess();
    },
  });
};

export const useReorderFoldersMutation = () => {
  return useMutation({
    mutationKey: folderMutationKeys.reorder,
    mutationFn: (payload: ReorderFoldersRequest) => folderApi.reorderFolders(payload),
    meta: { manualErrorHandling: true },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: folderKeys.list });
      const previous = queryClient.getQueryData<FolderList>(folderKeys.list);
      if (previous) {
        const byId = new Map(previous.map((f) => [f.id, f]));
        const next = payload.folderIds
          .map((id, idx) => {
            const f = byId.get(id);
            return f ? { ...f, sortOrder: idx } : null;
          })
          .filter((f): f is NonNullable<typeof f> => f !== null);
        queryClient.setQueryData<FolderList>(folderKeys.list, next);
      }
      return { previous };
    },
    onError: (_err, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(folderKeys.list, context.previous);
      }
    },
    onSuccess: () => {
      handleFolderReorderSuccess();
    },
  });
};

/**
 * 북마크 폴더 이동 (단건).
 *
 * Optimistic update:
 * - post.detail: userInteractions.bookmarkFolderId/isBookmarked 즉시 갱신
 * - post.list: 같은 postId 모두 갱신
 * - folder.list: oldFolderId/newFolderId 의 bookmarkCount 증감 (null = 미분류, 카운트 대상 아님)
 *
 * BE는 본인 북마크가 없으면 404 BOOKMARK_NOT_FOUND 반환 → 호출 측에서 사전에 토글 처리하거나 에러 핸들링 필요.
 */
export const useMoveBookmarkMutation = (postId: string) => {
  return useMutation({
    mutationKey: folderMutationKeys.moveBookmark(postId),
    mutationFn: (payload: MoveBookmarkRequest) => folderApi.moveBookmark(postId, payload),
    meta: { manualErrorHandling: true },

    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: postKeys.detail(postId) });
      await queryClient.cancelQueries({ queryKey: postKeys.listRoot });
      await queryClient.cancelQueries({ queryKey: folderKeys.list });
      await queryClient.cancelQueries({ queryKey: folderKeys.postsRoot });

      const previousPost = queryClient.getQueryData<Post>(postKeys.detail(postId));

      // post.detail 이 없으면(북마크 화면 등) folder 게시글 캐시에서 현재 폴더 조회
      const cachedFolderPost = previousPost
        ? undefined
        : queryClient
            .getQueriesData<InfiniteData<PostListResponse>>({ queryKey: folderKeys.postsRoot })
            .flatMap(([, data]) => data?.pages.flatMap((page) => page.content) ?? [])
            .find((post) => post.id === postId);

      const previousFolderList = queryClient.getQueryData<FolderList>(folderKeys.list);
      const previousFolderId =
        previousPost?.userInteractions.bookmarkFolderId ??
        cachedFolderPost?.userInteractions.bookmarkFolderId ??
        null;
      const nextFolderId = payload.folderId;

      // 1) post.detail
      if (previousPost) {
        queryClient.setQueryData<Post>(postKeys.detail(postId), {
          ...previousPost,
          userInteractions: {
            ...previousPost.userInteractions,
            isBookmarked: true,
            bookmarkFolderId: nextFolderId,
          },
        });
      }

      // 2) post.list (infinite)
      queryClient.setQueriesData<InfiniteData<PostListResponse>>(
        { queryKey: postKeys.listRoot },
        (oldData) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              content: page.content.map((post) =>
                post.id === postId
                  ? {
                      ...post,
                      userInteractions: {
                        ...post.userInteractions,
                        isBookmarked: true,
                        bookmarkFolderId: nextFolderId,
                      },
                    }
                  : post
              ),
            })),
          };
        }
      );

      // 3) folder.list — bookmarkCount 증감 (미분류 null 은 list 에 없음)
      if (previousFolderList && previousFolderId !== nextFolderId) {
        queryClient.setQueryData<FolderList>(
          folderKeys.list,
          previousFolderList.map((f) => {
            if (f.id === previousFolderId)
              return { ...f, bookmarkCount: Math.max(0, f.bookmarkCount - 1) };
            if (f.id === nextFolderId) return { ...f, bookmarkCount: f.bookmarkCount + 1 };
            return f;
          })
        );
      }

      return { previousPost, previousFolderList };
    },

    onError: (_err, _payload, context) => {
      if (context?.previousPost) {
        queryClient.setQueryData(postKeys.detail(postId), context.previousPost);
      }
      if (context?.previousFolderList) {
        queryClient.setQueryData(folderKeys.list, context.previousFolderList);
      }
      // post.list 는 invalidate 로 복구 (롤백 데이터 보존 비용 회피)
      folderInvalidateQueries.postsRoot();
      queryClient.invalidateQueries({ queryKey: postKeys.listRoot });
    },

    onSuccess: () => {
      handleMoveBookmarkSuccess(postId);
    },
  });
};
