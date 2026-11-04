import {
  useMutation,
  usePrefetchQuery,
  useSuspenseQuery,
  useSuspenseInfiniteQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import dayjs from 'dayjs';
import { commentApi } from '@/entities/comment/api/comment.api';
import {
  commentKeys,
  handleCommentCreateOutcomeUnknown,
  handleCommentCreateSuccess,
  handleCommentDeleteSuccess,
  handleCommentUpdateSuccess,
} from '@/entities/comment/api/comment.keys';
import { Comment } from '@/entities/comment/model/comment.schema';
import { COMMENT_PAGE_SIZE } from '@/entities/comment/config/comment.const';
import { CommentUtil } from '@/entities/comment/utils/comment.util';
import { prefetchQueryQuietly } from '@/shared/lib/react-query/prefetch-quietly';
import { TEXTS } from '@/shared/config/texts';
import { PaginationRequest } from '@/shared/types/common.type';
import { IdempotencyKeyUtil } from '@/shared/utils/idempotency-key.util';

// 서버 응답을 기다리는 동안 목록에 즉시 꽂아 넣는 임시 댓글을 만든다.
// content 조립 규칙은 BE CommentService.buildFinalContent와 동일하게 맞춘다 - 텍스트 뒤에
// 이미지 URL(여기서는 아직 업로드 전이라 blob: URL)을 개행으로 이어붙인다.
function buildOptimisticComment({
  content,
  imageUrls,
  author,
}: {
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
    content: finalContent,
    isDeleted: false,
    createdAt: dayjs().toISOString(),
    author,
    replies: [],
    likeCount: 0,
    isLiked: false,
    linkMetadata: undefined,
  };
}

// 같은 시도인지 브라우저에서 알아보는 문자열(IdempotencyKeyUtil). 이미지는 다시 올릴 때마다 URL이 바뀌어 파일
// 속성으로 비교한다.
function buildCommentAttemptContent(
  target: string,
  { content, images = [] }: { content?: string; images?: File[] }
): string {
  const files = images.map((file) => [file.name, file.size, file.lastModified]);

  return `${target}:${JSON.stringify([content ?? '', files])}`;
}

// 임시 댓글을 서버 응답으로 바꾼다. 응답을 못 받아 목록을 다시 불러온 뒤 재시도하면 서버가 돌려준 댓글이 이미
// 목록에 있다 - 그때는 임시 댓글만 걷어내야 같은 댓글이 둘 보이지 않는다.
function settleTempComment(
  comments: Comment[],
  tempId: string | undefined,
  saved: Comment
): Comment[] {
  if (comments.some((comment) => comment.id === saved.id)) {
    return comments.filter((comment) => comment.id !== tempId);
  }

  return comments.map((comment) => (comment.id === tempId ? saved : comment));
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

function isFirstOccurrence(id: string, seen: Set<string>): boolean {
  return seen.has(id) ? false : seen.add(id) && true;
}

export const useSuspenseComments = (postId: string) => {
  return useSuspenseQuery({
    queryKey: commentKeys.list(postId),
    queryFn: () => commentApi.getComments(postId),
  });
};

/**
 * hover 시 댓글 미리 로드 — useSuspenseComments 와 동일 키/queryFn. 실패해도 토스트 없이 지워 댓글 목록이
 * 열리면 새로 요청한다
 */
export const prefetchComments = (queryClient: QueryClient, postId: string) => {
  prefetchQueryQuietly(queryClient, {
    queryKey: commentKeys.list(postId),
    queryFn: () => commentApi.getComments(postId),
  });
};

/**
 * 댓글이 0개인 글의 hover용 — 요청 대신 빈 목록을 캐시에 심어, 상세가 댓글 응답을 기다리지 않고 바로 그리게 한다.
 * updatedAt: 0은 오래된 값이라는 표시라 화면이 마운트할 때 한 번 다시 받아 그 사이 달린 댓글을 보여 준다(query-core
 * 5.90.16 query.js:405·:123, queryObserver.js:51·:445-452). 실제 댓글이나 진행 중인 요청을 지우지 않도록 캐시에 상태가
 * 있으면 건드리지 않는다(docs/PERFORMANCE.md "상세 첫 진입 빈 화면").
 */
export const seedEmptyComments = (queryClient: QueryClient, postId: string) => {
  if (queryClient.getQueryState(commentKeys.list(postId))) {
    return;
  }

  queryClient.setQueryData<Comment[]>(commentKeys.list(postId), [], { updatedAt: 0 });
};

/**
 * 렌더 중에 댓글 요청을 시작만 하고 기다리지 않는다 — useSuspenseComments 와 동일 키/queryFn.
 * 게시글을 기다리는 suspense 경계 바깥에서 불러, 게시글이 온 뒤에야 CommentList가 마운트돼
 * 요청하던 순차 요청(워터폴)을 없앤다
 * (https://github.com/tanstack/query/blob/main/docs/framework/react/guides/prefetching.md).
 */
export const usePrefetchComments = (postId: string) => {
  usePrefetchQuery({
    queryKey: commentKeys.list(postId),
    queryFn: () => commentApi.getComments(postId),
  });
};

export const useSuspenseMyCommentsInfiniteQuery = () => {
  return useSuspenseInfiniteQuery({
    queryKey: commentKeys.myRoot,
    queryFn: ({ pageParam }: { pageParam: PaginationRequest['page'] }) =>
      commentApi.getMyComments({ page: pageParam, size: COMMENT_PAGE_SIZE }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => (lastPage.last ? undefined : lastPage.page + 1),
    select: (data) => {
      const seen = new Set<string>();
      const comments = data.pages
        .flatMap((page) => page.content)
        .filter((comment) => isFirstOccurrence(comment.id, seen));
      return {
        pages: data.pages,
        pageParams: data.pageParams,
        comments,
        totalElements: data.pages[0]?.totalElements ?? 0,
      };
    },
  });
};

export const useCreateCommentMutation = (postId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      content,
      images,
    }: {
      content?: string;
      images?: File[];
      author: Comment['author'];
    }) =>
      IdempotencyKeyUtil.send(
        buildCommentAttemptContent(`comment:${postId}`, { content, images }),
        (key) => commentApi.createComment(postId, { content, images }, key)
      ),
    // 실패 원인은 폼이 버튼 위 FormAlert로 안내한다(useCreateComment) - 전역 토스트와 겹치지 않게 끈다
    meta: { manualErrorHandling: true },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: commentKeys.list(postId) });

      const previousComments = queryClient.getQueryData<Comment[]>(commentKeys.list(postId));
      const blobUrls = (variables.images ?? []).map((file) => URL.createObjectURL(file));
      const tempComment = buildOptimisticComment({
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
        settleTempComment(old, context?.tempId, data)
      );
      handleCommentCreateSuccess(queryClient, postId);
    },
    onError: (error, _variables, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(commentKeys.list(postId), context.previousComments);
      }

      if (CommentUtil.isOutcomeUnknown(error) || CommentUtil.isDuplicate(error)) {
        handleCommentCreateOutcomeUnknown(queryClient, postId);
      }
    },
    onSettled: (_data, _err, _variables, context) => {
      context?.blobUrls.forEach((url) => URL.revokeObjectURL(url));
    },
  });
};

export const useCreateReplyMutation = (postId: string) => {
  const queryClient = useQueryClient();

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
    }) =>
      IdempotencyKeyUtil.send(
        buildCommentAttemptContent(`reply:${commentId}`, { content, images }),
        (key) => commentApi.createReply(commentId, { content, images }, key)
      ),
    // 실패 원인은 폼이 버튼 위 FormAlert로 안내한다(useCreateComment) - 전역 토스트와 겹치지 않게 끈다
    meta: { manualErrorHandling: true },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: commentKeys.list(postId) });

      const previousComments = queryClient.getQueryData<Comment[]>(commentKeys.list(postId));
      const blobUrls = (variables.images ?? []).map((file) => URL.createObjectURL(file));
      const tempReply = buildOptimisticComment({
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
                replies: settleTempComment(comment.replies, context?.tempId, data),
              }
            : comment
        )
      );
      handleCommentCreateSuccess(queryClient, postId);
    },
    onError: (error, _variables, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(commentKeys.list(postId), context.previousComments);
      }

      if (CommentUtil.isOutcomeUnknown(error) || CommentUtil.isDuplicate(error)) {
        handleCommentCreateOutcomeUnknown(queryClient, postId);
      }
    },
    onSettled: (_data, _err, _variables, context) => {
      context?.blobUrls.forEach((url) => URL.revokeObjectURL(url));
    },
  });
};

export const useDeleteCommentMutation = (postId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: string) => commentApi.deleteComment(commentId),
    meta: { successMessage: TEXTS.messages.success.commentDeleted },
    onSuccess: () => {
      handleCommentDeleteSuccess(queryClient, postId);
    },
  });
};

export const useUpdateCommentMutation = (postId: string) => {
  const queryClient = useQueryClient();

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
    // 실패 원인은 폼이 버튼 위 FormAlert로 안내한다(useUpdateComment) - 전역 토스트와 겹치지 않게 끈다
    meta: { manualErrorHandling: true },
    onSuccess: (data) => {
      // 응답을 캐시에 먼저 반영한 뒤(mutation-level onSuccess) 호출부의 onSuccess(폼 닫기)가
      // 실행되므로, 폼이 닫히는 순간엔 이미 새 내용이 캐시에 있다 - 옛 내용이 스치지 않는다.
      queryClient.setQueryData<Comment[]>(commentKeys.list(postId), (old = []) =>
        patchCommentRecursively(old, data.id, {
          content: data.content,
          linkMetadata: data.linkMetadata,
        })
      );
      handleCommentUpdateSuccess(queryClient, postId);
    },
  });
};
