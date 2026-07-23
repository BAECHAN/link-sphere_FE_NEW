import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIsMutating } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Post } from '@/entities/post/model/post.schema';
import { useFetchAccountQuery } from '@/entities/user/api/auth.queries';
import { useUpdatePostVisibilityMutation } from '@/entities/post/api/post.queries';
import { postMutationKeys } from '@/entities/post/api/post.keys';
import { usePostDelete } from '@/features/post/delete/hooks/usePostDelete';
import { useAlert } from '@/shared/ui/elements/modal/alert/alert.store';
import { TEXTS } from '@/shared/config/texts';
import { ROUTES_PATHS } from '@/shared/config/route-paths';

/** 수정이 이 시간보다 오래 걸릴 때만 진행 표시를 띄운다 (빠른 수정에서 깜빡임 방지) */
const UPDATING_INDICATOR_DELAY_MS = 300;

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
  const updatingCount = useIsMutating({ mutationKey: postMutationKeys.update(post.id) });
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(
    function showUpdatingIndicatorAfterDelay() {
      if (!updatingCount) {
        setIsUpdating(false);
        return;
      }

      const timer = setTimeout(() => setIsUpdating(true), UPDATING_INDICATOR_DELAY_MS);
      return () => clearTimeout(timer);
    },
    [updatingCount]
  );

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
