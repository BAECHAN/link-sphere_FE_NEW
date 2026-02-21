import { useQuery, useMutation } from '@tanstack/react-query';
import { commentApi } from '@/domains/post/_common/api/comment.api';
import { CreateComment } from '@/domains/post/_common/model/comment.schema';
import { commentKeys, commentInvalidateQueries } from '@/domains/post/_common/api/comment.keys';
import {
  postInvalidateQueries,
  handlePostUpdateSuccess,
} from '@/domains/post/_common/api/post.keys';

export const useComments = (postId: string) => {
  return useQuery({
    queryKey: commentKeys.list(postId),
    queryFn: () => commentApi.getComments(postId),
  });
};

export const useCreateCommentMutation = (postId: string) => {
  return useMutation({
    mutationFn: (payload: CreateComment) => commentApi.createComment(postId, payload),
    onSuccess: () => {
      commentInvalidateQueries.list(postId);
      handlePostUpdateSuccess(postId);
    },
  });
};

export const useCreateReplyMutation = (postId: string) => {
  return useMutation({
    mutationFn: ({ commentId, content }: { commentId: string; content: string }) =>
      commentApi.createReply(commentId, { content }),
    onSuccess: () => {
      commentInvalidateQueries.list(postId);
      postInvalidateQueries.detail(postId);
    },
  });
};

export const useDeleteCommentMutation = (postId: string) => {
  return useMutation({
    mutationFn: (commentId: string) => commentApi.deleteComment(commentId),
    onSuccess: () => {
      commentInvalidateQueries.list(postId);
      handlePostUpdateSuccess(postId);
    },
  });
};
export const useUpdateCommentMutation = (postId: string) => {
  return useMutation({
    mutationFn: ({ commentId, content }: { commentId: string; content: string }) =>
      commentApi.updateComment(commentId, { content }),
    onSuccess: () => {
      commentInvalidateQueries.list(postId);
    },
  });
};
