import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useIsMutating, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/shared/lib/toast/toast';
import { Post } from '@/entities/post/model/post.schema';
import { useFetchAccountQuery } from '@/entities/account/api/account.queries';
import { prefetchComments, seedEmptyComments } from '@/entities/comment/api/comment.queries';
import {
  prefetchPostDetail,
  useUpdatePostVisibilityMutation,
} from '@/entities/post/api/post.queries';
import { postMutationKeys } from '@/entities/post/api/post.keys';
import { usePostDelete } from '@/features/post/delete/hooks/usePostDelete';
import { useAlert } from '@/shared/ui/elements/dialog/alert/alert.store';
import { useDelayedLoading } from '@/shared/hooks/useDelayedLoading';
import { useMinimumLoading } from '@/shared/hooks/useMinimumLoading';
import { useSearchParamsDraft } from '@/shared/hooks/useSearchParamsDraft';
import { TEXTS } from '@/shared/config/texts';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import {
  MUTATION_PROGRESS_DELAY_MS,
  LOADING_INDICATOR_MIN_DURATION_MS,
} from '@/shared/config/const';

// 카드에 이만큼 머물러야 댓글까지 미리 받는다 - 지나가기만 한 마우스를 거르는 값이다
// (근거: docs/PERFORMANCE.md "상세 첫 진입 빈 화면")
const COMMENTS_PREFETCH_HOVER_DELAY_MS = 100;

function isShareCancelledByUser(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export function usePostCard(post: Post, isDetail = false) {
  const { data: account } = useFetchAccountQuery();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { updateSearchParams } = useSearchParamsDraft();
  const queryClient = useQueryClient();

  const isOwner = account?.id === post.author?.id;

  const { onDelete } = usePostDelete();
  const { mutateAsync: updateVisibility, isPending: isUpdatingVisibility } =
    useUpdatePostVisibilityMutation(post.id);
  const { openConfirm } = useAlert();

  const [isAiSummaryExpanded, setIsAiSummaryExpanded] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  // 타이머 ID는 화면에 그리지 않는 값이라 ref에 둔다(https://react.dev/reference/react/useRef)
  const commentsPrefetchTimerRef = useRef<number | undefined>(undefined);

  // 머무는 중에 카드가 사라지면(클릭해 이동, 가상 스크롤로 빠짐) 걸어 둔 댓글 미리 받기를 취소한다
  useEffect(() => {
    return () => {
      window.clearTimeout(commentsPrefetchTimerRef.current);
    };
  }, []);

  // 이 게시글의 수정 요청이 진행 중인지 (수정 폼에서 이탈한 뒤에도 mutation은 계속 돌아간다)
  const isUpdatingMutation = useIsMutating({ mutationKey: postMutationKeys.update(post.id) }) > 0;
  // 빠른 수정은 표시하지 않고(지연), 한 번 표시되면 최소 시간은 유지한다(깜빡임 방지)
  const isUpdatingDelayed = useDelayedLoading(isUpdatingMutation, MUTATION_PROGRESS_DELAY_MS);
  const isUpdating = useMinimumLoading(isUpdatingDelayed, LOADING_INDICATOR_MIN_DURATION_MS);

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    onDelete(post.id, {
      onSuccess: () => {
        setIsMenuOpen(false);
        if (isDetail) {
          navigate(ROUTES_PATHS.POST.ROOT);
        }
      },
    });
  };

  const handleToggleVisibility = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isOwner) {
      return;
    }

    const actionText = post.isPrivate
      ? TEXTS.post.card.visibilityToPublic
      : TEXTS.post.card.visibilityToPrivate;
    // 버튼 문구는 메시지와 별개로 짧게 — "확인"만으론 버튼만 보고 무슨 일이 일어나는지
    // 알 수 없다(2026-09-29, 버튼 문구 규칙).
    const confirmButtonText = post.isPrivate
      ? TEXTS.post.card.visibilityConfirmButtonToPublic
      : TEXTS.post.card.visibilityConfirmButtonToPrivate;

    openConfirm({
      title: TEXTS.post.card.visibilityConfirmTitle,
      message: TEXTS.post.card.visibilityConfirmMessage(actionText),
      confirmText: confirmButtonText,
      cancelText: TEXTS.buttons.cancel,
      // 공개 설정 토글은 삭제·이탈과 달리 어느 방향으로도 데이터가 사라지지 않고 같은
      // 확인창으로 언제든 되돌릴 수 있다 - "안전한 쪽 강조"가 아니라 "원하는 쪽 강조"가
      // 맞아 확인을 채움+오른쪽으로 켠다(Alert.tsx의 emphasis 옵션, docs/DECISIONS.md
      // 2026-09-29 항목).
      emphasis: 'confirm',
      onConfirm: () => {
        updateVisibility(
          { postId: post.id, isPrivate: !post.isPrivate },
          {
            onSuccess: () => {
              setIsMenuOpen(false);
            },
          }
        );
      },
    });
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/post/${post.id}`;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    try {
      if (isMobile && navigator.share) {
        await navigator.share({ url });
      } else {
        await navigator.clipboard.writeText(url);
        if (!isMobile) {
          toast.success(TEXTS.messages.success.linkCopied);
        }
      }
    } catch (error) {
      if (isShareCancelledByUser(error)) {
        return;
      }
      console.error('Copy failed', error);
      toast.error(TEXTS.messages.error.linkCopyFailed);
    }
  };

  const handleCopyOriginalUrl = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(post.url);
      toast.success(TEXTS.messages.success.originalLinkCopied);
    } catch {
      toast.error(TEXTS.messages.error.linkCopyFailed);
    }
  };

  const handleNavigateToEdit = () => {
    setIsMenuOpen(false);
    navigate(ROUTES_PATHS.POST.EDIT.replace(':id', post.id));
  };

  // 댓글 아이콘 hover·focus용 — 댓글을 보러 간다는 의도가 분명해 댓글까지 바로 미리 받는다.
  // 댓글이 0개인 글은 받아도 빈 응답이라 요청 대신 빈 목록을 심는다(seedEmptyComments)
  const handlePrefetchDetailWithComments = () => {
    prefetchPostDetail(queryClient, post.id);

    if (post.stats.commentCount === 0) {
      seedEmptyComments(queryClient, post.id);

      return;
    }

    prefetchComments(queryClient, post.id);
  };

  // 제목 링크 hover·focus용 — ::after가 카드 전체를 덮어 누르면 상세로 가는 곳 어디에 올라가도 발동한다.
  // 게시글은 바로 받고, 댓글은 카드에 머물렀을 때만 받는다: 상세는 댓글을 기다리느라 첫 화면을 최대
  // 500ms 미루므로(react-dom 18 FALLBACK_THROTTLE_MS) 댓글이 클릭 뒤에 출발하면 그만큼 빈 화면이 생기고,
  // 지나가기만 한 카드까지 댓글을 받지는 않으려는 것이다. 상세 안에서는 라우트가 이미 댓글을 받았다.
  // 댓글이 0개인 글은 요청이 없어 머물기를 기다리지 않고 빈 목록을 바로 심는다(seedEmptyComments)
  const handlePrefetchDetail = () => {
    prefetchPostDetail(queryClient, post.id);

    if (isDetail) {
      return;
    }

    if (post.stats.commentCount === 0) {
      seedEmptyComments(queryClient, post.id);

      return;
    }

    window.clearTimeout(commentsPrefetchTimerRef.current);
    commentsPrefetchTimerRef.current = window.setTimeout(() => {
      prefetchComments(queryClient, post.id);
    }, COMMENTS_PREFETCH_HOVER_DELAY_MS);
  };

  const handleCancelPrefetchComments = () => {
    window.clearTimeout(commentsPrefetchTimerRef.current);
  };

  // 카드에서 카테고리를 누르면 검색어를 그 카테고리(@이름) 하나로 바꾼다 - 칩처럼 토글하면 이미
  // 그 카테고리로 필터 중일 때 필터가 풀려 "이거 더 보기"라는 의도와 반대가 된다(docs/SEARCH.md).
  // 경로 분기는 NavbarSearch.submitQuery와 같다: 피드에서는 범위 칩(filter)을 유지한 채 q만 바꾸고,
  // 다른 페이지(북마크·상세)에서는 그 페이지의 파라미터를 옮기지 않고 피드로 이동한다.
  const handleCategoryClick = (categoryName: string) => {
    const categoryQuery = `@${categoryName}`;

    if (pathname === ROUTES_PATHS.POST.ROOT) {
      updateSearchParams((draft) => {
        draft.set('q', categoryQuery);
      });

      return;
    }

    navigate(`${ROUTES_PATHS.POST.ROOT}?q=${encodeURIComponent(categoryQuery)}`);
  };

  return {
    isOwner,
    isUpdating,
    isUpdatingVisibility,
    isAiSummaryExpanded,
    setIsAiSummaryExpanded,
    isMenuOpen,
    setIsMenuOpen,
    handleDelete,
    handleToggleVisibility,
    handleCopyLink,
    handleCopyOriginalUrl,
    handleNavigateToEdit,
    handlePrefetchDetail,
    handleCancelPrefetchComments,
    handlePrefetchDetailWithComments,
    handleCategoryClick,
  };
}
