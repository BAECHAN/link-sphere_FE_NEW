import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Post } from '@/entities/post/model/post.schema';
import { useFetchAccountQuery } from '@/entities/user/api/auth.queries';
import { useUpdatePostVisibilityMutation } from '@/entities/post/api/post.queries';
import { usePostDelete } from '@/features/post/delete/hooks/usePostDelete';
import { useAlert } from '@/shared/ui/elements/modal/alert/alert.store';
import { TEXTS } from '@/shared/config/texts';
import { ROUTES_PATHS } from '@/shared/config/route-paths';

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
    if (!isOwner) return;

    const actionText = post.isPrivate ? '전체 공개로' : '나만 보기(비공개)로';

    openConfirm({
      title: '공개 설정 변경',
      message: `이 게시물을 ${actionText} 전환하시겠습니까?`,
      confirmText: '확인',
      cancelText: '취소',
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
        if (!isMobile) toast.success(TEXTS.messages.success.linkCopied);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
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
