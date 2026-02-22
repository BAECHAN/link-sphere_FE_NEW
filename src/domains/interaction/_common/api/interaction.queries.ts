import { useMutation, InfiniteData } from '@tanstack/react-query';
import { interactionApi } from '@/domains/interaction/_common/api/interaction.api';
import { queryClient } from '@/shared/lib/react-query/config/queryClient';
import { postKeys } from '@/domains/post/_common/api/post.keys';
import { commentKeys } from '@/domains/post/_common/api/comment.keys';
import { Post, PostListResponse } from '@/domains/post/_common/model/post.schema';
import { Comment } from '@/domains/post/_common/model/comment.schema';

export const useLikePostMutation = (postId: Post['id']) => {
  return useMutation({
    mutationFn: () => interactionApi.toggleLikePost(postId),
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
    onSuccess: () => {
      // 낙관적 업데이트를 사용하므로 즉시 목록을 무효화할 필요는 없습니다.
    },
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
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: postKeys.detail(postId) });
      await queryClient.cancelQueries({ queryKey: postKeys.listRoot });

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

      return { previousPost };
    },
    onSuccess: () => {
      // 낙관적 업데이트를 사용하므로 즉시 목록을 무효화할 필요는 없습니다.
      // 필요 시 상세 정보만 업데이트하거나, 사용자가 명시적으로 새로고침할 때 반영되도록 합니다.
    },
    onError: (_err, _variables, context) => {
      if (context?.previousPost) {
        queryClient.setQueryData(postKeys.detail(postId), context.previousPost);
      }
    },
  });
};

export const useLikeCommentMutation = (commentId: Comment['id'], postId: Post['id']) => {
  return useMutation({
    mutationFn: () => interactionApi.toggleLikeComment(commentId),
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
