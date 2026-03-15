import { useQuery, useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { commentApi } from '@/entities/comment/api/comment.api';
import {
  commentKeys,
  handleCommentCreateSuccess,
  handleCommentDeleteSuccess,
  handleCommentUpdateSuccess,
} from '@/entities/comment/api/comment.keys';

export const useComments = (postId: string) => {
  return useQuery({
    queryKey: commentKeys.list(postId),
    queryFn: () => commentApi.getComments(postId),
  });
};

export const useSuspenseComments = (postId: string) => {
  return useSuspenseQuery({
    queryKey: commentKeys.list(postId),
    queryFn: () => commentApi.getComments(postId),
  });
};

export const useCreateCommentMutation = (postId: string) => {
  return useMutation({
    mutationFn: (payload: { content?: string; images?: File[] }) =>
      commentApi.createComment(postId, payload),
    onSuccess: () => {
      handleCommentCreateSuccess(postId);
    },
  });
};

export const useCreateReplyMutation = (postId: string) => {
  return useMutation({
    mutationFn: ({
      commentId,
      content,
      images,
    }: {
      commentId: string;
      content?: string;
      images?: File[];
    }) => commentApi.createReply(commentId, { content, images }),
    onSuccess: () => {
      handleCommentCreateSuccess(postId);
    },
  });
};

export const useDeleteCommentMutation = (postId: string) => {
  return useMutation({
    mutationFn: (commentId: string) => commentApi.deleteComment(commentId),
    onSuccess: () => {
      handleCommentDeleteSuccess(postId);
    },
  });
};

export const useUpdateCommentMutation = (postId: string) => {
  return useMutation({
    mutationFn: ({
      commentId,
      content,
      images,
    }: {
      commentId: string;
      content?: string;
      images?: File[];
    }) => commentApi.updateComment(commentId, { content, images }),
    onSuccess: () => {
      handleCommentUpdateSuccess(postId);
    },
  });
};
