import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useIsMutating, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/shared/lib/toast/toast';
import { Post } from '@/entities/post/model/post.schema';
import { useFetchAccountQuery } from '@/entities/account/api/account.queries';
import {
  prefetchPostDetail,
  useUpdatePostVisibilityMutation,
} from '@/entities/post/api/post.queries';
import { postMutationKeys } from '@/entities/post/api/post.keys';
import { usePostDelete } from '@/features/post/delete/hooks/usePostDelete';
import { useAlert } from '@/shared/ui/elements/modal/alert/alert.store';
import { useDelayedLoading } from '@/shared/hooks/useDelayedLoading';
import { useMinimumLoading } from '@/shared/hooks/useMinimumLoading';
import { useSearchParamsDraft } from '@/shared/hooks/useSearchParamsDraft';
import { TEXTS } from '@/shared/config/texts';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import {
  MUTATION_PROGRESS_DELAY_MS,
  LOADING_INDICATOR_MIN_DURATION_MS,
} from '@/shared/config/const';

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

  const handlePrefetchDetail = () => {
    prefetchPostDetail(queryClient, post.id);
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
    handleCategoryClick,
  };
}
