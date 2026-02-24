import { useQuery, useMutation } from '@tanstack/react-query';
import { commentApi } from '@/domains/post/_common/api/comment.api';
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
    mutationFn: (payload: { content?: string; image?: File | null }) =>
      commentApi.createComment(postId, payload),
    onSuccess: () => {
      commentInvalidateQueries.list(postId);
      handlePostUpdateSuccess(postId);
    },
  });
};

export const useCreateReplyMutation = (postId: string) => {
  return useMutation({
    mutationFn: ({
      commentId,
      content,
      image,
    }: {
      commentId: string;
      content?: string;
      image?: File | null;
    }) => commentApi.createReply(commentId, { content, image }),
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
    mutationFn: ({
      commentId,
      content,
      image,
    }: {
      commentId: string;
      content?: string;
      image?: File | null;
    }) => commentApi.updateComment(commentId, { content, image }),
    onSuccess: () => {
      commentInvalidateQueries.list(postId);
    },
  });
};
