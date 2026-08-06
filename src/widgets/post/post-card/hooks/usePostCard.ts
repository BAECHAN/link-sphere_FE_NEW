import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIsMutating } from '@tanstack/react-query';
import { toast } from '@/shared/lib/toast/toast';
import { Post } from '@/entities/post/model/post.schema';
import { useFetchAccountQuery } from '@/entities/user/api/auth.queries';
import { useUpdatePostVisibilityMutation } from '@/entities/post/api/post.queries';
import { postMutationKeys } from '@/entities/post/api/post.keys';
import { usePostDelete } from '@/features/post/delete/hooks/usePostDelete';
import { useAlert } from '@/shared/ui/elements/modal/alert/alert.store';
import { useDelayedLoading } from '@/shared/hooks/useDelayedLoading';
import { useMinimumLoading } from '@/shared/hooks/useMinimumLoading';
import { TEXTS } from '@/shared/config/texts';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import {
  LOADING_INDICATOR_DELAY_MS,
  LOADING_INDICATOR_MIN_DURATION_MS,
} from '@/shared/config/const';

export function usePostCard(post: Post, isDetail = false) {
  const { data: account } = useFetchAccountQuery();
  const navigate = useNavigate();

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
  const isUpdatingDelayed = useDelayedLoading(isUpdatingMutation, LOADING_INDICATOR_DELAY_MS);
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

    openConfirm({
      title: TEXTS.post.card.visibilityConfirmTitle,
      message: TEXTS.post.card.visibilityConfirmMessage(actionText),
      confirmText: TEXTS.buttons.confirm,
      cancelText: TEXTS.buttons.cancel,
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
      if (error instanceof Error && error.name === 'AbortError') {
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
  };
}
