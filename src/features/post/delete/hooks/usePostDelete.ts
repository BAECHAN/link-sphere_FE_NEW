import { useDeletePostMutation } from '@/entities/post/api/post.queries';

import { TEXTS } from '@/shared/config/texts';
import { useAlert } from '@/shared/ui/elements/modal/alert/alert.store';

export function usePostDelete() {
  const { mutateAsync: deletePost, isPending: isDeleting } = useDeletePostMutation();
  const { openConfirm } = useAlert();

  const handleDeleteClick = (postId: string, options?: { onSuccess?: () => void }) => {
    openConfirm({
      message: TEXTS.messages.warning.postDeleteConfirm,
      confirmText: TEXTS.buttons.delete,
      // 이 확인창은 메뉴에서 "삭제"를 직접 눌러야만 뜬다 - 이탈 가드처럼 의도치 않은
      // 동작(뒤로가기 등)에 끼어드는 게 아니라 이미 삭제를 결심한 사람이 도달한
      // 지점이다. Apple HIG "스스로 고른 위험한 동작에는 destructive 스타일을 주지
      // 않는다"(docs/DECISIONS.md 2026-09-29 항목)의 연장으로 확인을 채움+오른쪽으로 켠다.
      emphasis: 'confirm',
      onConfirm: async () => {
        await deletePost(postId);
        options?.onSuccess?.();
      },
    });
  };

  return {
    onDelete: handleDeleteClick,
    isDeleting,
  };
}
