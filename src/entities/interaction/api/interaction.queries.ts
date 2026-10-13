import { useMutation, useQueryClient, InfiniteData, QueryClient } from '@tanstack/react-query';
import { interactionApi } from '@/entities/interaction/api/interaction.api';
import {
  interactionMutationKeys,
  handleLikePostFailure,
  handleLikeCommentFailure,
} from '@/entities/interaction/api/interaction.keys';
import type { PostLikeResponse } from '@/entities/interaction/model/interaction.dto';
import { postKeys, Post, PostListResponse } from '@/entities/post/@x/interaction';
import { commentKeys, Comment } from '@/entities/comment/@x/interaction';
import {
  bookmarkFolderKeys,
  handleBookmarkToggleSuccess,
  resolveCurrentBookmarkState,
  BookmarkFolderListResponse,
} from '@/entities/bookmark/folder/@x/interaction';

// 좋아요는 "뒤집기"가 아니라 "이 상태로 만들기"다 — 이미 그 상태면 수도 그대로 둔다.
function setLikeOnPost(post: Post, nextLiked: boolean): Post {
  if (post.userInteractions.isLiked === nextLiked) {
    return post;
  }

  return {
    ...post,
    userInteractions: { ...post.userInteractions, isLiked: nextLiked },
    stats: { ...post.stats, likeCount: post.stats.likeCount + (nextLiked ? 1 : -1) },
  };
}

function applyServerLikeToPost(post: Post, { isLiked, likeCount }: PostLikeResponse): Post {
  return {
    ...post,
    userInteractions: { ...post.userInteractions, isLiked },
    stats: { ...post.stats, likeCount },
  };
}

// 그 글이 그려지는 캐시 3곳(상세·피드 목록·북마크 폴더 목록)에 같은 변환을 적용한다. 북마크
// 화면은 폴더 캐시로 카드를 그려서(BookmarkPage) 여기를 빠뜨리면 그 화면의 좋아요가 안 바뀐다.
function patchPostEverywhere(
  queryClient: QueryClient,
  postId: Post['id'],
  update: (post: Post) => Post
) {
  // 상세 캐시가 없으면 updater가 undefined를 돌려 새로 만들지 않는다
  queryClient.setQueryData<Post>(postKeys.detail(postId), (cached) =>
    cached ? update(cached) : cached
  );

  for (const queryKey of [postKeys.listRoot, bookmarkFolderKeys.postsRoot]) {
    queryClient.setQueriesData<InfiniteData<PostListResponse>>({ queryKey }, (oldData) => {
      if (!oldData) {
        return oldData;
      }

      return {
        ...oldData,
        pages: oldData.pages.map((page) => ({
          ...page,
          content: page.content.map((post) => (post.id === postId ? update(post) : post)),
        })),
      };
    });
  }
}

/**
 * 좋아요 연타 처리(docs/plans/2026-10-13-like-concurrency.md, docs/FE-ARCHITECTURE.md §11):
 * 화면은 클릭마다 onMutate가 즉시 바꾸고, 요청은 scope로 한 줄로 보내 클릭 순서대로 서버에
 * 닿게 한다. 응답 반영·롤백은 같은 글의 마지막 요청에서만 한다 — 중간 응답으로 덮으면 앞 상태로
 * 깜빡이고, 중간 실패는 뒤 요청이 상태를 다시 정하기 때문이다.
 */
export const useLikePostMutation = (postId: Post['id']) => {
  const queryClient = useQueryClient();
  const mutationKey = interactionMutationKeys.likePost(postId);
  // onSuccess·onError가 불리는 시점엔 자기 자신도 아직 pending이라, 1이면 남은 요청이 없다
  const isLastPendingLike = () => queryClient.isMutating({ mutationKey }) === 1;

  return useMutation({
    mutationKey,
    scope: { id: mutationKey.join(':') },
    mutationFn: (nextLiked: boolean) =>
      nextLiked ? interactionApi.likePost(postId) : interactionApi.unlikePost(postId),
    meta: { manualErrorHandling: true },
    onMutate: async (nextLiked) => {
      await queryClient.cancelQueries({ queryKey: postKeys.detail(postId) });
      await queryClient.cancelQueries({ queryKey: postKeys.listRoot });
      await queryClient.cancelQueries({ queryKey: bookmarkFolderKeys.postsRoot });

      // 패치 전 스냅샷 — onError 롤백용(useBookmarkPostMutation과 같은 패턴)
      const previousPost = queryClient.getQueryData<Post>(postKeys.detail(postId));
      const previousLists = queryClient.getQueriesData<InfiniteData<PostListResponse>>({
        queryKey: postKeys.listRoot,
      });
      const previousFolderPosts = queryClient.getQueriesData<InfiniteData<PostListResponse>>({
        queryKey: bookmarkFolderKeys.postsRoot,
      });

      patchPostEverywhere(queryClient, postId, (post) => setLikeOnPost(post, nextLiked));

      return { previousPost, previousLists, previousFolderPosts };
    },
    onSuccess: (serverLike) => {
      if (!isLastPendingLike()) {
        return;
      }

      patchPostEverywhere(queryClient, postId, (post) => applyServerLikeToPost(post, serverLike));
    },
    onError: (_err, _nextLiked, context) => {
      if (!isLastPendingLike()) {
        return;
      }

      // 즉시 되돌린 뒤 서버 값으로 다시 맞춘다 — 앞선 요청까지 실패했다면 이 스냅샷도 틀리다
      if (context?.previousPost) {
        queryClient.setQueryData(postKeys.detail(postId), context.previousPost);
      }
      context?.previousLists?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      context?.previousFolderPosts?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      handleLikePostFailure(queryClient, postId);
    },
  });
};

function applyBookmarkToggleToPost(post: Post, nextBookmarked: boolean): Post {
  return {
    ...post,
    userInteractions: {
      ...post.userInteractions,
      isBookmarked: nextBookmarked,
      bookmarkFolderIds: [],
    },
    stats: {
      ...post.stats,
      bookmarkCount: Math.max(0, post.stats.bookmarkCount + (nextBookmarked ? 1 : -1)),
    },
  };
}

export const useBookmarkPostMutation = (postId: Post['id']) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => interactionApi.toggleBookmarkPost(postId),
    meta: { manualErrorHandling: true },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: postKeys.detail(postId) });
      await queryClient.cancelQueries({ queryKey: postKeys.listRoot });
      await queryClient.cancelQueries({ queryKey: bookmarkFolderKeys.list });
      await queryClient.cancelQueries({ queryKey: bookmarkFolderKeys.postsRoot });

      const previousPost = queryClient.getQueryData<Post>(postKeys.detail(postId));
      // 메인 피드 목록 스냅샷 — onError 롤백용. useLikePostMutation과 같은 이유로 같은
      // 종류의 구멍이 있었다(패치만 하고 onError 복원 목록엔 없었음, 2026-09-10 발견).
      const previousLists = queryClient.getQueriesData<InfiniteData<PostListResponse>>({
        queryKey: postKeys.listRoot,
      });
      const previousFolderPosts = queryClient.getQueriesData<InfiniteData<PostListResponse>>({
        queryKey: bookmarkFolderKeys.postsRoot,
      });
      const previousFolderList = queryClient.getQueryData<BookmarkFolderListResponse>(
        bookmarkFolderKeys.list
      );

      // 방향(ON/OFF)은 detail → 메인 피드 목록 → 폴더 게시글 캐시 순으로 찾은
      // isBookmarked 값 하나로만 결정한다. bookmark-folder.queries.ts의 동일 로직과
      // 공유 — 메인 피드에서만 조작하면 항상 false로 오판하던 버그 수정(§Phase 0).
      const { isBookmarked: wasBookmarked, folderIds: prevFolderIds } = resolveCurrentBookmarkState(
        queryClient,
        postId
      );
      const nextBookmarked = !wasBookmarked;

      if (previousPost) {
        queryClient.setQueryData<Post>(
          postKeys.detail(postId),
          applyBookmarkToggleToPost(previousPost, nextBookmarked)
        );
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
                post.id === postId ? applyBookmarkToggleToPost(post, nextBookmarked) : post
              ),
            })),
          };
        }
      );

      // 북마크 화면(folder 캐시) 낙관적 반영
      if (!nextBookmarked) {
        // OFF — 소속돼있던 모든 폴더 캐시(+ 미분류)에서 카드 제거
        queryClient.setQueriesData<InfiniteData<PostListResponse>>(
          { queryKey: bookmarkFolderKeys.postsRoot },
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
          queryClient.setQueryData<BookmarkFolderListResponse>(bookmarkFolderKeys.list, {
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
        queryClient.setQueryData<BookmarkFolderListResponse>(bookmarkFolderKeys.list, {
          ...previousFolderList,
          uncategorizedCount: previousFolderList.uncategorizedCount + 1,
        });
      }

      return { previousPost, previousLists, previousFolderPosts, previousFolderList };
    },
    onSuccess: () => {
      handleBookmarkToggleSuccess(queryClient);
    },
    onError: (_err, _variables, context) => {
      if (context?.previousPost) {
        queryClient.setQueryData(postKeys.detail(postId), context.previousPost);
      }
      if (context?.previousFolderList) {
        queryClient.setQueryData(bookmarkFolderKeys.list, context.previousFolderList);
      }
      context?.previousLists?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      context?.previousFolderPosts?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
  });
};

// useLikePostMutation 과 같은 연타 처리(scope 직렬화 + 마지막 요청에서만 롤백). 댓글 좋아요
// 응답에는 likeCount가 없어 서버 값 반영은 하지 않는다.
export const useLikeCommentMutation = (commentId: Comment['id'], postId: Post['id']) => {
  const queryClient = useQueryClient();
  const mutationKey = interactionMutationKeys.likeComment(commentId);
  const isLastPendingLike = () => queryClient.isMutating({ mutationKey }) === 1;

  return useMutation({
    mutationKey,
    scope: { id: mutationKey.join(':') },
    mutationFn: (nextLiked: boolean) =>
      nextLiked ? interactionApi.likeComment(commentId) : interactionApi.unlikeComment(commentId),
    meta: { manualErrorHandling: true },
    onMutate: async (nextLiked) => {
      await queryClient.cancelQueries({ queryKey: commentKeys.list(postId) });

      const previousComments = queryClient.getQueryData<Comment[]>(commentKeys.list(postId));

      if (previousComments) {
        const updateCommentsRecursively = (comments: Comment[]): Comment[] => {
          return comments.map((comment) => {
            if (comment.id === commentId) {
              if (comment.isLiked === nextLiked) {
                return comment;
              }

              return {
                ...comment,
                isLiked: nextLiked,
                likeCount: comment.likeCount + (nextLiked ? 1 : -1),
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
    onError: (_err, _nextLiked, context) => {
      if (!isLastPendingLike()) {
        return;
      }

      if (context?.previousComments) {
        queryClient.setQueryData(commentKeys.list(postId), context.previousComments);
      }

      handleLikeCommentFailure(queryClient, postId);
    },
  });
};
