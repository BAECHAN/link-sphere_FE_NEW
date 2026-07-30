import { useMutation, InfiniteData } from '@tanstack/react-query';
import { interactionApi } from '@/entities/interaction/api/interaction.api';
import { queryClient } from '@/shared/lib/react-query/config/queryClient';
import { postKeys } from '@/entities/post/api/post.keys';
import { commentKeys } from '@/entities/comment/api/comment.keys';
import { folderKeys, handleBookmarkToggleSuccess } from '@/entities/folder/api/folder.keys';
import { Post, PostListResponse } from '@/entities/post/model/post.schema';
import { FolderListResponse } from '@/entities/folder/model/folder.schema';
import { Comment } from '@/entities/comment/model/comment.schema';

export const useLikePostMutation = (postId: Post['id']) => {
  return useMutation({
    mutationFn: () => interactionApi.toggleLikePost(postId),
    meta: { manualErrorHandling: true },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: postKeys.detail(postId) });
      await queryClient.cancelQueries({ queryKey: postKeys.listRoot });

      const previousPost = queryClient.getQueryData<Post>(postKeys.detail(postId));

      if (previousPost) {
        queryClient.setQueryData<Post>(postKeys.detail(postId), {
          ...previousPost,
          userInteractions: {
            ...previousPost.userInteractions,
            isLiked: !previousPost.userInteractions.isLiked,
          },
          stats: {
            ...previousPost.stats,
            likeCount: previousPost.userInteractions.isLiked
              ? previousPost.stats.likeCount - 1
              : previousPost.stats.likeCount + 1,
          },
        });
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
              content: page.content.map((post) =>
                post.id === postId
                  ? {
                      ...post,
                      userInteractions: {
                        ...post.userInteractions,
                        isLiked: !post.userInteractions.isLiked,
                      },
                      stats: {
                        ...post.stats,
                        likeCount: post.userInteractions.isLiked
                          ? post.stats.likeCount - 1
                          : post.stats.likeCount + 1,
                      },
                    }
                  : post
              ),
            })),
          };
        }
      );
      return { previousPost };
    },
    onSuccess: () => {},
    onError: (_err, _variables, context) => {
      if (context?.previousPost) {
        queryClient.setQueryData(postKeys.detail(postId), context.previousPost);
      }
    },
  });
};

export const useBookmarkPostMutation = (postId: Post['id']) => {
  return useMutation({
    mutationFn: () => interactionApi.toggleBookmarkPost(postId),
    meta: { manualErrorHandling: true },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: postKeys.detail(postId) });
      await queryClient.cancelQueries({ queryKey: postKeys.listRoot });
      await queryClient.cancelQueries({ queryKey: folderKeys.list });
      await queryClient.cancelQueries({ queryKey: folderKeys.postsRoot });

      const previousPost = queryClient.getQueryData<Post>(postKeys.detail(postId));
      const previousFolderPosts = queryClient.getQueriesData<InfiniteData<PostListResponse>>({
        queryKey: folderKeys.postsRoot,
      });
      const previousFolderList = queryClient.getQueryData<FolderListResponse>(folderKeys.list);

      // post.detail 이 없으면(북마크 화면 등) folder 게시글 캐시에서 이 글의 현재 상태를 찾는다.
      // 방향(ON/OFF)은 폴더 캐시에 있는지 여부가 아니라 이 isBookmarked 값 하나로만 결정한다.
      const cachedFolderPost = previousPost
        ? undefined
        : previousFolderPosts
            .flatMap(([, data]) => data?.pages.flatMap((page) => page.content) ?? [])
            .find((post) => post.id === postId);
      const wasBookmarked =
        previousPost?.userInteractions.isBookmarked ??
        cachedFolderPost?.userInteractions.isBookmarked ??
        false;
      const prevFolderIds =
        previousPost?.userInteractions.bookmarkFolderIds ??
        cachedFolderPost?.userInteractions.bookmarkFolderIds ??
        [];
      const nextBookmarked = !wasBookmarked;

      if (previousPost) {
        queryClient.setQueryData<Post>(postKeys.detail(postId), {
          ...previousPost,
          userInteractions: {
            ...previousPost.userInteractions,
            isBookmarked: nextBookmarked,
            bookmarkFolderIds: [],
          },
          stats: {
            ...previousPost.stats,
            bookmarkCount: Math.max(
              0,
              previousPost.stats.bookmarkCount + (nextBookmarked ? 1 : -1)
            ),
          },
        });
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
              content: page.content.map((post) =>
                post.id === postId
                  ? {
                      ...post,
                      userInteractions: {
                        ...post.userInteractions,
                        isBookmarked: nextBookmarked,
                        bookmarkFolderIds: [],
                      },
                      stats: {
                        ...post.stats,
                        bookmarkCount: Math.max(
                          0,
                          post.stats.bookmarkCount + (nextBookmarked ? 1 : -1)
                        ),
                      },
                    }
                  : post
              ),
            })),
          };
        }
      );

      // 북마크 화면(folder 캐시) 낙관적 반영
      if (!nextBookmarked) {
        // OFF — 소속돼있던 모든 폴더 캐시(+ 미분류)에서 카드 제거
        queryClient.setQueriesData<InfiniteData<PostListResponse>>(
          { queryKey: folderKeys.postsRoot },
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

        // 폴더 건수 감소 — 소속돼있던 폴더 전부(여러 개일 수 있음), 소속 0개였다면 uncategorizedCount
        if (previousFolderList) {
          const prevIdSet = new Set(prevFolderIds);
          queryClient.setQueryData<FolderListResponse>(folderKeys.list, {
            ...previousFolderList,
            uncategorizedCount: Math.max(
              0,
              previousFolderList.uncategorizedCount - (prevFolderIds.length === 0 ? 1 : 0)
            ),
            folders: previousFolderList.folders.map((folder) =>
              prevIdSet.has(folder.id)
                ? { ...folder, bookmarkCount: Math.max(0, folder.bookmarkCount - 1) }
                : folder
            ),
          });
        }
      } else if (previousFolderList) {
        // ON — 미분류로 새로 생성됨
        queryClient.setQueryData<FolderListResponse>(folderKeys.list, {
          ...previousFolderList,
          uncategorizedCount: previousFolderList.uncategorizedCount + 1,
        });
      }

      return { previousPost, previousFolderPosts, previousFolderList };
    },
    onSuccess: () => {
      handleBookmarkToggleSuccess();
    },
    onError: (_err, _variables, context) => {
      if (context?.previousPost) {
        queryClient.setQueryData(postKeys.detail(postId), context.previousPost);
      }
      if (context?.previousFolderList) {
        queryClient.setQueryData(folderKeys.list, context.previousFolderList);
      }
      context?.previousFolderPosts?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
  });
};

export const useLikeCommentMutation = (commentId: Comment['id'], postId: Post['id']) => {
  return useMutation({
    mutationFn: () => interactionApi.toggleLikeComment(commentId),
    meta: { manualErrorHandling: true },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: commentKeys.list(postId) });

      const previousComments = queryClient.getQueryData<Comment[]>(commentKeys.list(postId));

      if (previousComments) {
        const updateCommentsRecursively = (comments: Comment[]): Comment[] => {
          return comments.map((comment) => {
            if (comment.id === commentId) {
              return {
                ...comment,
                isLiked: !comment.isLiked,
                likeCount: comment.isLiked ? comment.likeCount - 1 : comment.likeCount + 1,
              };
            }
            if (comment.replies && comment.replies.length > 0) {
              return {
                ...comment,
                replies: updateCommentsRecursively(comment.replies),
              };
            }
            return comment;
          });
        };

        queryClient.setQueryData<Comment[]>(
          commentKeys.list(postId),
          updateCommentsRecursively(previousComments)
        );
      }

      return { previousComments };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(commentKeys.list(postId), context.previousComments);
      }
    },
  });
};
