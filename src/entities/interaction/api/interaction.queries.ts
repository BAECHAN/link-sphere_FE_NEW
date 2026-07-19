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

      if (previousPost) {
        queryClient.setQueryData<Post>(postKeys.detail(postId), {
          ...previousPost,
          userInteractions: {
            ...previousPost.userInteractions,
            isBookmarked: !previousPost.userInteractions.isBookmarked,
          },
          stats: {
            ...previousPost.stats,
            bookmarkCount: previousPost.userInteractions.isBookmarked
              ? previousPost.stats.bookmarkCount - 1
              : previousPost.stats.bookmarkCount + 1,
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
                        isBookmarked: !post.userInteractions.isBookmarked,
                      },
                      stats: {
                        ...post.stats,
                        bookmarkCount: post.userInteractions.isBookmarked
                          ? post.stats.bookmarkCount - 1
                          : post.stats.bookmarkCount + 1,
                      },
                    }
                  : post
              ),
            })),
          };
        }
      );

      // 북마크 화면(folder 캐시) 낙관적 반영 — 폴더 목록에 존재하면 '제거' 케이스로 간주
      const previousFolderPosts = queryClient.getQueriesData<InfiniteData<PostListResponse>>({
        queryKey: folderKeys.postsRoot,
      });
      const previousFolderList = queryClient.getQueryData<FolderListResponse>(folderKeys.list);

      const bookmarkedPost = previousFolderPosts
        .flatMap(([, data]) => data?.pages.flatMap((page) => page.content) ?? [])
        .find((post) => post.id === postId);

      if (bookmarkedPost) {
        // 카드 제거 + totalElements 감소
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

        // 폴더 건수 감소 — 미분류(null)면 uncategorizedCount, 그 외엔 해당 폴더 bookmarkCount
        const folderId = bookmarkedPost.userInteractions.bookmarkFolderId;
        if (previousFolderList) {
          queryClient.setQueryData<FolderListResponse>(
            folderKeys.list,
            folderId === null
              ? {
                  ...previousFolderList,
                  uncategorizedCount: Math.max(0, previousFolderList.uncategorizedCount - 1),
                }
              : {
                  ...previousFolderList,
                  folders: previousFolderList.folders.map((folder) =>
                    folder.id === folderId
                      ? { ...folder, bookmarkCount: Math.max(0, folder.bookmarkCount - 1) }
                      : folder
                  ),
                }
          );
        }
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
