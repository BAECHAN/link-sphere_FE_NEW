import { useQuery, useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { commentApi } from '@/entities/comment/api/comment.api';
import {
  commentKeys,
  handleCommentCreateSuccess,
  handleCommentDeleteSuccess,
  handleCommentUpdateSuccess,
} from '@/entities/comment/api/comment.keys';
import { queryClient } from '@/shared/lib/react-query/config/queryClient';
import { Comment } from '@/entities/comment/model/comment.schema';

// 서버 응답을 기다리는 동안 목록에 즉시 꽂아 넣는 임시 댓글을 만든다.
// content 조립 규칙은 BE CommentService.buildFinalContent와 동일하게 맞춘다 - 텍스트 뒤에
// 이미지 URL(여기서는 아직 업로드 전이라 blob: URL)을 개행으로 이어붙인다.
function buildOptimisticComment({
  postId,
  content,
  imageUrls,
  author,
}: {
  postId: string;
  content?: string;
  imageUrls: string[];
  author: Comment['author'];
}): Comment {
  const text = content ?? '';
  const finalContent =
    imageUrls.length === 0
      ? text
      : text.trim()
        ? `${text}\n\n${imageUrls.join('\n')}`
        : imageUrls.join('\n');

  return {
    id: `temp-${crypto.randomUUID()}`,
    postId,
    userId: author.id,
    content: finalContent,
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    author,
    replies: [],
    likeCount: 0,
    isLiked: false,
    linkMetadata: undefined,
  };
}

// 트리(루트+답글)에서 id가 일치하는 댓글에 patch를 병합한다. PATCH 응답(CommentResponse)은
// replies/likeCount/isLiked를 항상 기본값으로 내려주므로(BE toCommentResponse), 통째로
// 치환하면 답글이 사라지거나 좋아요가 리셋된다 - 응답에서 실제로 바뀐 필드만 병합해야 한다.
function patchCommentRecursively(
  comments: Comment[],
  targetId: string,
  patch: Partial<Comment>
): Comment[] {
  return comments.map((comment) => {
    if (comment.id === targetId) {
      return { ...comment, ...patch };
    }
    if (comment.replies.length > 0) {
      return { ...comment, replies: patchCommentRecursively(comment.replies, targetId, patch) };
    }
    return comment;
  });
}

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
    mutationFn: (payload: { content?: string; images?: File[]; author: Comment['author'] }) =>
      commentApi.createComment(postId, { content: payload.content, images: payload.images }),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: commentKeys.list(postId) });

      const previousComments = queryClient.getQueryData<Comment[]>(commentKeys.list(postId));
      const blobUrls = (variables.images ?? []).map((file) => URL.createObjectURL(file));
      const tempComment = buildOptimisticComment({
        postId,
        content: variables.content,
        imageUrls: blobUrls,
        author: variables.author,
      });

      queryClient.setQueryData<Comment[]>(commentKeys.list(postId), (old = []) => [
        tempComment,
        ...old,
      ]);

      return { previousComments, tempId: tempComment.id, blobUrls };
    },
    onSuccess: (data, _variables, context) => {
      queryClient.setQueryData<Comment[]>(commentKeys.list(postId), (old = []) =>
        old.map((comment) => (comment.id === context?.tempId ? data : comment))
      );
      handleCommentCreateSuccess(postId);
    },
    onError: (_err, _variables, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(commentKeys.list(postId), context.previousComments);
      }
    },
    onSettled: (_data, _err, _variables, context) => {
      context?.blobUrls.forEach((url) => URL.revokeObjectURL(url));
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
      author: Comment['author'];
    }) => commentApi.createReply(commentId, { content, images }),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: commentKeys.list(postId) });

      const previousComments = queryClient.getQueryData<Comment[]>(commentKeys.list(postId));
      const blobUrls = (variables.images ?? []).map((file) => URL.createObjectURL(file));
      const tempReply = buildOptimisticComment({
        postId,
        content: variables.content,
        imageUrls: blobUrls,
        author: variables.author,
      });

      if (previousComments) {
        queryClient.setQueryData<Comment[]>(
          commentKeys.list(postId),
          previousComments.map((comment) =>
            comment.id === variables.commentId
              ? { ...comment, replies: [...comment.replies, tempReply] }
              : comment
          )
        );
      }

      return { previousComments, tempId: tempReply.id, blobUrls };
    },
    onSuccess: (data, variables, context) => {
      queryClient.setQueryData<Comment[]>(commentKeys.list(postId), (old = []) =>
        old.map((comment) =>
          comment.id === variables.commentId
            ? {
                ...comment,
                replies: comment.replies.map((reply) =>
                  reply.id === context?.tempId ? data : reply
                ),
              }
            : comment
        )
      );
      handleCommentCreateSuccess(postId);
    },
    onError: (_err, _variables, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(commentKeys.list(postId), context.previousComments);
      }
    },
    onSettled: (_data, _err, _variables, context) => {
      context?.blobUrls.forEach((url) => URL.revokeObjectURL(url));
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
      existingImages,
    }: {
      commentId: string;
      content?: string;
      images?: File[];
      existingImages?: string[];
    }) => commentApi.updateComment(commentId, { content, images, existingImages }),
    onSuccess: (data) => {
      // 응답을 캐시에 먼저 반영한 뒤(mutation-level onSuccess) 호출부의 onSuccess(폼 닫기)가
      // 실행되므로, 폼이 닫히는 순간엔 이미 새 내용이 캐시에 있다 - 옛 내용이 스치지 않는다.
      queryClient.setQueryData<Comment[]>(commentKeys.list(postId), (old = []) =>
        patchCommentRecursively(old, data.id, {
          content: data.content,
          updatedAt: data.updatedAt,
          linkMetadata: data.linkMetadata,
        })
      );
      handleCommentUpdateSuccess(postId);
    },
  });
};
