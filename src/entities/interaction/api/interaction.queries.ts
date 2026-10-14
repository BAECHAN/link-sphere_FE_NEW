import { useMutation, useQueryClient, InfiniteData, QueryClient } from '@tanstack/react-query';
import { interactionApi } from '@/entities/interaction/api/interaction.api';
import {
  interactionMutationKeys,
  handleBookmarkPostFailure,
  handleLikePostFailure,
  handleLikeCommentFailure,
} from '@/entities/interaction/api/interaction.keys';
import type {
  PostBookmarkResponse,
  PostLikeResponse,
} from '@/entities/interaction/model/interaction.dto';
import { postKeys, Post, PostListResponse } from '@/entities/post/@x/interaction';
import { commentKeys, Comment } from '@/entities/comment/@x/interaction';
import {
  bookmarkFolderKeys,
  bookmarkPostScope,
  handleBookmarkToggleSuccess,
  isLastPendingBookmarkMutation,
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

// 북마크도 "뒤집기"가 아니라 "이 상태로 만들기"다 — 이미 그 상태면 그대로 둔다. 새로 저장하면
// 미분류(소속 없음)로 보이고, 실제 소속은 성공 응답으로 교정한다(서버는 기존 소속을 유지한다).
function setBookmarkOnPost(post: Post, nextBookmarked: boolean): Post {
  if (post.userInteractions.isBookmarked === nextBookmarked) {
    return post;
  }

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

function applyServerBookmarkToPost(post: Post, server: PostBookmarkResponse): Post {
  return {
    ...post,
    userInteractions: {
      ...post.userInteractions,
      isBookmarked: server.isBookmarked,
      bookmarkFolderIds: server.folderIds,
    },
  };
}

// true(저장)·false(해제), 또는 화면상 마지막 폴더를 빼며 해제({ lastFolderId }) — 마지막 폴더는 화면에선
// 해제와 같지만, 다른 기기가 추가한 소속이 남아 있으면 서버가 북마크를 지키고 응답으로 교정된다
type BookmarkPostTarget = boolean | { lastFolderId: string };

/**
 * 북마크 저장·해제 — 좋아요와 같은 연타 처리(docs/FE-ARCHITECTURE.md §11)에, 같은 글의 폴더 추가·제거·
 * 비우기까지 한 줄(bookmarkPostScope)로 세운다. 되돌리기 토스트가 다이얼로그보다 오래 남아 서로 섞이기
 * 때문이다. 응답 반영·롤백은 그 줄의 마지막 요청에서만 한다(docs/plans/2026-10-13-bookmark-set-state.md).
 */
export const useBookmarkPostMutation = (postId: Post['id']) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: interactionMutationKeys.bookmarkPost(postId),
    scope: bookmarkPostScope(postId),
    mutationFn: (target: BookmarkPostTarget) => {
      if (typeof target === 'object') {
        return interactionApi.unbookmarkPostFromLastFolder(postId, target.lastFolderId);
      }

      return target ? interactionApi.bookmarkPost(postId) : interactionApi.unbookmarkPost(postId);
    },
    meta: { manualErrorHandling: true },
    onMutate: async (target) => {
      // 마지막 폴더 해제도 화면에선 해제와 같다 — 다른 소속이 남았는지는 응답이 알려준다
      const nextBookmarked = typeof target === 'object' ? false : target;

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

      // 방향은 호출부가 화면에 보이는 상태로 정해 넘긴다(nextBookmarked). 이전 상태는 폴더 목록 수
      // (공유 캐시 하나)를 바뀔 때만 조정하려고 읽는다 — 패치 전에 읽어야 한다.
      const { isBookmarked: wasBookmarked, folderIds: prevFolderIds } = resolveCurrentBookmarkState(
        queryClient,
        postId
      );

      patchPostEverywhere(queryClient, postId, (post) => setBookmarkOnPost(post, nextBookmarked));

      // 북마크 화면(folder 캐시) 낙관적 반영 — 해제면 카드가 있는 폴더 캐시마다 뺀다. 이전 상태로
      // 조건을 걸지 않는다: 상세 캐시가 낡아 "저장 안 됨"이어도 북마크 화면의 카드는 빠져야 한다.
      if (!nextBookmarked) {
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
      }

      // 폴더 목록 수 — 상태가 실제로 바뀔 때만 조정한다(어차피 성공 뒤 무효화로 서버 값이 된다)
      if (previousFolderList && wasBookmarked !== nextBookmarked) {
        if (!nextBookmarked) {
          // 해제 — 소속돼있던 폴더 전부(여러 개일 수 있음), 소속 0개였다면 uncategorizedCount
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
        } else {
          // 저장 — 미분류로 새로 생김
          queryClient.setQueryData<BookmarkFolderListResponse>(bookmarkFolderKeys.list, {
            ...previousFolderList,
            uncategorizedCount: previousFolderList.uncategorizedCount + 1,
          });
        }
      }

      return { previousPost, previousLists, previousFolderPosts, previousFolderList };
    },
    onSuccess: (serverBookmark) => {
      if (!isLastPendingBookmarkMutation(queryClient, postId)) {
        return;
      }

      patchPostEverywhere(queryClient, postId, (post) =>
        applyServerBookmarkToPost(post, serverBookmark)
      );
      handleBookmarkToggleSuccess(queryClient);
    },
    onError: (_err, _target, context) => {
      if (!isLastPendingBookmarkMutation(queryClient, postId)) {
        return;
      }

      // 즉시 되돌린 뒤 서버 값으로 다시 맞춘다 — 앞선 요청까지 실패했다면 이 스냅샷도 틀리다
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
      handleBookmarkPostFailure(queryClient, postId);
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
